import { relations } from "drizzle-orm";
import { integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const tagTypesTable = pgTable("tag_types", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar().notNull(),
  icon: varchar(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});

export const tagsTable = pgTable("tags", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar().notNull(),
  tagTypeId: integer().references(() => tagTypesTable.id, { onDelete: "restrict" }).notNull(),
  color: varchar(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});

export const tagTypesRelations = relations(tagTypesTable, ({ many }) => ({
  tags: many(tagsTable),
}));

export const tagRelations = relations(tagsTable, ({ one }) => ({
  tagType: one(tagTypesTable, {
    fields: [tagsTable.tagTypeId],
    references: [tagTypesTable.id],
  }),
}));

export type TagType = typeof tagTypesTable.$inferSelect;
export type Tag = typeof tagsTable.$inferSelect;