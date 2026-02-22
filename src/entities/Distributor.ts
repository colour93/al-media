import { integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const distributorsTable = pgTable("distributors", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar().notNull(),
  domain: varchar(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});

export type Distributor = typeof distributorsTable.$inferSelect;
