import rateLimit from "express-rate-limit";
import { Request, Response } from "express";

const onLimitReached = (_request: Request, response: Response): void => {
    response.status(429).json({ error: "Too many requests. Please try again later." });
};

export const globalRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 100,
    keyGenerator: (request: Request) => request.ip ?? "unknown",
    handler: onLimitReached,
});

export const authRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    keyGenerator: (request: Request) => request.ip ?? "unknown",
    handler: onLimitReached,
});

export const webhookRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    keyGenerator: (request: Request) => request.ip ?? "unknown",
    handler: onLimitReached,
});

export const apiRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    keyGenerator: (request: Request) => request.ip ?? "unknown",
    handler: onLimitReached,
});
