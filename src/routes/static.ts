import { Elysia } from "elysia";
import { existsSync } from "node:fs";
import { resolve, sep } from "node:path";
import { createLogger } from "../utils/logger";

const logger = createLogger("static");

const APP_DIST_CANDIDATES = ["web/app", "dist/public/app"];
const ADMIN_DIST_CANDIDATES = ["web/admin", "dist/public/admin"];

function resolveDistDir(envPath: string | undefined, candidates: string[]): string {
  const list = envPath ? [envPath, ...candidates] : candidates;
  for (const item of list) {
    const absolute = resolve(item);
    if (existsSync(absolute)) return absolute;
  }
  return resolve(list[0]);
}

const appDistDir = resolveDistDir(process.env.APP_DIST_DIR, APP_DIST_CANDIDATES);
const adminDistDir = resolveDistDir(process.env.ADMIN_DIST_DIR, ADMIN_DIST_CANDIDATES);

const appIndexFile = resolve(appDistDir, "index.html");
const adminIndexFile = resolve(adminDistDir, "index.html");

const hasAppDist = existsSync(appIndexFile);
const hasAdminDist = existsSync(adminIndexFile);

if (!hasAppDist) {
  logger.warn(
    `未找到 C 端构建产物(${appIndexFile})。若需要由后端托管前端，请先执行 bun run build:web`
  );
}
if (!hasAdminDist) {
  logger.warn(
    `未找到管理端构建产物(${adminIndexFile})。若需要由后端托管前端，请先执行 bun run build:web`
  );
}

function toSafeFilePath(rootDir: string, pathname: string): string | null {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const fullPath = resolve(rootDir, `.${decoded}`);
  const rootWithSep = rootDir.endsWith(sep) ? rootDir : `${rootDir}${sep}`;
  if (fullPath !== rootDir && !fullPath.startsWith(rootWithSep)) {
    return null;
  }
  return fullPath;
}

function fileResponse(pathname: string): Response | null {
  if (!existsSync(pathname)) return null;
  return new Response(Bun.file(pathname));
}

function notBuiltResponse(target: "app" | "admin"): Response {
  return new Response(
    target === "app"
      ? "App 前端资源不存在，请先执行 bun run build:web"
      : "Admin 前端资源不存在，请先执行 bun run build:web",
    { status: 503 }
  );
}

function isFileLikePath(pathname: string): boolean {
  const lastSegment = pathname.split("/").pop() ?? "";
  return lastSegment.includes(".");
}

function serveAppIndex(set: { headers: Record<string, string> }): Response {
  set.headers["Cache-Control"] = "no-cache";
  return new Response(Bun.file(appIndexFile));
}

function serveAdminIndex(set: { headers: Record<string, string> }): Response {
  set.headers["Cache-Control"] = "no-cache";
  return new Response(Bun.file(adminIndexFile));
}

export const staticRoutes = new Elysia({ name: "static-routes" })
  .get("/static/*", ({ request, set }) => {
    if (!hasAppDist) return notBuiltResponse("app");
    const pathname = new URL(request.url).pathname;
    const absPath = toSafeFilePath(appDistDir, pathname);
    if (!absPath) {
      set.status = 400;
      return "Bad Request";
    }
    const file = fileResponse(absPath);
    if (!file) {
      set.status = 404;
      return "Not Found";
    }
    set.headers["Cache-Control"] = "public, max-age=31536000, immutable";
    return file;
  })
  .get("/admin/static/*", ({ request, set }) => {
    if (!hasAdminDist) return notBuiltResponse("admin");
    const pathname = new URL(request.url).pathname;
    const adminLocalPath = pathname.replace(/^\/admin/, "");
    const absPath = toSafeFilePath(adminDistDir, adminLocalPath);
    if (!absPath) {
      set.status = 400;
      return "Bad Request";
    }
    const file = fileResponse(absPath);
    if (!file) {
      set.status = 404;
      return "Not Found";
    }
    set.headers["Cache-Control"] = "public, max-age=31536000, immutable";
    return file;
  })
  .get("/admin", ({ set }) => {
    if (!hasAdminDist) return notBuiltResponse("admin");
    return serveAdminIndex(set);
  })
  .get("/admin/", ({ set }) => {
    if (!hasAdminDist) return notBuiltResponse("admin");
    return serveAdminIndex(set);
  })
  .get("/admin/*", ({ request, set }) => {
    if (!hasAdminDist) return notBuiltResponse("admin");
    const pathname = new URL(request.url).pathname;
    const adminLocalPath = pathname.replace(/^\/admin/, "") || "/";
    const absPath = toSafeFilePath(adminDistDir, adminLocalPath);
    if (!absPath) {
      set.status = 400;
      return "Bad Request";
    }
    const file = fileResponse(absPath);
    if (file) return file;
    if (isFileLikePath(pathname)) {
      set.status = 404;
      return "Not Found";
    }
    return serveAdminIndex(set);
  })
  .get("/", ({ set }) => {
    if (!hasAppDist) return notBuiltResponse("app");
    return serveAppIndex(set);
  })
  .get("/*", ({ request, set }) => {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/api" || pathname.startsWith("/api/")) {
      set.status = 404;
      return "Not Found";
    }
    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      set.status = 404;
      return "Not Found";
    }
    if (!hasAppDist) return notBuiltResponse("app");
    const absPath = toSafeFilePath(appDistDir, pathname);
    if (!absPath) {
      set.status = 400;
      return "Bad Request";
    }
    const file = fileResponse(absPath);
    if (file) {
      if (pathname.startsWith("/static/")) {
        set.headers["Cache-Control"] = "public, max-age=31536000, immutable";
      }
      return file;
    }
    if (isFileLikePath(pathname)) {
      set.status = 404;
      return "Not Found";
    }
    return serveAppIndex(set);
  });
