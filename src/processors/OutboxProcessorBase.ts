// OutboxProcessorBase.ts

import { eq, isNull, lte, lt, or, and } from "drizzle-orm";
import { outboxMessages, EventType, OutboxMessage } from "../db/schema.js";
import { AppMetrics } from "../diagnostics/AppMetrics.js";
import { Logger } from "../logger.js";
import { db } from "../db/index.js";

export abstract class OutboxProcessorBase {
    protected static readonly maxRetries = 5;
    protected static readonly batchSize = 20;

    constructor(
        protected readonly metrics: AppMetrics,
        protected readonly logger: Logger,
    ) {}

    protected abstract readonly targetEventType: EventType;
    protected abstract publishAsync(jobId: string, signal?: AbortSignal): Promise<void>;

    async execute(signal?: AbortSignal): Promise<void> {
        try {
            await this.processPendingMessagesAsync(signal);
        } catch (error) {
            if (isAbortError(error)) throw error;
            this.logger.error(
                `Unhandled error in ${this.constructor.name} outbox processor`,
                error,
            );
        }
    }

    private async processPendingMessagesAsync(signal?: AbortSignal): Promise<void> {
        const now = new Date();

        const messages = await db
            .select()
            .from(outboxMessages)
            .where(
                and(
                    isNull(outboxMessages.processedAt),
                    eq(outboxMessages.eventType, this.targetEventType),
                    lt(outboxMessages.retryCount, OutboxProcessorBase.maxRetries),
                    or(
                        isNull(outboxMessages.nextRetryAt),
                        lte(outboxMessages.nextRetryAt, now),
                    ),
                ),
            )
            .orderBy(outboxMessages.createdAt)
            .limit(OutboxProcessorBase.batchSize);

        for (const message of messages) {
            const jobId = this.tryDeserializeJobId(message);

            if (!jobId) {
                await db
                    .update(outboxMessages)
                    .set(this.markAsPermanentlyFailed(
                        message,
                        `Invalid payload: cannot deserialize a valid job ID from '${message.payload}'`,
                    ))
                    .where(eq(outboxMessages.id, message.id));

                this.metrics.outboxMessagesFailed.add(1, { event_type: this.targetEventType });
                continue;
            }

            try {
                await this.publishAsync(jobId, signal);

                await db
                    .update(outboxMessages)
                    .set({
                        processedAt: new Date(),
                        error: null,
                        updatedBy: this.constructor.name,
                        updatedAt: new Date(),
                    })
                    .where(eq(outboxMessages.id, message.id));

                this.metrics.outboxMessagesPublished.add(1, { event_type: this.targetEventType });
            } catch (error) {
                const update = this.scheduleRetry(message, error);

                await db
                    .update(outboxMessages)
                    .set({
                        ...update,
                        updatedBy: this.constructor.name,
                        updatedAt: new Date(),
                    })
                    .where(eq(outboxMessages.id, message.id));
            }
        }
    }

    private tryDeserializeJobId(message: OutboxMessage): string | null {
        try {
            const jobId = JSON.parse(message.payload) as string;

            if (!jobId) return null;

            this.logger.debug(
                `Deserialized job ID ${jobId} from outbox message ${message.id}`,
            );

            return jobId;
        } catch {
            this.logger.error(
                `Failed to deserialize job ID from outbox message ${message.id} with payload: ${message.payload}`,
            );

            return null;
        }
    }

    private markAsPermanentlyFailed(
        message: OutboxMessage,
        reason: string,
    ): Partial<OutboxMessage> {
        this.logger.error(`Outbox message ${message.id} permanently failed: ${reason}`);

        return {
            processedAt: new Date(),
            retryCount: OutboxProcessorBase.maxRetries,
            error: `[PERMANENT] ${reason}`,
        };
    }

    private scheduleRetry(
        message: OutboxMessage,
        error: unknown,
    ): Partial<OutboxMessage> {
        const retryCount = message.retryCount + 1;
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (retryCount >= OutboxProcessorBase.maxRetries) {
            this.metrics.outboxMessagesFailed.add(1, { event_type: this.targetEventType });

            this.logger.error(
                `Outbox message ${message.id} exhausted all ${OutboxProcessorBase.maxRetries} retries — abandoned. ` +
                `Associated job will remain Queued until manual intervention.`,
                error,
            );

            return { retryCount, error: errorMessage };
        }

        const delaySeconds = Math.pow(2, retryCount);
        const nextRetryAt = new Date(Date.now() + delaySeconds * 1000);

        this.logger.warn(
            `Outbox message ${message.id} failed (attempt ${retryCount}/${OutboxProcessorBase.maxRetries}), ` +
            `next retry at ${nextRetryAt.toISOString()}`,
            error,
        );

        return { retryCount, error: errorMessage, nextRetryAt };
    }
}

function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === "AbortError";
}