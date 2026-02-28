import { relations } from "drizzle-orm";
import { boolean, integer, pgTable, primaryKey, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./User";
import { videosTable } from "./Video";

export const userVideoHistoriesTable = pgTable(
  "user_video_histories",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    videoId: integer("video_id")
      .notNull()
      .references(() => videosTable.id, { onDelete: "cascade" }),
    progressSeconds: integer("progress_seconds").notNull().default(0),
    playCount: integer("play_count").notNull().default(0),
    durationSeconds: integer("duration_seconds"),
    completed: boolean("completed").notNull().default(false),
    lastPlayedAt: timestamp("last_played_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [primaryKey({ columns: [table.userId, table.videoId] })]
);

export const userVideoHistoryRelations = relations(userVideoHistoriesTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [userVideoHistoriesTable.userId],
    references: [usersTable.id],
  }),
  video: one(videosTable, {
    fields: [userVideoHistoriesTable.videoId],
    references: [videosTable.id],
  }),
}));

export type UserVideoHistory = typeof userVideoHistoriesTable.$inferSelect;
