import { Elysia } from "elysia";

const BASE_URL = process.env.APP_URL ?? process.env.BASE_URL ?? "http://localhost:39994";
const ADMIN_APP_URL = process.env.ADMIN_APP_URL ?? `${BASE_URL}/admin`;

export const commonMetadataRoutes = new Elysia()
  .get("/metadata", () => ({
    adminPanelUrl: ADMIN_APP_URL,
  }));
