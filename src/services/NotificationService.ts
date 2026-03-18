import { eq, and, countDistinct } from "drizzle-orm";
import { jobs, deliveryAttempts, Subscriber, Job } from "../db/schema.js";
import { AppMetrics } from "../diagnostics/AppMetrics.js";
import { INotificationService } from "../abstractions/INotificationService.js";
import { Logger } from "../logger.js";
import { db } from "../db/index.js";

export class NotificationService implements INotificationService {
    static readonly maxRetries = 3;

    constructor(
        private readonly metrics: AppMetrics,
        private readonly logger: Logger,
    ) {}

    async handleMessageAsync(jobId: string, signal?: AbortSignal): Promise<void> {
        await this.notifySubscribersAsync(jobId, signal);
    }

    async notifySubscribersAsync(jobId: string, signal?: AbortSignal): Promise<void> {
        const claimed = await db
            .update(jobs)
            .set({
                deliveryStatus: 'Dispatching',
                updatedAt: new Date(),
                updatedBy: NotificationService.name,
            })
            .where(
                and(
                    eq(jobs.id, jobId),
                    eq(jobs.status, 'Completed'),
                    eq(jobs.deliveryStatus, 'Pending'),
                ),
            )
            .returning({ id: jobs.id });

        if (claimed.length === 0) {
            this.logger.warn(
                `Job ${jobId} not claimable for notification dispatch ` +
                `(missing, wrong status, or already claimed)`,
            );
            return;
        }

        this.logger.info(`Job ${jobId} claimed for notification dispatch`);

        const job = await db.query.jobs.findFirst({
            where: eq(jobs.id, jobId),
            with: {
                pipeline: { with: { subscribers: true } },
                deliveryAttempts: true,
            },
        });

        if (!job) throw new Error(`Job ${jobId} not found after claim`);

        // Build delivery state per subscriber
        const deliveryState = new Map<string, { succeeded: boolean; attemptsUsed: number }>();

        for (const attempt of job.deliveryAttempts) {
            const current = deliveryState.get(attempt.subscriberId);
            deliveryState.set(attempt.subscriberId, {
                succeeded: current?.succeeded || attempt.success,
                attemptsUsed: Math.max(current?.attemptsUsed ?? 0, attempt.attemptNumber),
            });
        }

        const pendingSubscribers = job.pipeline.subscribers.filter(s => {
            const state = deliveryState.get(s.id);
            if (!state) return true;
            if (state.succeeded) return false;
            if (state.attemptsUsed >= NotificationService.maxRetries) return false;
            return true;
        });

        if (pendingSubscribers.length > 0) {
            this.logger.info(
                `Dispatching notifications for job ${jobId} to ` +
                `${pendingSubscribers.length}/${job.pipeline.subscribers.length} subscriber(s)`,
            );

            await Promise.all(
                pendingSubscribers.map(async subscriber => {
                    const state = deliveryState.get(subscriber.id);
                    const startAttempt = state ? state.attemptsUsed + 1 : 1;

                    try {
                        await this.notifySubscriberAsync(subscriber, job, startAttempt, signal);
                    } catch (error) {
                        if (isAbortError(error)) throw error;
                        this.logger.error(
                            `Unhandled error notifying subscriber ${subscriber.id} (${subscriber.url}) for job ${jobId}`,
                            error,
                        );
                    }
                }),
            );
        }

        const [{ successfulCount }] = await db
            .select({ successfulCount: countDistinct(deliveryAttempts.subscriberId) })
            .from(deliveryAttempts)
            .where(and(eq(deliveryAttempts.jobId, jobId), eq(deliveryAttempts.success, true)));

        const totalSubscribers = job.pipeline.subscribers.length;
        const numSuccessful = Number(successfulCount);

        const deliveryStatus = numSuccessful === totalSubscribers
            ? 'Delivered'
            : numSuccessful > 0
                ? 'PartiallyFailed'
                : 'Failed';

        await db
            .update(jobs)
            .set({
                deliveryStatus,
                updatedAt: new Date(),
                updatedBy: NotificationService.name,
            })
            .where(eq(jobs.id, jobId));

        this.logger.info(
            `Job ${jobId} delivery finished — ${deliveryStatus} (${successfulCount}/${totalSubscribers})`,
        );
    }

    async notifySubscriberAsync(
        subscriber: Subscriber,
        job: Job,
        startAttempt: number,
        signal?: AbortSignal,
    ): Promise<void> {
        for (let attempt = startAttempt; attempt <= NotificationService.maxRetries; attempt++) {
            const start = performance.now();
            let success = false;
            let httpStatusCode: number | undefined;
            let errorMessage: string | undefined;

            try {
                const response = await fetch(subscriber.url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: job.processedPayload!,
                    signal,
                });

                const durationMs = performance.now() - start;
                this.metrics.notificationDeliveryDuration.record(durationMs);

                httpStatusCode = response.status;
                success = response.ok;

                if (response.ok) {
                    this.metrics.notificationsDispatched.add(1, { status: "success" });
                    this.logger.info(
                        `Delivered to ${subscriber.url} for job ${job.id} on attempt ${attempt}`,
                    );
                } else {
                    this.logger.warn(
                        `Delivery to ${subscriber.url} returned ${response.status} ` +
                        `on attempt ${attempt}/${NotificationService.maxRetries}`,
                    );
                }
            } catch (error) {
                if (isAbortError(error)) throw error;

                const durationMs = performance.now() - start;
                this.metrics.notificationDeliveryDuration.record(durationMs);

                errorMessage = error instanceof Error ? error.message : String(error);
                success = false;

                this.logger.warn(
                    `Delivery to ${subscriber.url} failed on attempt ${attempt}/${NotificationService.maxRetries}`,
                    error,
                );
            } finally {
                await db.insert(deliveryAttempts).values({
                    jobId: job.id,
                    subscriberId: subscriber.id,
                    attemptNumber: attempt,
                    success,
                    httpStatusCode: httpStatusCode ?? 0,
                    errorMessage,
                });
            }

            if (success) return;

            if (attempt < NotificationService.maxRetries) {
                const delayMs = Math.pow(2, attempt) * 1000;
                await sleep(delayMs, signal);
            }
        }

        this.metrics.notificationDeliveriesFailed.add(1);
        this.logger.error(
            `Permanently failed: exhausted all ${NotificationService.maxRetries} ` +
            `attempts to ${subscriber.url} for job ${job.id}`,
        );
    }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, ms);
        signal?.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
        });
    });
}

function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === "AbortError";
}