import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";

const connectionString = process.env.DATABASE_URL ?? "postgres://borne:borne@localhost:5432/borne_crm";

export const client = postgres(connectionString);
export const db = drizzle(client, { schema });
