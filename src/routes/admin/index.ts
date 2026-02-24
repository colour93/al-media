import { Elysia } from "elysia";
import { actorsRoutes } from "./actors";
import { creatorsRoutes } from "./creators";
import { distributorsRoutes } from "./distributors";
import { fileRoutes } from "./file";
import { fileDirsRoutes } from "./fileDirs";
import { tagsRoutes } from "./tags";
import { tagTypesRoutes } from "./tagTypes";
import { videoFilesRoutes } from "./videoFiles";
import { videosRoutes } from "./videos";

export const adminRoutes = new Elysia({ prefix: "/admin" })
  .guard({
    // TODO: 管理端鉴权 guard，暂未实现（如校验 token、session 等）
  })
  .use(fileRoutes)
  .use(videosRoutes)
  .use(videoFilesRoutes)
  .use(fileDirsRoutes)
  .use(tagsRoutes)
  .use(tagTypesRoutes)
  .use(actorsRoutes)
  .use(creatorsRoutes)
  .use(distributorsRoutes);
