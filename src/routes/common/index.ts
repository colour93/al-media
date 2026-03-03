import { Elysia } from "elysia";
import { commonVideosRoutes } from "./videos";
import { commonFileRoutes } from "./file";
import { commonMetadataRoutes } from "./metadata";
import { commonResourcesRoutes } from "./resources";
import { commonAuthGuard } from "../../middleware/commonAuth";

export const commonRoutes = new Elysia({ prefix: "/common" })
  .use(commonAuthGuard)
  .use(commonMetadataRoutes)
  .use(commonResourcesRoutes)
  .use(commonVideosRoutes)
  .use(commonFileRoutes);
