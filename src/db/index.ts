import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema.js";
import * as relations from "./relations.js";
import { configuration } from "../configuration.js";

const connection = postgres(configuration.db.url);
export const db = drizzle(connection, { schema: { ...schema, ...relations } });