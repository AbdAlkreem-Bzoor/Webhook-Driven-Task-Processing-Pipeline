// ProcessingService.ts

import { eq, and } from "drizzle-orm";
import { jobs, outboxMessages } from "../db/schema.js";
import { AppMetrics } from "../diagnostics/AppMetrics.js";
import { IProcessingService } from "../abstractions/IProcessingService.js";
import { IProcessingAction, ProcessingActionType } from "../processing-actions/ProcessingAction.js";
import { Logger } from "../logger.js";
import { db } from "../db/index.js";

export class ProcessingService implements IProcessingService {
    private readonly actions: Map<ProcessingActionType, IProcessingAction>;

    constructor(
        actions: IProcessingAction[],
        private readonly metrics: AppMetrics,
        private readonly logger: Logger,
    ) {
        this.actions = new Map(actions.map(a => [a.actionType, a]));
    }

    async handleMessageAsync(jobId: string, signal?: AbortSignal): Promise<void> {
        await this.processJobAsync(jobId, signal);
    }

    async processJobAsync(jobId: string, _signal?: AbortSignal): Promise<void> {
        const claimed = await db
            .update(jobs)
            .set({
                status: 'Processing',
                updatedAt: new Date(),
                updatedBy: ProcessingService.name,
            })
            .where(and(eq(jobs.id, jobId), eq(jobs.status, 'Queued')))
            .returning({ id: jobs.id });

        if (claimed.length === 0) {
            this.logger.warn(
                `Job ${jobId} already claimed by another consumer or does not exist — skipping`,
            );
            return;
        }

        this.logger.info(`Job ${jobId} claimed for processing`);

        const job = await db.query.jobs.findFirst({
            where: eq(jobs.id, jobId),
            with: {
                pipeline: {
                    with: { processingActions: true },
                },
            },
        });

        if (!job) throw new Error(`Job ${jobId} not found after claim`);

        const start = performance.now();
        let finalStatus = job.status;

        try {
            let payload = job.incomingPayload;
            const pipelineActions = [...job.pipeline.processingActions].sort((a, b) => a.order - b.order);

            for (const pipelineAction of pipelineActions) {
                const action = this.actions.get(pipelineAction.actionType as ProcessingActionType);

                if (!action) {
                    throw new Error(`No action registered for action type: ${pipelineAction.actionType}`);
                }

                this.logger.info(
                    `Job ${jobId}: executing action ${pipelineAction.order} [${pipelineAction.actionType}] ${pipelineAction.name ?? "—"}`,
                );

                const result = action.execute(payload, pipelineAction.configuration);

                if (!result.success) {
                    this.logger.info(
                        `Job ${jobId}: filtered at action ${pipelineAction.order} [${pipelineAction.actionType}]: ${result.reason}`,
                    );

                    finalStatus = 'Filtered';
                    payload = result.outputJson;
                    break;
                }

                payload = result.outputJson;
            }

            if (finalStatus !== 'Filtered') {
                finalStatus = 'Completed';
            }

            await db
                .update(jobs)
                .set({
                    processedPayload: payload,
                    status: finalStatus,
                    completedAt: finalStatus === 'Completed' ? new Date() : undefined,
                    updatedAt: new Date(),
                    updatedBy: ProcessingService.name,
                })
                .where(eq(jobs.id, jobId));
        } catch (error) {
            if (isAbortError(error)) throw error;
            this.logger.error(`Job ${jobId} failed during action execution`, error);
            finalStatus = 'Failed';

            await db
                .update(jobs)
                .set({
                    status: finalStatus,
                    updatedAt: new Date(),
                    updatedBy: ProcessingService.name,
                })
                .where(eq(jobs.id, jobId));
        } finally {
            const durationMs = performance.now() - start;
            this.metrics.jobProcessingDuration.record(durationMs);
            this.metrics.jobsProcessed.add(1, { status: finalStatus });
        }

        if (finalStatus === 'Completed') {
            await db
                .insert(outboxMessages)
                .values({
                    eventType: 'JobCompleted',
                    payload: JSON.stringify(jobId),
                    createdAt: new Date(),
                });
        }

        this.logger.info(`Job ${jobId} finished with status ${finalStatus}`);
    }
}

function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === "AbortError";
}
