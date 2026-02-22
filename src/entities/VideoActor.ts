import { integer, pgTable } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { videosTable } from "./Video";
import { actorsTable } from "./Actor";

export const videoActorsTable = pgTable("video_actors", {
  videoId: integer()
    .notNull()
    .references(() => videosTable.id, {
      onDelete: "cascade",
    }),
  actorId: integer()
    .notNull()
    .references(() => actorsTable.id, {
      onDelete: "restrict",
    }),
});

export const videoActorRelations = relations(videoActorsTable, ({ one }) => ({
  video: one(videosTable, {
    fields: [videoActorsTable.videoId],
    references: [videosTable.id],
  }),
  actor: one(actorsTable, {
    fields: [videoActorsTable.actorId],
    references: [actorsTable.id],
  }),
}));

export type VideoActor = typeof videoActorsTable.$inferSelect;
