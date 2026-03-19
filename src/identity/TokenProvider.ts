import jwt, { JwtPayload } from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { refreshTokens } from "../db/schema.js";
import { AppUserDto, TokenResponse } from "./types.js";
import { makeRefreshToken } from "../authentication.js";
import { SecurityTokenError } from "../errors.js";
import { ITokenProvider } from "../abstractions/ITokenProvider.js";
import { db } from "../db/index.js";


interface JwtSettings {
    secret: string;
    issuer: string;
    defaultDuration: number; // in seconds
    refreshDuration: number;
}


export class TokenProvider implements ITokenProvider {
    constructor(
        private readonly jwtSettings: JwtSettings
    ) {}

    async generateJwtTokenAsync(user: AppUserDto, _signal?: AbortSignal): Promise<TokenResponse> {
        const { secret, issuer, defaultDuration, refreshDuration } = this.jwtSettings;

        const issuedAt = Math.floor(Date.now() / 1000);
        const expiresAt = issuedAt + defaultDuration;
        const expiresOnUtc = new Date(expiresAt * 1000);

        const payload: JwtPayload = {
            sub: user.userId,
            email: user.email,
            iss: issuer,
            iat: issuedAt,
            exp: expiresAt,
            roles: user.roles,
            ...user.claims,
        };

        const accessToken = jwt.sign(payload, secret, { algorithm: "HS256" });

        await db
            .delete(refreshTokens)
            .where(eq(refreshTokens.userId, user.userId));

        const refreshToken = makeRefreshToken();
        const refreshExpiresAt = new Date(Date.now() + refreshDuration * 1000);

        await db
            .insert(refreshTokens).values({
                token: refreshToken,
                userId: user.userId,
                expiresAt: refreshExpiresAt,
            });

        return { accessToken, refreshToken, expiresOnUtc };
    }

    getPrincipalFromExpiredToken(token: string): JwtPayload {
        const { secret, issuer } = this.jwtSettings;

        try {
            return jwt.verify(token, secret, {
                issuer,
                algorithms: ["HS256"],
                ignoreExpiration: true,
            }) as JwtPayload;
        } catch {
            throw new SecurityTokenError("Invalid token.");
        }
    }
}