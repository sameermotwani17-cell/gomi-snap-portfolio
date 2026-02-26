import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Only initialize database if DATABASE_URL is configured
// This allows the app to run without a database using MemStorage
let db: ReturnType<typeof drizzle> | null = null;

if (process.env.DATABASE_URL) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle(pool, { schema });
}

// Export a function that throws a helpful error if database is accessed without configuration
export { db };

// Type guard to ensure db is defined before use
if (!db && process.env.DATABASE_URL) {
  throw new Error("Failed to initialize database connection");
}
