// auth/authRouter.ts

import { Router, Request, Response } from "express";
import { eq, and } from "drizzle-orm";
import { refreshTokens } from "../../db/schema.js";
import { IIdentityService } from "../../abstractions/IIdentityService.js";
import { ITokenProvider } from "../../abstractions/ITokenProvider.js";
import { LoginRequest, RefreshTokenRequest } from "./types.js";
import { db } from "../../db/index.js";

export function createAuthRouter(
    identityService: IIdentityService,
    tokenProvider: ITokenProvider,
): Router {
    const router = Router();

    router.post("/login", async (request: Request, response: Response) => {
        const { email, password } = request.body as LoginRequest;

        try {
            const user = await identityService.authenticateAsync(email, password);
            const tokens = await tokenProvider.generateJwtTokenAsync(user);
            response.status(200).json(tokens);
        } catch {
            response.status(401).json({ error: "Unauthorized" });
        }
    });

    router.post("/refresh", async (request: Request, response: Response) => {
        const { accessToken, refreshToken } = request.body as RefreshTokenRequest;

        let principal;
        try {
            principal = tokenProvider.getPrincipalFromExpiredToken(accessToken);
        } catch {
            response.status(401).json({ error: "Unauthorized" });
            return;
        }

        const userId = principal.sub;
        if (!userId) {
            response.status(401).json({ error: "Unauthorized" });
            return;
        }

        const [storedToken] = await db
            .select()
            .from(refreshTokens)
            .where(and(eq(refreshTokens.token, refreshToken), eq(refreshTokens.userId, userId)))
            .limit(1);

        if (!storedToken || storedToken.revokedAt != null || storedToken.expiresAt < new Date()) {
            response.status(401).json({ error: "Unauthorized" });
            return;
        }

        await db
            .update(refreshTokens)
            .set({ revokedAt: new Date() })
            .where(eq(refreshTokens.token, storedToken.token));

        const user = await identityService.getUserByIdAsync(userId);
        const tokens = await tokenProvider.generateJwtTokenAsync(user);

        response.status(200).json(tokens);
    });

    return router;
}