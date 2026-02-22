import { integer, pgEnum, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { actorsTable } from "./Actor";
import { relations } from "drizzle-orm";
import { creatorTagsTable } from "./CreatorTag";

export const creatorTypeEnum = pgEnum("creator_type", [
  "person",
  "group",
]);

export const creatorPlatformEnum = pgEnum("creator_platform", [
  "onlyfans",
  "justforfans",
  "fansone",
  "fansonly"
]);

export const creatorsTable = pgTable("creators", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar().notNull(),
  actorId: integer().references(() => actorsTable.id, { onDelete: "set null" }),
  type: creatorTypeEnum("type").notNull(),
  platform: creatorPlatformEnum("platform"),
  platformId: varchar(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});

export const creatorRelations = relations(creatorsTable, ({ one, many }) => ({
  actor: one(actorsTable, {
    fields: [creatorsTable.actorId],
    references: [actorsTable.id],
  }),
  creatorTags: many(creatorTagsTable),
}));

export type Creator = typeof creatorsTable.$inferSelect;