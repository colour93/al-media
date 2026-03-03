import { Elysia } from "elysia";
import { actorsRoutes } from "./actors";
import { bindingStrategiesRoutes } from "./bindingStrategies";
import { creatorsRoutes } from "./creators";
import { distributorsRoutes } from "./distributors";
import { fileRoutes } from "./file";
import { fileDirsRoutes } from "./fileDirs";
import { dashboardRoutes } from "./dashboard";
import { tagsRoutes } from "./tags";
import { tagTypesRoutes } from "./tagTypes";
import { videoFilesRoutes } from "./videoFiles";
import { videosRoutes } from "./videos";
import { adminAuthGuard } from "../../middleware/adminAuth";

export const adminRoutes = new Elysia({ prefix: "/admin" })
  .use(adminAuthGuard)
  .use(fileRoutes)
  .use(dashboardRoutes)
  .use(bindingStrategiesRoutes)
  .use(videosRoutes)
  .use(videoFilesRoutes)
  .use(fileDirsRoutes)
  .use(tagsRoutes)
  .use(tagTypesRoutes)
  .use(actorsRoutes)
  .use(creatorsRoutes)
  .use(distributorsRoutes);
