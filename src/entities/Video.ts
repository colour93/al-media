import { integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { videoFilesTable } from "./VideoFile";
import { videoDistributorsTable } from "./VideoDistributor";
import { videoCreatorsTable } from "./VideoCreator";
import { videoActorsTable } from "./VideoActor";
import { videoTagsTable } from "./VideoTag";
import { videoUniqueContentsTable } from "./VideoUniqueContent";

export const videosTable = pgTable("videos", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  title: varchar().notNull(),
  thumbnailKey: varchar(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});

export const videoRelations = relations(videosTable, ({ many }) => ({
  videoFiles: many(videoFilesTable),
  videoDistributors: many(videoDistributorsTable),
  videoCreators: many(videoCreatorsTable),
  videoActors: many(videoActorsTable),
  videoTags: many(videoTagsTable),
  videoUniqueContents: many(videoUniqueContentsTable),
}));

export type Video = typeof videosTable.$inferSelect;