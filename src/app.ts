// app.ts
// Replaces Program.cs — wires up Express and applies middleware.

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

    // Raw body for webhook signature verification
    app.use(express.json({
        verify: (req: any, _res, buf) => {
            req.rawBody = buf.toString("utf8");
        },
    }));

    // Global rate limiter — applied to all routes
    app.use(globalRateLimiter);

    // Routers with their rate limiters
    app.use("/api/auth",      authRateLimiter,    createAuthRouter(container.identityService, container.tokenProvider));
    app.use("/api/pipelines", apiRateLimiter,     createPipelineRouter());
    app.use("/api/webhooks",  webhookRateLimiter, createWebhookRouter(container.metrics));
    app.use("/api/jobs",      apiRateLimiter,     createJobRouter());

    // Global error-handling middleware
    app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
        if (err instanceof BadRequestError) {
            res.status(400).json({ error: err.message });
        } else if (err instanceof UnauthorizedError) {
            res.status(401).json({ error: err.message });
        } else if (err instanceof UserForbiddenError) {
            res.status(403).json({ error: err.message });
        } else if (err instanceof NotFoundError) {
            res.status(404).json({ error: err.message });
        } else {
            console.error("Unhandled error:", err);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    return app;
}
