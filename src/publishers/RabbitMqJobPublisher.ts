import * as amqp from "amqplib";
import { RabbitMqPublisherBase } from "./RabbitMqPublisherBase.js";
import { RabbitMqOptions } from "../options.js";
import { AppMetrics } from "../diagnostics/AppMetrics.js";
import { Logger } from "../logger.js";
import { IJobPublisher } from "../abstractions/IJobPublisher.js";



export class RabbitMqJobPublisher extends RabbitMqPublisherBase implements IJobPublisher {
    constructor(
        channel: amqp.ConfirmChannel,
        options: RabbitMqOptions,
        metrics: AppMetrics,
        logger: Logger,
    ) {
        super(channel, options, metrics, logger);
    }
}
