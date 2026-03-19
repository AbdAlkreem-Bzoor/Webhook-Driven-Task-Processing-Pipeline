import * as amqp from "amqplib";
import { RabbitMqPublisherBase } from "./RabbitMqPublisherBase.js";
import { RabbitMqOptions } from "../options.js";
import { AppMetrics } from "../diagnostics/AppMetrics.js";
import { Logger } from "../logger.js";
import { INotificationPublisher } from "../abstractions/INotificationPublisher.js";



export class RabbitMqNotificationPublisher extends RabbitMqPublisherBase implements INotificationPublisher {
    constructor(
        channel: amqp.ConfirmChannel,
        options: RabbitMqOptions,
        metrics: AppMetrics,
        logger: Logger,
    ) {
        super(channel, options, metrics, logger);
    }
}
