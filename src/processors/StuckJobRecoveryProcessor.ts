import { eq, and, lt } from "drizzle-orm";
import { AppMetrics } from "../diagnostics/AppMetrics.js";
import { jobs, outboxMessages } from "../db/schema.js";
import { Logger } from "../logger.js";
import { db } from "../db/index.js";

export class StuckJobRecoveryProcessor {
    static readonly intervalInSeconds = 30;
    private static readonly staleThresholdMs = 5 * 60 * 1000; // 5 minutes

    constructor(
        private readonly metrics: AppMetrics,
        private readonly logger: Logger,
    ) {}

    async execute(signal?: AbortSignal): Promise<void> {
        try {
            await this.recoverStuckProcessingJobsAsync(signal);
        } catch (error) {
            if (isAbortError(error)) throw error;
            this.logger.error("Unhandled error in stuck job recovery processor", error);
        }
    }

    private async recoverStuckProcessingJobsAsync(_signal?: AbortSignal): Promise<void> {
        const cutoff = new Date(Date.now() - StuckJobRecoveryProcessor.staleThresholdMs);

        const stuckJobs = await db
            .select()
            .from(jobs)
            .where(
                and(
                    eq(jobs.status, 'Processing'),
                    lt(jobs.updatedAt, cutoff),
                ),
            );

        if (stuckJobs.length === 0) return;

        this.logger.warn(
            `Found ${stuckJobs.length} stuck job(s) in Processing state older than 5 minutes`,
        );

        for (const job of stuckJobs) {
            const now = new Date();

             await db.transaction(async (tx) => {
                 await tx
                .update(jobs)
                .set({
                    status: 'Queued',
                    updatedBy: StuckJobRecoveryProcessor.name,
                    updatedAt: now,
                })
                .where(eq(jobs.id, job.id));

             await tx
                .insert(outboxMessages)
                .values({
                    eventType: 'JobCreated',
                    payload: JSON.stringify(job.id),
                    createdAt: now,
                });
             });

            this.metrics.stuckJobsRecovered.add(1);

            this.logger.warn(
                `Recovered stuck processing job ${job.id} — reset to Queued (stuck since ${job.updatedAt?.toISOString()})`,
            );
        }
    }
}

function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === "AbortError";
}