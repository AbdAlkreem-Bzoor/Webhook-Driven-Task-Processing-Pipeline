import argon2 from "argon2";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import type { JwtPayload } from "jsonwebtoken";

import { UnauthorizedError } from "./errors.js";
import { Request } from "express";

const TOKEN_ISSUER = "zapier";

export async function hashPassword(password: string) {
    return argon2.hash(password);
}

export async function checkPasswordHash(password: string, hash: string) {
    if (!password) return false;
    try {
        return await argon2.verify(hash, password);
    } catch {
        return false;
    }
}

type payload = Pick<JwtPayload, "iss" | "sub" | "iat" | "exp">;

export function makeJWT(userID: string, expiresIn: number, secret: string) {
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + expiresIn;
    const token = jwt.sign(
        {
            iss: TOKEN_ISSUER,
            sub: userID,
            iat: issuedAt,
            exp: expiresAt,
        } satisfies payload,
        secret,
        { algorithm: "HS256" },
    );

    return token;
}

export function validateJWT(tokenString: string, secret: string) {
    let decoded: payload;
    try {
        decoded = jwt.verify(tokenString, secret) as JwtPayload;
    } catch {
        throw new UnauthorizedError("Invalid token");
    }

    if (decoded.iss !== TOKEN_ISSUER) {
        throw new UnauthorizedError("Invalid issuer");
    }

    if (!decoded.sub) {
        throw new UnauthorizedError("No user ID in token");
    }

    return decoded.sub;
}

export function getBearerToken(req: Request) {
    const authHeader = req.get("Authorization");
    if (!authHeader) {
        throw new UnauthorizedError("Malformed authorization header");
    }

    return extractBearerToken(authHeader, "Bearer");
}

export function extractBearerToken(header: string, key: string) {
    const splitAuth = header.split(" ");
    if (splitAuth.length < 2 || splitAuth[0] !== key) {
        throw new UnauthorizedError("Malformed authorization header");
    }
    return splitAuth[1].trim();
}

export function makeRefreshToken() {
    return crypto.randomBytes(32).toString("hex");
}

export function getAPIKey(request: Request) {
    const authHeader = request.get("Authorization");
    if (!authHeader) {
        throw new UnauthorizedError("Malformed authorization header");
    }

    return extractBearerToken(authHeader, "ApiKey");
}