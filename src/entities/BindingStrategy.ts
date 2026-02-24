import { relations } from "drizzle-orm";
import { boolean, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { fileDirsTable } from "./FileDir";

export const bindingStrategiesTable = pgTable("binding_strategies", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  type: varchar("type", { length: 20 }).notNull(), // 'folder' | 'regex'
  fileDirId: integer("file_dir_id")
    .notNull()
    .references(() => fileDirsTable.id, { onDelete: "cascade" }),
  folderPath: varchar("folder_path"),
  filenameRegex: varchar("filename_regex"),
  tagIds: integer("tag_ids")
    .array()
    .notNull()
    .default(sql`ARRAY[]::integer[]`),
  creatorIds: integer("creator_ids")
    .array()
    .notNull()
    .default(sql`ARRAY[]::integer[]`),
  actorIds: integer("actor_ids")
    .array()
    .notNull()
    .default(sql`ARRAY[]::integer[]`),
  enabled: boolean().notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
});

export const bindingStrategyRelations = relations(bindingStrategiesTable, ({ one }) => ({
  fileDir: one(fileDirsTable, {
    fields: [bindingStrategiesTable.fileDirId],
    references: [fileDirsTable.id],
  }),
}));

export type BindingStrategy = typeof bindingStrategiesTable.$inferSelect;
export type NewBindingStrategy = typeof bindingStrategiesTable.$inferInsert;
