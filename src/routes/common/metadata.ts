import { Elysia } from "elysia";

const ADMIN_APP_URL = process.env.ADMIN_APP_URL ?? "http://localhost:39995";

export const commonMetadataRoutes = new Elysia()
  .get("/metadata", () => ({
    adminPanelUrl: ADMIN_APP_URL,
  }));
