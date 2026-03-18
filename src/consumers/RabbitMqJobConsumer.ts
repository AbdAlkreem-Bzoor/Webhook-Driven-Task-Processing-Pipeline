import amqp from "amqplib";
import { RabbitMqConsumerBase } from "./RabbitMqConsumerBase.js";
import { IJobConsumer } from "../abstractions/IJobConsumer.js";
import { IProcessingService } from "../abstractions/IProcessingService.js";
import {AppMetrics} from "../diagnostics/AppMetrics.js";
import { RabbitMqOptions } from "../options.js";
import { Logger } from "../logger.js";


export class RabbitMqJobConsumer extends RabbitMqConsumerBase implements IJobConsumer {
    constructor(
        channel: amqp.Channel,
        processingService: IProcessingService,
        options: RabbitMqOptions,
        metrics: AppMetrics,
        logger: Logger,
    ) {
        super(channel, processingService, options, metrics, logger);
    }
}

