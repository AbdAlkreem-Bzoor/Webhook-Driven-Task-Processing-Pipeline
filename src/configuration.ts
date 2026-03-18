import type { MigrationConfig } from "drizzle-orm/migrator";

type Configuration = {
    api: APIConfiguration;
    db: DBConfiguration;
    jwt: JWTConfiguration;
    rabbitmq: RabbitMQConfiguration;
};

type APIConfiguration = {
    fileServerHits: number;
    port: number;
    platform: string;
    webhookKey: string;
};

type DBConfiguration = {
    url: string;
    migrationConfiguration: MigrationConfig;
};

type JWTConfiguration = {
    defaultDuration: number;
    refreshDuration: number;
    secret: string;
    issuer: string;
};

type RabbitMQConfiguration = {
    hostname: string;
    port: number;
    username: string;
    password: string;
    jobs: {
      exchange: string;
      queue: string;
      routingKey: string;
      prefetchCount: number;
    },
    notifications: {
      exchange: string;
      queue: string;
      routingKey: string;
      prefetchCount: number;
    }
};

import { existsSync } from "fs";

if (existsSync(".env")) {
    process.loadEnvFile();
}

function envOrThrow(key: string) {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Environment variable ${key} is not set`);
    }
    return value;
}

const migrationConfiguration: MigrationConfig = {
    migrationsFolder: "./drizzle",
};

export const configuration: Configuration = {
    api: {
        fileServerHits: 0,
        port: Number(envOrThrow("PORT")),
        platform: envOrThrow("PLATFORM"),
        webhookKey: envOrThrow("WEBHOOK_KEY")
    },
    db: {
        url: envOrThrow("DB_URL"),
        migrationConfiguration: migrationConfiguration,
    },
    jwt: {
        defaultDuration: 60 * 60, // 1 hour in seconds
        refreshDuration: 60 * 60 * 24 * 60, // 60 days in seconds
        secret: envOrThrow("JWT_SECRET"),
        issuer: "zapier",
    },
    rabbitmq: {
        hostname: envOrThrow("RABBITMQ_HOSTNAME"),
        port: Number(envOrThrow("RABBITMQ_PORT")),
        username: envOrThrow("RABBITMQ_USERNAME"),
        password: envOrThrow("RABBITMQ_PASSWORD"),
        jobs: {
            exchange: envOrThrow("RABBITMQ_JOBS_EXCHANGE"),
            queue: envOrThrow("RABBITMQ_JOBS_QUEUE"),
            routingKey: envOrThrow("RABBITMQ_JOBS_ROUTING_KEY"),
            prefetchCount: Number(envOrThrow("RABBITMQ_JOBS_PREFETCH_COUNT"))
        },
        notifications: {
            exchange: envOrThrow("RABBITMQ_NOTIFICATIONS_EXCHANGE"),
            queue: envOrThrow("RABBITMQ_NOTIFICATIONS_QUEUE"),
            routingKey: envOrThrow("RABBITMQ_NOTIFICATIONS_ROUTING_KEY"),
            prefetchCount: Number(envOrThrow("RABBITMQ_NOTIFICATIONS_PREFETCH_COUNT"))
        }
    }
};