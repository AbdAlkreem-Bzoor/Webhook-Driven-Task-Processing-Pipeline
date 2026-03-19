import { Request, Response, NextFunction } from "express";
import { validateJWT, getBearerToken } from "../../authentication.js";
import { configuration } from "../../configuration.js";

export function requireAuth(request: Request, response: Response, next: NextFunction): void {
    try {
        const token = getBearerToken(request);
        const userId = validateJWT(token, configuration.jwt.secret);
        (request as any).userId = userId;
        next();
    } catch {
        response.status(401).json({ error: "Unauthorized" });
    }
}

export function getUserId(request: Request): string | null {
    return (request as any).userId ?? null;
}