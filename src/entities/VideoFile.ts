import { relations } from "drizzle-orm";
import { bigint, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { videosTable } from "./Video";
import { fileDirsTable } from "./FileDir";
import { videoFileUniquesTable } from "./VideoFileUnique";

export const videoFilesTable = pgTable("video_files", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  // videoId: integer().references(() => videosTable.id, { onDelete: "set null" }),
  fileDirId: integer().references(() => fileDirsTable.id, { onDelete: "cascade" }),
  fileKey: varchar().notNull(),
  uniqueId: varchar().notNull().references(() => videoFileUniquesTable.uniqueId, {
    onDelete: 'cascade'
  }),
  fileSize: bigint("file_size", { mode: "number" }).notNull(),
  fileModifiedAt: timestamp().notNull(),
  videoDuration: bigint("video_duration", { mode: "number" }).notNull(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});

export const videoFileRelations = relations(videoFilesTable, ({ one }) => ({
  // video: one(videosTable, {
  //   fields: [videoFilesTable.videoId],
  //   references: [videosTable.id],
  // }),
  fileDir: one(fileDirsTable, {
    fields: [videoFilesTable.fileDirId],
    references: [fileDirsTable.id],
  }),
  videoFileUnique: one(videoFileUniquesTable, {
    fields: [videoFilesTable.uniqueId],
    references: [videoFileUniquesTable.uniqueId],
  }),
}));

export type VideoFile = typeof videoFilesTable.$inferSelect;
