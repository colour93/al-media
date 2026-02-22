import { integer, pgTable } from "drizzle-orm/pg-core";
import { tagsTable } from "./Tag";
import { relations } from "drizzle-orm";
import { creatorsTable } from "./Creator";

export const creatorTagsTable = pgTable("creator_tags", {
  creatorId: integer()
    .notNull()
    .references(() => creatorsTable.id, {
      onDelete: "cascade",
    }),

  tagId: integer()
    .notNull()
    .references(() => tagsTable.id, {
      onDelete: "cascade",
    }),
});

export const tagCreatorTagsRelations = relations(tagsTable, ({ many }) => ({
  creatorTags: many(creatorTagsTable),
}));

export const creatorTagRelations = relations(creatorTagsTable, ({ one }) => ({
  creator: one(creatorsTable, {
    fields: [creatorTagsTable.creatorId],
    references: [creatorsTable.id],
  }),
  tag: one(tagsTable, {
    fields: [creatorTagsTable.tagId],
    references: [tagsTable.id],
  }),
}));

export type CreatorTag = typeof creatorTagsTable.$inferSelect;
