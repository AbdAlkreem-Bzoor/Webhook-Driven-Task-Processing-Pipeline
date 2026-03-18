// infrastructure/container.ts
// Replaces DependencyInjection.cs — the composition root.
// All dependencies are constructed once and shared (singleton by default).

import * as amqp from "amqplib";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { MeterProvider } from "@opentelemetry/sdk-metrics";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

import { configuration } from "../configuration.js";

import { AppMetrics } from "../diagnostics/AppMetrics.js";
import { IdentityService } from "../identity/IdentityService.js";
import { TokenProvider } from "../identity/TokenProvider.js";

import { ValidateAction } from "../processing-actions/ValidateAction.js";
import { TransformAction } from "../processing-actions/TransformAction.js";
import { EnrichAction } from "../processing-actions/EnrichAction.js";

import { ProcessingService } from "../services/ProcessingService.js";
import { NotificationService } from "../services/NotificationService.js";

import { RabbitMqJobPublisher } from "../publishers/RabbitMqJobPublisher.js";
import { RabbitMqNotificationPublisher } from "../publishers/RabbitMqNotificationPublisher.js";
import { RabbitMqJobConsumer } from "../consumers/RabbitMqJobConsumer.js";
import { RabbitMqNotificationConsumer } from "../consumers/RabbitMqNotificationConsumer.js";

import { JobCreatedEventOutboxProcessor } from "../processors/JobCreatedEventOutboxProcessor.js";
import { JobCompletedEventOutboxProcessor } from "../processors/JobCompletedEventOutboxProcessor.js";
import { StuckJobRecoveryProcessor } from "../processors/StuckJobRecoveryProcessor.js";
import { StuckNotificationRecoveryProcessor } from "../processors/StuckNotificationRecoveryProcessor.js";

import { Logger } from "../logger.js";
import { RabbitMqOptions, defaultRabbitMqOptions } from "../options.js";

export interface Container {
    // Services
    identityService: IdentityService;
    tokenProvider: TokenProvider;
    processingService: ProcessingService;
    notificationService: NotificationService;

    // Publishers
    jobPublisher: RabbitMqJobPublisher;
    notificationPublisher: RabbitMqNotificationPublisher;

    // Consumers
    jobConsumer: RabbitMqJobConsumer;
    notificationConsumer: RabbitMqNotificationConsumer;

    // Processors
    jobCreatedProcessor: JobCreatedEventOutboxProcessor;
    jobCompletedProcessor: JobCompletedEventOutboxProcessor;
    stuckJobRecoveryProcessor: StuckJobRecoveryProcessor;
    stuckNotificationRecoveryProcessor: StuckNotificationRecoveryProcessor;

    // Metrics
    metrics: AppMetrics;

    // Teardown
    dispose(): Promise<void>;
}

