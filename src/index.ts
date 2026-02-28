import { Elysia } from "elysia";
import { appRoutes } from "./routes";
import { createLogger } from "./utils/logger";
import { videoFileManager } from "./services/videoFileManager";

const port = process.env.PORT || 39994;
const logger = createLogger("root");
const ALLOWED_CORS_ORIGINS = new Set(["http://localhost:39995", "http://localhost:39996"]);

function getCorsOrigin(request: Request): string | null {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  return ALLOWED_CORS_ORIGINS.has(origin) ? origin : null;
}

videoFileManager.init()

const app = new Elysia();
app
  .onRequest(({ request, set }) => {
    const corsOrigin = getCorsOrigin(request);
    if (!corsOrigin) return;

    set.headers["Vary"] = "Origin";
    set.headers["Access-Control-Allow-Origin"] = corsOrigin;
    set.headers["Access-Control-Allow-Credentials"] = "true";
    set.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
    set.headers["Access-Control-Allow-Headers"] =
      request.headers.get("Access-Control-Request-Headers") ?? "Content-Type, Authorization";
    set.headers["Access-Control-Max-Age"] = "86400";

    if (request.method === "OPTIONS") {
      set.status = 204;
      return "";
    }
  })
  .use(appRoutes);

app.listen(port, () => {
  logger.info(`服务运行于: http://localhost:${port}`);
});
