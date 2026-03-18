// options.ts

export enum DeliveryMode {
    Transient = 1,
    Persistent = 2,
}

export interface ChannelOptions {
    publisherConfirmationsEnabled: boolean;
    publisherConfirmationTrackingEnabled: boolean;
}

export interface ExchangeOptions {
    exchangeName: string;
    type: string;
    durable: boolean;
    autoDelete: boolean;
    routingKey: string;
    arguments?: Record<string, unknown>;
}

export interface QosOptions {
    prefetchSize: number;
    prefetchCount: number;
    global: boolean;
}

export interface AckOptions {
    multiple: boolean;
}

export interface NackOptions {
    multiple: boolean;
    requeue: boolean;
}

export interface PublishOptions {
    expiration?: string;
    deliveryMode: DeliveryMode;
    priority: number;
    messageId?: string;
    replyTo?: string;
    type?: string;
    appId?: string;
    headers?: Record<string, unknown>;
    mandatory: boolean;
}

export interface ConsumeOptions {
    autoAck: boolean;
}

export interface QueueOptions {
    queueName: string;
    durable: boolean;
    exclusive: boolean;
    autoDelete: boolean;
    routingKey: string;
    arguments?: Record<string, unknown>;
    qos: QosOptions;
    ack: AckOptions;
    nack: NackOptions;
}

export interface EndpointConfig {
    exchange: ExchangeOptions;
    queue: QueueOptions;
    publish: PublishOptions;
    consume: ConsumeOptions;
}

export interface RabbitMqOptions {
    hostName: string;
    port: number;
    userName: string;
    password: string;
    channel: ChannelOptions;
    exchange: ExchangeOptions;
    queue: QueueOptions;
    publish: PublishOptions;
    consume: ConsumeOptions;
    jobs: EndpointConfig;
    notifications: EndpointConfig;
}

export const defaultRabbitMqOptions: RabbitMqOptions = {
    hostName: "localhost",
    port: 5672,
    userName: "guest",
    password: "guest",
    channel: {
        publisherConfirmationsEnabled: true,
        publisherConfirmationTrackingEnabled: true,
    },
    exchange: {
        exchangeName: "default_exchange",
        type: "direct",
        durable: true,
        autoDelete: false,
        routingKey: "default_queue",
    },
    queue: {
        queueName: "default_queue",
        durable: true,
        exclusive: false,
        autoDelete: false,
        routingKey: "default_queue",
        qos: { prefetchSize: 0, prefetchCount: 1, global: false },
        ack: { multiple: false },
        nack: { multiple: false, requeue: true },
    },
    publish: {
        deliveryMode: DeliveryMode.Persistent,
        priority: 0,
        mandatory: false,
    },
    consume: {
        autoAck: false,
    },
    jobs: {
        exchange: {
            exchangeName: "default_exchange",
            type: "direct",
            durable: true,
            autoDelete: false,
            routingKey: "default_queue",
        },
        queue: {
            queueName: "default_queue",
            durable: true,
            exclusive: false,
            autoDelete: false,
            routingKey: "default_queue",
            qos: { prefetchSize: 0, prefetchCount: 1, global: false },
            ack: { multiple: false },
            nack: { multiple: false, requeue: true },
        },
        publish: {
            deliveryMode: DeliveryMode.Persistent,
            priority: 0,
            mandatory: false,
        },
        consume: { autoAck: false },
    },
    notifications: {
        exchange: {
            exchangeName: "default_exchange",
            type: "direct",
            durable: true,
            autoDelete: false,
            routingKey: "default_queue",
        },
        queue: {
            queueName: "default_queue",
            durable: true,
            exclusive: false,
            autoDelete: false,
            routingKey: "default_queue",
            qos: { prefetchSize: 0, prefetchCount: 1, global: false },
            ack: { multiple: false },
            nack: { multiple: false, requeue: true },
        },
        publish: {
            deliveryMode: DeliveryMode.Persistent,
            priority: 0,
            mandatory: false,
        },
        consume: { autoAck: false },
    },
};