import { integer, pgTable } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { videosTable } from "./Video";
import { distributorsTable } from "./Distributor";

export const videoDistributorsTable = pgTable("video_distributors", {
  videoId: integer()
    .notNull()
    .references(() => videosTable.id, {
      onDelete: "cascade",
    }),
  distributorId: integer()
    .notNull()
    .references(() => distributorsTable.id, {
      onDelete: "restrict",
    }),
});

export const videoDistributorRelations = relations(videoDistributorsTable, ({ one }) => ({
  video: one(videosTable, {
    fields: [videoDistributorsTable.videoId],
    references: [videosTable.id],
  }),
  distributor: one(distributorsTable, {
    fields: [videoDistributorsTable.distributorId],
    references: [distributorsTable.id],
  }),
}));

export type VideoDistributor = typeof videoDistributorsTable.$inferSelect;
