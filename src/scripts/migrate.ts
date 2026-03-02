import { resolve } from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "../db";
import { createLogger } from "../utils/logger";

const logger = createLogger("migrate");

async function main() {
  const migrationsDir = process.env.MIGRATIONS_DIR?.trim() || "drizzle";
  const migrationsFolder = resolve(process.cwd(), migrationsDir);

  logger.info(`开始执行数据库迁移: ${migrationsFolder}`);
  await migrate(db, { migrationsFolder });
  logger.info("数据库迁移完成");
}

try {
  await main();
} catch (error) {
  logger.error(error, "数据库迁移失败");
  process.exitCode = 1;
} finally {
  await pool.end();
}
