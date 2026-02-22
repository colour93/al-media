import { integer, pgTable } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { videosTable } from "./Video";
import { creatorsTable } from "./Creator";

export const videoCreatorsTable = pgTable("video_creators", {
  videoId: integer()
    .notNull()
    .references(() => videosTable.id, {
      onDelete: "cascade",
    }),
  creatorId: integer()
    .notNull()
    .references(() => creatorsTable.id, {
      onDelete: "restrict",
    }),
});

export const videoCreatorRelations = relations(videoCreatorsTable, ({ one }) => ({
  video: one(videosTable, {
    fields: [videoCreatorsTable.videoId],
    references: [videosTable.id],
  }),
  creator: one(creatorsTable, {
    fields: [videoCreatorsTable.creatorId],
    references: [creatorsTable.id],
  }),
}));

export type VideoCreator = typeof videoCreatorsTable.$inferSelect;
