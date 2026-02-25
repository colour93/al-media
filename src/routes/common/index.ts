import { Elysia } from "elysia";
import { commonVideosRoutes } from "./videos";
import { commonFileRoutes } from "./file";
import { commonMetadataRoutes } from "./metadata";
import { commonAuthGuard } from "../../middleware/commonAuth";

export const commonRoutes = new Elysia({ prefix: "/common" })
  .use(commonAuthGuard)
  .use(commonMetadataRoutes)
  .use(commonVideosRoutes)
  .use(commonFileRoutes);
