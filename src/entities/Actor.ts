import { integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const actorsTable = pgTable("actors", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar().notNull(),
  avatarKey: varchar(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});

export type Actor = typeof actorsTable.$inferSelect;