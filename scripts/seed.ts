// scripts/seed.ts
// Run: npx tsx scripts/seed.ts

import { db } from "../src/db/index.js";
import { users } from "../src/db/schema.js";
import { hashPassword } from "../src/authentication.js";

async function seed() {
    console.log("Seeding database...");

    const hashedPassword = await hashPassword("password123");

    const [user] = await db
        .insert(users)
        .values({
            name: "Test User",
            email: "test@example.com",
            hashedPassword,
        })
        .onConflictDoNothing()
        .returning();

    if (user) {
        console.log("Created test user:", user.email);
    } else {
        console.log("Test user already exists");
    }

    console.log("\nTest credentials:");
    console.log("  Email: test@example.com");
    console.log("  Password: password123");

    process.exit(0);
}

seed().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});
