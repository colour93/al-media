import { integer, pgTable } from "drizzle-orm/pg-core";
import { tagsTable } from "./Tag";
import { relations } from "drizzle-orm";
import { videosTable } from "./Video";

export const videoTagsTable = pgTable("video_tags", {
  videoId: integer()
    .notNull()
    .references(() => videosTable.id, {
      onDelete: "cascade",
    }),

  tagId: integer()
    .notNull()
    .references(() => tagsTable.id, {
      onDelete: "cascade",
    }),
});

export const videoTagRelations = relations(videoTagsTable, ({ one }) => ({
  video: one(videosTable, {
    fields: [videoTagsTable.videoId],
    references: [videosTable.id],
  }),
  tag: one(tagsTable, {
    fields: [videoTagsTable.tagId],
    references: [tagsTable.id],
  }),
}));

export type VideoTag = typeof videoTagsTable.$inferSelect;
