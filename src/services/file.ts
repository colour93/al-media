import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { fileManager, FileCategory } from "./fileManager";
import { videoFileManager } from "./videoFileManager";
import { buildCommonSignedVideoFileUrl, buildSignedVideoFileUrl, verifyVideoFileSign } from "../utils/videoFileSign";

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

const VIDEO_EXT_MIME: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  webm: "video/webm",
  flv: "video/x-flv",
  wmv: "video/x-ms-wmv",
  m4v: "video/x-m4v",
  m4a: "audio/mp4",
};

const getMime = (ext: string): string =>
  EXT_MIME[ext.toLowerCase().replace(/^\./, "")] ?? "application/octet-stream";

const getVideoMime = (ext: string): string =>
  VIDEO_EXT_MIME[ext.toLowerCase().replace(/^\./, "")] ?? "video/mp4";

function isSafeKey(key: string): boolean {
  return !key.includes("..") && !key.includes("/") && !key.includes("\\");
}

function parseRangeHeader(rangeHeader: string, fileSize: number): { start: number; end: number; status: 200 | 206 } {
  let start = 0;
  let end = fileSize - 1;
  if (!rangeHeader.startsWith("bytes=")) {
    return { start, end, status: 200 };
  }
  const match = rangeHeader.slice(6).match(/^(\d*)-(\d*)$/);
  if (!match) {
    return { start, end, status: 200 };
  }
  const first = match[1] ?? "";
  const last = match[2] ?? "";
  if (last && !first) {
    const suffixLen = parseInt(last, 10);
    start = Math.max(0, fileSize - suffixLen);
    end = fileSize - 1;
  } else {
    start = first ? parseInt(first, 10) : 0;
    end = last ? Math.min(parseInt(last, 10), fileSize - 1) : fileSize - 1;
  }
  if (start <= end && start < fileSize) {
    return { start, end, status: 206 };
  }
  return { start: 0, end: fileSize - 1, status: 200 };
}

export type UploadResult = { key: string };
export type UploadError = { error: "key 无效" };

export type ReadFileResult = { buf: Buffer; mime: string };
export type ReadFileError = { error: "key 无效" | "文件不存在" };

export type DeleteFileResult = { success: true };
export type DeleteFileError = { error: "key 无效" | "文件不存在" };

export type VideoSignResult = { url: string };
export type VideoSignError = { error: "视频文件 ID 无效" | "视频文件不存在" };

export type VideoStreamResult = { stream: ReadableStream; headers: Record<string, string>; status: 200 | 206 };
export type VideoStreamError = { error: "参数无效" | "签名无效或已过期" | "视频文件不存在" };

class FileService {
  upload(file: File, category: FileCategory): Promise<UploadResult> {
    const ext = extname(file.name) || ".bin";
    const key = `${randomUUID()}${ext}`;
    return file.arrayBuffer().then((ab) => {
      const buf = Buffer.from(ab);
      return fileManager.write(key, category, buf).then(() => ({ key }));
    });
  }

  async readFile(key: string, category: FileCategory): Promise<ReadFileResult | ReadFileError> {
    if (!isSafeKey(key)) {
      return { error: "key 无效" };
    }
    if (!fileManager.exists(key, category)) {
      return { error: "文件不存在" };
    }
    const buf = await fileManager.read(key, category);
    const ext = extname(key);
    const mime = getMime(ext);
    return { buf, mime };
  }

  async deleteFile(key: string, category: FileCategory): Promise<DeleteFileResult | DeleteFileError> {
    if (!isSafeKey(key)) {
      return { error: "key 无效" };
    }
    if (!fileManager.exists(key, category)) {
      return { error: "文件不存在" };
    }
    await fileManager.delete(key, category);
    return { success: true };
  }

  async getVideoSignUrl(videoFileId: number, options?: { forCommon?: boolean; pathOnly?: boolean }): Promise<VideoSignResult | VideoSignError> {
    if (!Number.isInteger(videoFileId)) {
      return { error: "视频文件 ID 无效" };
    }
    const path = await videoFileManager.getVideoFilePath(videoFileId);
    if (!path) {
      return { error: "视频文件不存在" };
    }
    const url = options?.forCommon
      ? buildCommonSignedVideoFileUrl(videoFileId, options.pathOnly)
      : buildSignedVideoFileUrl(videoFileId);
    return { url };
  }

  async getVideoStream(
    videoFileId: number,
    sign: string,
    exp: string,
    rangeHeader: string
  ): Promise<VideoStreamResult | VideoStreamError> {
    if (!Number.isInteger(videoFileId) || !sign || !exp) {
      return { error: "参数无效" };
    }
    if (!verifyVideoFileSign(videoFileId, sign, exp)) {
      return { error: "签名无效或已过期" };
    }
    const info = await videoFileManager.getVideoFileInfo(videoFileId);
    if (!info) {
      return { error: "视频文件不存在" };
    }
    const { path, fileSize } = info;
    const ext = extname(path);
    const mime = getVideoMime(ext);
    const { start, end, status } = parseRangeHeader(rangeHeader, fileSize);
    const contentLength = end - start + 1;
    const nodeStream = createReadStream(path, { start, end });
    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
    const headers: Record<string, string> = {
      "Content-Type": mime,
      "Accept-Ranges": "bytes",
      "Content-Length": String(contentLength),
    };
    if (status === 206) {
      headers["Content-Range"] = `bytes ${start}-${end}/${fileSize}`;
    }
    return { stream: webStream, headers, status };
  }
}

export const fileService = new FileService();
