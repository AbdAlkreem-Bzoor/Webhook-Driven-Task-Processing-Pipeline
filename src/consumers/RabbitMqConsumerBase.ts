import amqp from "amqplib";
import { IMessageHandler } from "../abstractions/IMessageHandler.js";
import {AppMetrics} from "../diagnostics/AppMetrics.js";
import { RabbitMqOptions } from "../options.js";
import { Logger } from "../logger.js";


interface JobMessage {
    jobId: string;
}

export abstract class RabbitMqConsumerBase implements AsyncDisposable {
    private consumerTag: string | null = null;
    private isListening = false;

    constructor(
        private readonly channel: amqp.Channel,
        private readonly handler: IMessageHandler,
        private readonly options: RabbitMqOptions,
        private readonly metrics: AppMetrics,
        private readonly logger: Logger,
    ) {}

    private async declareExchangeAsync(): Promise<void> {
        const { exchangeName, type, durable, autoDelete, arguments: args } = this.options.exchange;
        await this.channel.assertExchange(exchangeName, type, { durable, autoDelete, arguments: args });
    }

    private async configureQosAsync(): Promise<void> {
        const { prefetchCount, global } = this.options.queue.qos;
        await this.channel.prefetch(prefetchCount, global);
    }

    private async declareQueueAsync(): Promise<void> {
        const { queueName, durable, exclusive, autoDelete, arguments: args } = this.options.queue;
        await this.channel.assertQueue(queueName, { durable, exclusive, autoDelete, arguments: args });
    }

    private async bindQueueAsync(): Promise<void> {
        const { queueName, routingKey } = this.options.queue;
        const { exchangeName } = this.options.exchange;
        await this.channel.bindQueue(queueName, exchangeName, routingKey);
    }

    async subscribeAsync(signal?: AbortSignal): Promise<void> {
        if (this.isListening) return;

        await this.declareExchangeAsync();
        await this.configureQosAsync();
        await this.declareQueueAsync();
        await this.bindQueueAsync();

        const { queueName } = this.options.queue;
        const { autoAck } = this.options.consume;

        const { consumerTag } = await this.channel.consume(
            queueName,
            async (message: amqp.ConsumeMessage | null) => {
                if (!message) return;

                const jobId = this.tryDeserializeMessage(message.content);

                if (!jobId) {
                    this.logger.error(
                        `Poison message on ${queueName} (delivery ${message.fields.deliveryTag}): ` +
                        `cannot deserialize a valid job ID — ACK'd to discard`,
                    );
                    await this.ackAsync(message);
                    return;
                }

                this.metrics.rabbitMqMessagesConsumed.add(1, { queue: queueName });

                try {
                    await this.handler.handleMessageAsync(jobId, signal);
                    await this.ackAsync(message);
                    this.metrics.rabbitMqMessagesAcked.add(1, { queue: queueName });
                } catch (error) {
                    this.logger.error(
                        `Failed to process job ${jobId} from ${queueName} — NACK with requeue`,
                        error,
                    );
                    await this.nackAsync(message);
                    this.metrics.rabbitMqMessagesNacked.add(1, { queue: queueName });
                }
            },
            { noAck: autoAck },
        );

        this.consumerTag = consumerTag;
        this.isListening = true;

        this.logger.info(
            `Subscribed to ${queueName} (consumer: ${consumerTag}, prefetch: ${this.options.queue.qos.prefetchCount})`,
        );
    }

    async unsubscribeAsync(_signal?: AbortSignal): Promise<void> {
        if (!this.isListening || !this.consumerTag || !this.channel) return;

        await this.channel.cancel(this.consumerTag);

        this.isListening = false;
        this.consumerTag = null;

        this.logger.info("Unsubscribed from job queue");
    }

    private tryDeserializeMessage(body: Buffer): string | null {
        try {
            const message: JobMessage = JSON.parse(body.toString());

            if (!message?.jobId) return null;

            this.logger.debug(`Received job ${message.jobId} from queue`);

            return message.jobId;
        } catch (error) {
            this.logger.error(`Failed to deserialize message body as JobMessage: ${body.toString()}`, error);
            return null;
        }
    }

    private async ackAsync(message: amqp.ConsumeMessage): Promise<void> {
        try {
            this.channel.ack(message, this.options.queue.ack.multiple);
        } catch (error) {
            this.logger.warn(
                `Failed to ACK delivery ${message.fields.deliveryTag} — channel may be closed`,
                error,
            );
        }
    }

    private async nackAsync(message: amqp.ConsumeMessage): Promise<void> {
        try {
            this.channel.nack(
                message,
                this.options.queue.nack.multiple,
                this.options.queue.nack.requeue,
            );
        } catch (error) {
            this.logger.warn(
                `Failed to NACK delivery ${message.fields.deliveryTag} — channel may be closed`,
                error,
            );
        }
    }

    async [Symbol.asyncDispose](): Promise<void> {
        if (this.channel) {
            try {
                await this.channel.close();
            } catch (error) {
                this.logger.warn("Error closing consumer channel", error);
            }
        }
    }
}