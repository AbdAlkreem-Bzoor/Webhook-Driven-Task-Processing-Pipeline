// JobCompletedEventOutboxProcessor.ts

import { AppMetrics } from "../diagnostics/AppMetrics.js";
import { INotificationPublisher } from "../abstractions/INotificationPublisher.js";
import { OutboxProcessorBase } from "./OutboxProcessorBase.js";
import { EventType } from "../db/schema.js";
import { Logger } from "../logger.js";

export class JobCompletedEventOutboxProcessor extends OutboxProcessorBase {
    static readonly intervalInSeconds = 2;

    protected readonly targetEventType: EventType = 'JobCompleted';

    constructor(
        private readonly notificationPublisher: INotificationPublisher,
        metrics: AppMetrics,
        logger: Logger,
    ) {
        super(metrics, logger);
    }

    protected async publishAsync(jobId: string, signal?: AbortSignal): Promise<void> {
        await this.notificationPublisher.publishAsync(jobId, signal);
    }
}