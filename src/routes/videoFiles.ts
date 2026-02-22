import { Elysia, t } from "elysia";
import { eq, ilike, or } from "drizzle-orm";
import { db } from "../db";
import { videoFilesTable } from "../entities/VideoFile";
import {
  paginationQuerySchema,
  parsePagination,
  parseSearchQuery,
  searchQuerySchema,
} from "../utils/pagination";

export const videoFilesRoutes = new Elysia({ prefix: "/video-files" })
  .get(
    "/",
    async ({ query, set }) => {
      const pagination = parsePagination(query, set);
      if (!pagination) {
        return { message: "invalid pagination" };
      }

      const { page, pageSize, offset } = pagination;
      const [items, total] = await Promise.all([
        db.query.videoFilesTable.findMany({
          orderBy: (t, { desc }) => [desc(t.id)],
          limit: pageSize,
          offset,
          with: {
            videoFileUnique: {
              with: {
                videoUniqueContents: {
                  with: {
                    video: true
                  }
                }
              }
            }
          },
        }),
        db.$count(videoFilesTable),
      ]);

      return {
        page,
        pageSize,
        total: total ?? 0,
        items,
      };
    },
    {
      query: paginationQuerySchema,
    }
  )
  .get(
    "/search",
    async ({ query, set }) => {
      const parsed = parseSearchQuery(query, set);
      if (!parsed) {
        return { message: "invalid search" };
      }

      const { page, pageSize, offset, keyword } = parsed;
      const condition = or(
        ilike(videoFilesTable.fileKey, `%${keyword}%`),
        ilike(videoFilesTable.uniqueId, `%${keyword}%`)
      );
      const [items, total] = await Promise.all([
        db.query.videoFilesTable.findMany({
          where: condition,
          orderBy: (t, { desc }) => [desc(t.id)],
          limit: pageSize,
          offset,
          with: {
            videoFileUnique: {
              with: {
                videoUniqueContents: {
                  with: {
                    video: true
                  }
                }
              }
            }
          },
        }),
        db.$count(videoFilesTable, condition),
      ]);

      return {
        page,
        pageSize,
        total: total ?? 0,
        items,
      };
    },
    {
      query: searchQuerySchema,
    }
  )
  .get(
    "/:id",
    async ({ params, set }) => {
      const id = Number(params.id);
      if (!Number.isInteger(id)) {
        set.status = 400;
        return { message: "invalid id" };
      }

      const item = await db.query.videoFilesTable.findFirst({
        where: eq(videoFilesTable.id, id),
        with: {
          videoFileUnique: {
            with: {
              videoUniqueContents: {
                with: {
                  video: true
                }
              }
            }
          }
        }
      });
      if (!item) {
        set.status = 404;
        return { message: "video file not found" };
      }
      return item;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )
  .post("/", () => ({ route: "POST /video-files", note: "create video file (stub)" }))
  .patch("/:id", ({ params }) => ({
    route: "PATCH /video-files/:id",
    params,
    note: "update video file (stub)",
  }))
  .delete("/:id", ({ params }) => ({
    route: "DELETE /video-files/:id",
    params,
    note: "delete video file (stub)",
  }));
