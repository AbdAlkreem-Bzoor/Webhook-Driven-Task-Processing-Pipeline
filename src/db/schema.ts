import {pgTable, timestamp, varchar, uuid, boolean} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
    email: varchar("email", { length: 256 }).unique().notNull(),
    hashedPassword: varchar("hashed_password", { length: 256 }).notNull().default("unset"),
    isChirpyRed: boolean("is_chirpy_red").default(false)
});

export type NewUser = typeof users.$inferInsert;


export const refreshTokens = pgTable("refresh_tokens", {
    token: varchar("token", { length: 256 }).primaryKey(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    revokedAt: timestamp("revoked_at")
});

export type NewToken = typeof refreshTokens.$inferInsert;