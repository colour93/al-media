import { relations } from "drizzle-orm";
import { pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { videoFilesTable } from "./VideoFile";
import { videoUniqueContentsTable } from "./VideoUniqueContent";

export const videoFileUniquesTable = pgTable("video_file_uniques", {
  uniqueId: varchar().notNull().primaryKey(),
  updatedAt: timestamp().notNull().defaultNow(),
  createdAt: timestamp().notNull().defaultNow(),
});

export const videoFileUniqueRelations = relations(
  videoFileUniquesTable,
  ({ many }) => ({
    videoFiles: many(videoFilesTable),
    videoUniqueContents: many(videoUniqueContentsTable),
  })
);

export type VideoFileUnique = typeof videoFileUniquesTable.$inferSelect;