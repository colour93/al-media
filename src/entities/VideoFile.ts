import { relations } from "drizzle-orm";
import { AnyPgColumn, bigint, boolean, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { fileDirsTable } from "./FileDir";
import { videoFileUniquesTable } from "./VideoFileUnique";

export const videoFilesTable = pgTable("video_files", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  // videoId: integer().references(() => videosTable.id, { onDelete: "set null" }),
  fileDirId: integer().references(() => fileDirsTable.id, { onDelete: "cascade" }),
  sourceVideoFileId: integer("source_video_file_id").references((): AnyPgColumn => videoFilesTable.id, {
    onDelete: "set null",
  }),
  fileKey: varchar().notNull(),
  uniqueId: varchar().notNull().references(() => videoFileUniquesTable.uniqueId, {
    onDelete: 'cascade'
  }),
  fileSize: bigint("file_size", { mode: "number" }).notNull(),
  fileModifiedAt: timestamp().notNull(),
  videoDuration: bigint("video_duration", { mode: "number" }).notNull(),
  videoCodec: varchar("video_codec", { length: 64 }),
  audioCodec: varchar("audio_codec", { length: 64 }),
  mp4MoovAtomOffset: bigint("mp4_moov_atom_offset", { mode: "number" }),
  mp4MdatAtomOffset: bigint("mp4_mdat_atom_offset", { mode: "number" }),
  mp4MoovBeforeMdat: boolean("mp4_moov_before_mdat"),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});

export const videoFileRelations = relations(videoFilesTable, ({ one, many }) => ({
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
  sourceVideoFile: one(videoFilesTable, {
    fields: [videoFilesTable.sourceVideoFileId],
    references: [videoFilesTable.id],
    relationName: "video_file_source",
  }),
  reencodedVideoFiles: many(videoFilesTable, {
    relationName: "video_file_source",
  }),
}));

export type VideoFile = typeof videoFilesTable.$inferSelect;
