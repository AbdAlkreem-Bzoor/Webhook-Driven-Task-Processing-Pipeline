import * as amqp from "amqplib";
import { RabbitMqOptions } from "../options.js";
import { AppMetrics } from "../diagnostics/AppMetrics.js";
import { Logger } from "../logger.js";



export abstract class RabbitMqPublisherBase implements AsyncDisposable {
    private exchangeDeclared = false;

    constructor(
        private readonly channel: amqp.ConfirmChannel,
        private readonly options: RabbitMqOptions,
        private readonly metrics: AppMetrics,
        private readonly logger: Logger,
    ) {}

    private async declareExchangeAsync(): Promise<void> {
        if (this.exchangeDeclared) return;

        const { exchangeName, type, durable, autoDelete, arguments: args } = this.options.exchange;

        await this.channel.assertExchange(exchangeName, type, { durable, autoDelete, arguments: args });

        this.exchangeDeclared = true;
    }

    async publishAsync(jobId: string, _signal?: AbortSignal): Promise<void> {
        try {
            await this.declareExchangeAsync();

            const body = Buffer.from(JSON.stringify({ jobId }));

            const { exchangeName, routingKey } = this.options.exchange;
            const publish = this.options.publish;

            this.channel.publish(exchangeName, routingKey, body, {
                expiration: publish.expiration,
                deliveryMode: publish.deliveryMode,
                priority: publish.priority,
                messageId: crypto.randomUUID(),
                timestamp: Math.floor(Date.now() / 1000),
                correlationId: jobId,
                replyTo: publish.replyTo ?? undefined,
                type: publish.type ?? undefined,
                appId: publish.appId ?? undefined,
                headers: publish.headers,
                mandatory: publish.mandatory,
            });

            await this.channel.waitForConfirms();

            this.metrics.rabbitMqMessagesPublished.add(1, { exchange: exchangeName });
        }
        catch (error) {
            this.logger.error(
                `Failed to publish message to exchange ${this.options.exchange.exchangeName} for job ${jobId}`,
                error,
            );
            throw error;
        }
    }

    async [Symbol.asyncDispose](): Promise<void> {
       if (this.channel) {
            try {
                await this.channel.close();
            } catch (error) {
                this.logger.warn("Error closing publisher channel", error);
            }
        }
    }
}
