import amqp from "amqplib";
import { RabbitMqConsumerBase } from "./RabbitMqConsumerBase.js";
import { INotificationService } from "../abstractions/INotificationService.js";
import { INotificationConsumer } from "../abstractions/INotificationConsumer.js";
import {AppMetrics} from "../diagnostics/AppMetrics.js";
import {Logger} from "../logger.js";
import {RabbitMqOptions} from "../options.js";


export class RabbitMqNotificationConsumer extends RabbitMqConsumerBase implements INotificationConsumer {
    constructor(
        channel: amqp.Channel,
        notificationService: INotificationService,
        options: RabbitMqOptions,
        metrics: AppMetrics,
        logger: Logger,
    ) {
        super(channel, notificationService, options, metrics, logger);
    }
}