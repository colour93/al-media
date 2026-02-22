import { boolean, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const fileDirsTable = pgTable("file_dirs", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  path: varchar().notNull().unique(),
  enabled: boolean().notNull().default(true),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow().$onUpdate(() => new Date()),
});

export type FileDir = typeof fileDirsTable.$inferSelect;
