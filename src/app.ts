import express, { Request, Response, NextFunction } from "express";
import { globalRateLimiter, authRateLimiter, webhookRateLimiter, apiRateLimiter } from "./infrastructure/rateLimiter.js";
import { createAuthRouter } from "./endpoints/auth/authRouter.js";
import { createPipelineRouter } from "./endpoints/pipelines/pipelineRouter.js";
import { createWebhookRouter } from "./endpoints/webhooks/webhookRouter.js";
import { createJobRouter } from "./endpoints/jobs/jobRouter.js";
import { Container } from "./infrastructure/container.js";
import { BadRequestError, UnauthorizedError, NotFoundError, UserForbiddenError } from "./errors.js";

export function createApp(container: Container) {
    const app = express();

    app.use(express.json({
        verify: (request: any, _response, buffer) => {
            request.rawBody = buffer.toString("utf8");
        },
    }));

    app.use(globalRateLimiter);

    app.use("/api/auth",      authRateLimiter,    createAuthRouter(container.identityService, container.tokenProvider));
    app.use("/api/pipelines", apiRateLimiter,     createPipelineRouter());
    app.use("/api/webhooks",  webhookRateLimiter, createWebhookRouter(container.metrics));
    app.use("/api/jobs",      apiRateLimiter,     createJobRouter());

    app.use((error: Error, _request: Request, response: Response, _next: NextFunction) => {
        if (error instanceof BadRequestError) {
            response.status(400).json({ error: error.message });
        } else if (error instanceof UnauthorizedError) {
            response.status(401).json({ error: error.message });
        } else if (error instanceof UserForbiddenError) {
            response.status(403).json({ error: error.message });
        } else if (error instanceof NotFoundError) {
            response.status(404).json({ error: error.message });
        } else {
            console.error("Unhandled error:", error);
            response.status(500).json({ error: "Internal server error" });
        }
    });

    return app;
}
