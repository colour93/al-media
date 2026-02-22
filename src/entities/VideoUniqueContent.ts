import { integer, timestamp, pgTable, varchar } from "drizzle-orm/pg-core";
import { videoFileUniquesTable } from "./VideoFileUnique";
import { videosTable } from "./Video";
import { videoFilesTable } from "./VideoFile";
import { relations } from "drizzle-orm";

export const videoUniqueContentsTable = pgTable("video_unique_contents", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  videoId: integer().notNull().references(() => videosTable.id, {
    onDelete: "cascade",
  }),
  uniqueId: varchar().notNull().references(() => videoFileUniquesTable.uniqueId, {
    onDelete: "cascade",
  }),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});

export const videoUniqueContentsRelations = relations(
  videoUniqueContentsTable,
  ({ one }) => ({
    video: one(videosTable, {
      fields: [videoUniqueContentsTable.videoId],
      references: [videosTable.id],
    }),
    uniqueContent: one(videoFileUniquesTable, {
      fields: [videoUniqueContentsTable.uniqueId],
      references: [videoFileUniquesTable.uniqueId],
    }),
  })
);

export type VideoUniqueContent = typeof videoUniqueContentsTable.$inferSelect;