export async function buildContainer(): Promise<Container> {
    const logger = new Logger();

    // -------------------------------------------------------------------------
    // Observability — replaces AddObservability()
    // -------------------------------------------------------------------------
    const prometheusExporter = new PrometheusExporter({ port: 9464 });

    const meterProvider = new MeterProvider({
        resource: resourceFromAttributes({
       [ATTR_SERVICE_NAME]: 'Zapier.API',
       [ATTR_SERVICE_VERSION]: '1.0.0',
    }),
        readers: [prometheusExporter],
    });

    const metrics = new AppMetrics(meterProvider);

    // -------------------------------------------------------------------------
    // RabbitMQ connection — replaces AddRabbitMqConfiguration()
    // -------------------------------------------------------------------------
    const rabbitConnection = await amqp.connect({
        hostname: configuration.rabbitmq.hostname,
        port: configuration.rabbitmq.port,
        username: configuration.rabbitmq.username,
        password: configuration.rabbitmq.password,
    });

    // -------------------------------------------------------------------------
    // Publishers — replaces AddJobPublisher() / AddNotificationPublisher()
    // -------------------------------------------------------------------------
    const jobPublisher = new RabbitMqJobPublisher(
        await rabbitConnection.createConfirmChannel(),
        buildRabbitMqOptions("jobs"),
        metrics,
        logger,
    );

    const notificationPublisher = new RabbitMqNotificationPublisher(
        await rabbitConnection.createConfirmChannel(),
        buildRabbitMqOptions("notifications"),
        metrics,
        logger,
    );

    // -------------------------------------------------------------------------
    // Identity — replaces AddTransient<IIdentityService> / AddTransient<ITokenProvider>
    // -------------------------------------------------------------------------
    const identityService = new IdentityService();

    const tokenProvider = new TokenProvider(configuration.jwt);

    // -------------------------------------------------------------------------
    // Processing actions — replaces AddSingleton<IProcessingAction, ...>()
    // -------------------------------------------------------------------------
    const processingActions = [
        new ValidateAction(),
        new TransformAction(),
        new EnrichAction(),
    ];

    // -------------------------------------------------------------------------
    // Core services — replaces AddSingleton<IProcessingService> etc.
    // -------------------------------------------------------------------------
    const processingService = new ProcessingService(
        processingActions,
        metrics,
        logger,
    );

    const notificationService = new NotificationService(
        metrics,
        logger,
    );

    // -------------------------------------------------------------------------
    // Consumers — replaces AddJobConsumer() / AddNotificationConsumer()
    // -------------------------------------------------------------------------
    const jobConsumer = new RabbitMqJobConsumer(
        await rabbitConnection.createConfirmChannel(),
        processingService,
        buildRabbitMqOptions("jobs"),
        metrics,
        logger,
    );

    const notificationConsumer = new RabbitMqNotificationConsumer(
        await rabbitConnection.createConfirmChannel(),
        notificationService,
        buildRabbitMqOptions("notifications"),
        metrics,
        logger,
    );

    // -------------------------------------------------------------------------
    // Outbox processors — replaces AddQuartzProcessors()
    // -------------------------------------------------------------------------
    const jobCreatedProcessor = new JobCreatedEventOutboxProcessor(
        jobPublisher,
        metrics,
        logger,
    );

    const jobCompletedProcessor = new JobCompletedEventOutboxProcessor(
        notificationPublisher,
        metrics,
        logger,
    );

    const stuckJobRecoveryProcessor = new StuckJobRecoveryProcessor(
        metrics,
        logger,
    );

    const stuckNotificationRecoveryProcessor = new StuckNotificationRecoveryProcessor(
        metrics,
        logger,
    );

    return {
        identityService,
        tokenProvider,
        processingService,
        notificationService,
        jobPublisher,
        notificationPublisher,
        jobConsumer,
        notificationConsumer,
        jobCreatedProcessor,
        jobCompletedProcessor,
        stuckJobRecoveryProcessor,
        stuckNotificationRecoveryProcessor,
        metrics,

        async dispose() {
            await jobConsumer.unsubscribeAsync();
            await notificationConsumer.unsubscribeAsync();
            await jobPublisher[Symbol.asyncDispose]();
            await notificationPublisher[Symbol.asyncDispose]();
            await rabbitConnection.close();
            await meterProvider.shutdown();
        },
    };
}

// Builds RabbitMqOptions from flat configuration values —
// replaces CreateEndpointOptions()
function buildRabbitMqOptions(endpoint: "jobs" | "notifications"): RabbitMqOptions {
    const base = configuration.rabbitmq;
    const ep = base[endpoint];

    return {
        ...defaultRabbitMqOptions,
        hostName: base.hostname,
        port: base.port,
        userName: base.username,
        password: base.password,
        exchange: {
            ...defaultRabbitMqOptions.exchange,
            exchangeName: ep.exchange,
            routingKey: ep.routingKey,
        },
        queue: {
            ...defaultRabbitMqOptions.queue,
            queueName: ep.queue,
            routingKey: ep.routingKey,
            qos: {
                ...defaultRabbitMqOptions.queue.qos,
                prefetchCount: ep.prefetchCount,
            },
        },
        publish: {
            ...defaultRabbitMqOptions.publish,
        },
        consume: {
            ...defaultRabbitMqOptions.consume,
        },
    };
}