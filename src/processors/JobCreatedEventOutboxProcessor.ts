import { AppMetrics } from "../diagnostics/AppMetrics.js";
import { IJobPublisher } from "../abstractions/IJobPublisher.js";
import { OutboxProcessorBase } from "./OutboxProcessorBase.js";
import { EventType } from "../db/schema.js";
import { Logger } from "../logger.js";



export class JobCreatedEventOutboxProcessor extends OutboxProcessorBase {
    static readonly intervalInSeconds = 2;

    protected readonly targetEventType: EventType = 'JobCreated';

    constructor(
        private readonly jobPublisher: IJobPublisher,
        metrics: AppMetrics,
        logger: Logger,
    ) {
        super(metrics, logger);
    }

    protected async publishAsync(jobId: string, signal?: AbortSignal): Promise<void> {
        await this.jobPublisher.publishAsync(jobId, signal);
    }
}