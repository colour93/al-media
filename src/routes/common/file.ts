import { Elysia, t } from "elysia";
import { fileService } from "../../services/file";

export const commonFileRoutes = new Elysia({ prefix: "/file" })
  .get(
    "/video/:videoFileId/sign",
    async ({ params, set }) => {
      const videoFileId = Number(params.videoFileId);
      const result = await fileService.getVideoSignUrl(videoFileId, { forCommon: true });
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
