import { relations } from "drizzle-orm";
import { integer, pgTable, primaryKey, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./User";
import { videosTable } from "./Video";

export const userFavoriteVideosTable = pgTable(
  "user_favorite_videos",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    videoId: integer("video_id")
      .notNull()
      .references(() => videosTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [primaryKey({ columns: [table.userId, table.videoId] })]
);

export const userFavoriteVideoRelations = relations(userFavoriteVideosTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [userFavoriteVideosTable.userId],
    references: [usersTable.id],
  }),
  video: one(videosTable, {
    fields: [userFavoriteVideosTable.videoId],
    references: [videosTable.id],
  }),
}));

export type UserFavoriteVideo = typeof userFavoriteVideosTable.$inferSelect;
