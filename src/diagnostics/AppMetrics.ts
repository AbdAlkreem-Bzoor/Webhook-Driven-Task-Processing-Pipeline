import { Meter, MeterProvider, Counter, Histogram } from "@opentelemetry/api";

export class AppMetrics {
    static readonly meterName = "Zapier.API";

    private readonly meter: Meter;

    // Webhooks
    readonly webhooksReceived: Counter;
    readonly webhooksRejected: Counter;

    // Jobs
    readonly jobsProcessed: Counter;
    readonly jobProcessingDuration: Histogram;
    readonly stuckJobsRecovered: Counter;
    readonly stuckNotificationsRecovered: Counter;

    // Notifications
    readonly notificationsDispatched: Counter;
    readonly notificationDeliveriesFailed: Counter;
    readonly notificationDeliveryDuration: Histogram;

    // Outbox
    readonly outboxMessagesPublished: Counter;
    readonly outboxMessagesFailed: Counter;

    // RabbitMQ
    readonly rabbitMqMessagesPublished: Counter;
    readonly rabbitMqMessagesConsumed: Counter;
    readonly rabbitMqMessagesAcked: Counter;
    readonly rabbitMqMessagesNacked: Counter;

    constructor(meterProvider: MeterProvider) {
        this.meter = meterProvider.getMeter(AppMetrics.meterName);

        // Webhooks
        this.webhooksReceived = this.meter.createCounter("zapier.webhooks.received", {
            description: "Total webhooks accepted",
        });

        this.webhooksRejected = this.meter.createCounter("zapier.webhooks.rejected", {
            description: "Total webhooks rejected (auth, validation, duplicate)",
        });

        // Jobs
        this.jobsProcessed = this.meter.createCounter("zapier.jobs.processed", {
            description: "Total jobs processed, tagged by outcome",
        });

        this.jobProcessingDuration = this.meter.createHistogram("zapier.jobs.processing_duration", {
            unit: "ms",
            description: "Job processing time in milliseconds",
        });

        this.stuckJobsRecovered = this.meter.createCounter("zapier.stuck_jobs.recovered", {
            description: "Jobs recovered from stuck Processing state",
        });

        this.stuckNotificationsRecovered = this.meter.createCounter("zapier.stuck_notifications.recovered", {
            description: "Notification dispatches recovered from stuck Dispatching state",
        });

        // Notifications
        this.notificationsDispatched = this.meter.createCounter("zapier.notifications.dispatched", {
            description: "Total notification dispatch attempts",
        });

        this.notificationDeliveriesFailed = this.meter.createCounter("zapier.notifications.deliveries_failed", {
            description: "Subscriber deliveries that exhausted all retries",
        });

        this.notificationDeliveryDuration = this.meter.createHistogram("zapier.notifications.delivery_duration", {
            unit: "ms",
            description: "HTTP delivery time per subscriber",
        });

        // Outbox
        this.outboxMessagesPublished = this.meter.createCounter("zapier.outbox.published", {
            description: "Outbox messages successfully published to RabbitMQ",
        });

        this.outboxMessagesFailed = this.meter.createCounter("zapier.outbox.failed", {
            description: "Outbox messages that hit permanent failure",
        });

        // RabbitMQ
        this.rabbitMqMessagesPublished = this.meter.createCounter("zapier.rabbitmq.published", {
            description: "Messages published to RabbitMQ exchanges",
        });

        this.rabbitMqMessagesConsumed = this.meter.createCounter("zapier.rabbitmq.consumed", {
            description: "Messages received from RabbitMQ queues",
        });

        this.rabbitMqMessagesAcked = this.meter.createCounter("zapier.rabbitmq.acked", {
            description: "Messages acknowledged",
        });

        this.rabbitMqMessagesNacked = this.meter.createCounter("zapier.rabbitmq.nacked", {
            description: "Messages negatively acknowledged",
        });
    }
}