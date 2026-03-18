// StuckNotificationRecoveryProcessor.ts

import { eq, and, lt } from "drizzle-orm";
import { jobs, outboxMessages } from "../db/schema.js";
import { AppMetrics } from "../diagnostics/AppMetrics.js";
import { Logger } from "../logger.js";
import { db } from "../db/index.js";

export class StuckNotificationRecoveryProcessor {
    static readonly intervalInSeconds = 30;
    private static readonly staleThresholdMs = 5 * 60 * 1000; // 5 minutes

    constructor(
        private readonly metrics: AppMetrics,
        private readonly logger: Logger,
    ) {}

    async execute(signal?: AbortSignal): Promise<void> {
        try {
            await this.recoverStuckNotificationDispatchesAsync(signal);
        } catch (error) {
            if (isAbortError(error)) throw error;
            this.logger.error(
                "Unhandled error in stuck notification recovery processor",
                error,
            );
        }
    }

    private async recoverStuckNotificationDispatchesAsync(_signal?: AbortSignal): Promise<void> {
        const cutoff = new Date(Date.now() - StuckNotificationRecoveryProcessor.staleThresholdMs);

        const stuckJobs = await db
            .select()
            .from(jobs)
            .where(
                and(
                    eq(jobs.deliveryStatus, 'Dispatching'),
                    lt(jobs.updatedAt, cutoff),
                ),
            );

        if (stuckJobs.length === 0) return;

        this.logger.warn(
            `Found ${stuckJobs.length} stuck notification dispatch(es) older than 5 minutes`,
        );

        for (const job of stuckJobs) {
            const now = new Date();

            await db.transaction(async (tx) => {
            await tx
                .update(jobs)
                .set({
                    deliveryStatus: 'Pending',
                    updatedBy: StuckNotificationRecoveryProcessor.name,
                    updatedAt: now,
                })
                .where(eq(jobs.id, job.id));

            await tx
                .insert(outboxMessages)
                .values({
                    eventType: 'JobCompleted',
                    payload: JSON.stringify(job.id),
                    createdAt: now,
                });
        });

            this.metrics.stuckNotificationsRecovered.add(1);

            this.logger.warn(
                `Recovered stuck notification dispatch for job ${job.id} — reset to Pending`,
            );
        }
    }
}

function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === "AbortError";
}