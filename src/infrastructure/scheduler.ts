// infrastructure/scheduler.ts
// Replaces AddQuartzProcessors() — runs processors on fixed intervals via setInterval.

import { JobCreatedEventOutboxProcessor } from "../processors/JobCreatedEventOutboxProcessor.js";
import { JobCompletedEventOutboxProcessor } from "../processors/JobCompletedEventOutboxProcessor.js";
import { StuckJobRecoveryProcessor } from "../processors/StuckJobRecoveryProcessor.js";
import { StuckNotificationRecoveryProcessor } from "../processors/StuckNotificationRecoveryProcessor.js";

export function startScheduler(
    jobCreatedProcessor: JobCreatedEventOutboxProcessor,
    jobCompletedProcessor: JobCompletedEventOutboxProcessor,
    stuckJobProcessor: StuckJobRecoveryProcessor,
    stuckNotificationProcessor: StuckNotificationRecoveryProcessor,
): () => void {
    // Replaces [DisallowConcurrentExecution] — skip if previous run still in progress
    function schedule(
        fn: () => Promise<void>,
        intervalMs: number,
    ): NodeJS.Timeout {
        let running = false;

        return setInterval(async () => {
            if (running) return;
            running = true;
            try {
                await fn();
            } finally {
                running = false;
            }
        }, intervalMs);
    }

    const timers = [
        schedule(
            () => jobCreatedProcessor.execute(),
            JobCreatedEventOutboxProcessor.intervalInSeconds * 1000,
        ),
        schedule(
            () => jobCompletedProcessor.execute(),
            JobCompletedEventOutboxProcessor.intervalInSeconds * 1000,
        ),
        schedule(
            () => stuckJobProcessor.execute(),
            StuckJobRecoveryProcessor.intervalInSeconds * 1000,
        ),
        schedule(
            () => stuckNotificationProcessor.execute(),
            StuckNotificationRecoveryProcessor.intervalInSeconds * 1000,
        ),
    ];

    // Returns a cleanup function
    return () => timers.forEach(clearInterval);
}