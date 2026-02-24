import { Elysia, t } from "elysia";
import { fileService } from "../../services/file";
import { FileCategory } from "../../services/fileManager";

const categorySchema = t.Union([
  t.Literal(FileCategory.Avatars),
  t.Literal(FileCategory.Thumbnails),
  t.Literal(FileCategory.Misc),
]);

export const fileRoutes = new Elysia({ prefix: "/file" })
  .post(
    "/",
    async ({ body, set }) => {
      const result = await fileService.upload(body.file as File, body.category as FileCategory);
      set.status = 201;
      return result;
    },
    {
      body: t.Object({
        file: t.File(),
        category: categorySchema,
      }),
      type: "multipart/form-data",
    }
  )
  .get(
    "/:category/:key",
    async ({ params, set }) => {
      const result = await fileService.readFile(params.key, params.category as FileCategory);
      if ("error" in result) {
        set.status = result.error === "key 无效" ? 400 : 404;
        return { message: result.error };
      }
      return new Response(new Uint8Array(result.buf), {
        headers: { "Content-Type": result.mime },
      });
    },
    {
      params: t.Object({
        category: categorySchema,
        key: t.String({ minLength: 1 }),
      }),
    }
  )
  .delete(
    "/:category/:key",
    async ({ params, set }) => {
      const result = await fileService.deleteFile(params.key, params.category as FileCategory);
      if ("error" in result) {
        set.status = result.error === "key 无效" ? 400 : 404;
        return { message: result.error };
      }
      return result;
    },
    {
      params: t.Object({
        category: categorySchema,
        key: t.String({ minLength: 1 }),
      }),
    }
  )
  .get(
    "/video/:videoFileId/sign",
    async ({ params, set }) => {
      const videoFileId = Number(params.videoFileId);
      const result = await fileService.getVideoSignUrl(videoFileId);
      if ("error" in result) {
        set.status = result.error === "视频文件 ID 无效" ? 400 : 404;
        return { message: result.error };
      }
      return result;
    },
    {
      params: t.Object({ videoFileId: t.String() }),
    }
  )
  .get(
    "/video-stream/:videoFileId",
    async ({ params, query, request, set }) => {
      const videoFileId = Number(params.videoFileId);
      const sign = query.sign ?? "";
      const exp = query.exp ?? "";
      const rangeHeader = request.headers.get("Range") ?? "";
      const result = await fileService.getVideoStream(videoFileId, sign, exp, rangeHeader);
      if ("error" in result) {
        set.status = result.error === "参数无效" ? 400 : result.error === "签名无效或已过期" ? 403 : 404;
        return { message: result.error };
      }
      return new Response(result.stream, { status: result.status, headers: result.headers });
    },
    {
      params: t.Object({ videoFileId: t.String() }),
      query: t.Object({
        sign: t.String(),
        exp: t.String(),
      }),
    }
  );
