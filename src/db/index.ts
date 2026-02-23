import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("需要配置 DATABASE_URL 环境变量");
}

const pool = new Pool({ connectionString });

export const db = drizzle(pool, { schema });
