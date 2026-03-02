import { relations } from "drizzle-orm";
import { boolean, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { fileDirsTable } from "./FileDir";

export const videoFileIndexStrategiesTable = pgTable("video_file_index_strategies", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  mode: varchar("mode", { length: 20 }).notNull().default("blacklist"),
  fileDirId: integer("file_dir_id").references(() => fileDirsTable.id, { onDelete: "cascade" }),
  fileKeyRegex: varchar("file_key_regex").notNull(),
  enabled: boolean().notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
});

export const videoFileIndexStrategyRelations = relations(videoFileIndexStrategiesTable, ({ one }) => ({
  fileDir: one(fileDirsTable, {
    fields: [videoFileIndexStrategiesTable.fileDirId],
    references: [fileDirsTable.id],
  }),
}));

export type VideoFileIndexStrategy = typeof videoFileIndexStrategiesTable.$inferSelect;
export type NewVideoFileIndexStrategy = typeof videoFileIndexStrategiesTable.$inferInsert;
