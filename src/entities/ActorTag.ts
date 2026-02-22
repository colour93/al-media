import { integer, pgTable } from "drizzle-orm/pg-core";
import { tagsTable } from "./Tag";
import { relations } from "drizzle-orm";
import { actorsTable } from "./Actor";

export const actorTagsTable = pgTable("actor_tags", {
  actorId: integer()
    .notNull()
    .references(() => actorsTable.id, {
      onDelete: "cascade",
    }),

  tagId: integer()
    .notNull()
    .references(() => tagsTable.id, {
      onDelete: "cascade",
    }),
});

export const actorActorTagsRelations = relations(actorsTable, ({ many }) => ({
  actorTags: many(actorTagsTable),
}));

export const tagActorTagsRelations = relations(tagsTable, ({ many }) => ({
  actorTags: many(actorTagsTable),
}));

export const actorTagRelations = relations(actorTagsTable, ({ one }) => ({
  actor: one(actorsTable, {
    fields: [actorTagsTable.actorId],
    references: [actorsTable.id],
  }),
  tag: one(tagsTable, {
    fields: [actorTagsTable.tagId],
    references: [tagsTable.id],
  }),
}));

export type ActorTag = typeof actorTagsTable.$inferSelect;