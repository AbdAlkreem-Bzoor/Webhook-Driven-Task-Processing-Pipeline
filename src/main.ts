import { buildContainer } from "./infrastructure/container.js";
import { startScheduler } from "./infrastructure/scheduler.js";
import { createApp } from "./app.js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "./db/index.js";
import { configuration } from "./configuration.js";


async function main() {
    await migrate(db, configuration.db.migrationConfiguration);

    const container = await buildContainer();
    const stopScheduler = startScheduler(
        container.jobCreatedProcessor,
        container.jobCompletedProcessor,
        container.stuckJobRecoveryProcessor,
        container.stuckNotificationRecoveryProcessor,
    );

    await container.jobConsumer.subscribeAsync();
    await container.notificationConsumer.subscribeAsync();

    const app = createApp(container);
    const port = configuration.api.port;
    const server = app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });

    const shutdown = async (signal: string) => {
        console.log(`${signal} received — shutting down gracefully`);

        server.close(async () => {
            stopScheduler();
            await container.dispose();
            process.exit(0);
        });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT",  () => shutdown("SIGINT"));
}

main().catch(err => {
    console.error("Fatal startup error:", err);
    process.exit(1);
});