import { Elysia, t } from "elysia";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { fileManager, FileCategory } from "../services/fileManager";

const categorySchema = t.Union([
  t.Literal(FileCategory.Avatars),
  t.Literal(FileCategory.Thumbnails),
  t.Literal(FileCategory.Misc),
]);

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  ico: "image/x-icon",
};

const getMime = (ext: string): string =>
  EXT_MIME[ext.toLowerCase().slice(1)] ?? "application/octet-stream";

const isSafeKey = (key: string): boolean =>
  !key.includes("..") && !key.includes("/") && !key.includes("\\");

export const fileRoutes = new Elysia({ prefix: "/file" })
  .post(
    "/",
    async ({ body, set }) => {
      const file = body.file as File;
      const ext = extname(file.name) || ".bin";
      const key = `${randomUUID()}${ext}`;
      const buf = Buffer.from(await file.arrayBuffer());
      await fileManager.write(key, body.category as FileCategory, buf);
      set.status = 201;
      return { key };
    },
    {
      body: t.Object({
        file: t.File(),
        category: categorySchema,
      }),
      type: "multipart/form-data",
    }
  )
  .get(
    "/:category/:key",
    async ({ params, set }) => {
      const { category, key } = params;
      if (!isSafeKey(key)) {
        set.status = 400;
        return { message: "invalid key" };
      }
      if (!fileManager.exists(key, category as FileCategory)) {
        set.status = 404;
        return { message: "file not found" };
      }
      const buf = await fileManager.read(key, category as FileCategory);
      const ext = extname(key);
      const mime = getMime(ext);
      return new Response(new Uint8Array(buf), {
        headers: { "Content-Type": mime },
      });
    },
    {
      params: t.Object({
        category: categorySchema,
        key: t.String({ minLength: 1 }),
      }),
    }
  )
  .delete(
    "/:category/:key",
    async ({ params, set }) => {
      const { category, key } = params;
      if (!isSafeKey(key)) {
        set.status = 400;
        return { message: "invalid key" };
      }
      if (!fileManager.exists(key, category as FileCategory)) {
        set.status = 404;
        return { message: "file not found" };
      }
      await fileManager.delete(key, category as FileCategory);
      return { success: true };
    },
    {
      params: t.Object({
        category: categorySchema,
        key: t.String({ minLength: 1 }),
      }),
    }
  );
