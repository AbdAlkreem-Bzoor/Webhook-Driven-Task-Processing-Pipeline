// IdentityService.ts
import { eq } from "drizzle-orm";
import { users, userRoles, userClaims } from "../db/schema.js";
import { AppUserDto } from "./types.js";
import { checkPasswordHash } from "../authentication.js";
import { UnauthorizedError, NotFoundError } from "../errors.js";
import { IIdentityService } from "../abstractions/IIdentityService.js";
import { db } from "../db/index.js";

export class IdentityService implements IIdentityService {
    constructor() {}

    async isInRoleAsync(userId: string, role: string): Promise<boolean> {
        const result = await db
            .select()
            .from(userRoles)
            .where(eq(userRoles.userId, userId));

        return result.some(r => r.name === role);
    }

    async authorizeAsync(userId: string, policyName?: string): Promise<boolean> {
        if (!policyName) {
            return false;
        }

        return this.isInRoleAsync(userId, policyName);
    }

    async authenticateAsync(email: string, password: string): Promise<AppUserDto> {
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

        if (!user) {
            throw new UnauthorizedError("Invalid credentials.");
        }

        if (!await checkPasswordHash(password, user.hashedPassword)) {
            throw new UnauthorizedError("Invalid credentials.");
        }

        return this.toDto(user);
    }

    async getUserByIdAsync(userId: string): Promise<AppUserDto> {
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user){
            throw new NotFoundError(`User ${userId} not found.`);
        }

        return this.toDto(user);
    }

    async getUserNameAsync(userId: string): Promise<string | null> {
        const [user] = await db
            .select({ username: users.name })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        return user?.username ?? null;
    }

    private async toDto(user: typeof users.$inferSelect): Promise<AppUserDto> {
        const roles = await db
            .select()
            .from(userRoles)
            .where(eq(userRoles.userId, user.id));

        const claims = await db
            .select()
            .from(userClaims)
            .where(eq(userClaims.userId, user.id));

        return {
            userId: user.id,
            email: user.email,
            roles: roles.map(r => r.name),
            claims: Object.fromEntries(claims.map(c => [c.type, c.value])),
        };
    }
}