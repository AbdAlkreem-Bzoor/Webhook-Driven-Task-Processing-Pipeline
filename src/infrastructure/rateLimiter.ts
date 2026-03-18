// infrastructure/rateLimiter.ts
// Replaces AddRateLimiting() using express-rate-limit.

import rateLimit from "express-rate-limit";
import { Request, Response } from "express";

const onLimitReached = (_req: Request, res: Response): void => {
    res.status(429).json({ error: "Too many requests. Please try again later." });
};

// Global safety net — 100 req/min per IP
export const globalRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 100,
    keyGenerator: (req: Request) => req.ip ?? "unknown",
    handler: onLimitReached,
});

// Auth endpoints — 10 req/min per IP, prevents brute force
export const authRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    keyGenerator: (req: Request) => req.ip ?? "unknown",
    handler: onLimitReached,
});

// Webhook endpoint — 30 req/min per IP (sourceId is validated inside the handler)
export const webhookRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    keyGenerator: (req: Request) => req.ip ?? "unknown",
    handler: onLimitReached,
});

// Authenticated API — 60 req/min per IP (userId not yet available at middleware level)
export const apiRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    keyGenerator: (req: Request) => req.ip ?? "unknown",
    handler: onLimitReached,
});
