import { Elysia } from "elysia";
import { commonVideosRoutes } from "./videos";
import { commonFileRoutes } from "./file";

export const commonRoutes = new Elysia({ prefix: "/common" })
  .use(commonVideosRoutes)
  .use(commonFileRoutes);
