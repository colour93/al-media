import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { fileManager, FileCategory } from "./fileManager";
import { videoFileManager } from "./videoFileManager";
import { buildCommonSignedVideoFileUrl, buildSignedVideoFileUrl, verifyVideoFileSign } from "../utils/videoFileSign";
import { createLogger } from "../utils/logger";

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

const logger = createLogger("fileService");

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
export type VideoStreamProbeResult = { headers: Record<string, string>; status: 200 | 206 };
export type VideoStreamProbeError = VideoStreamError;

type VideoStreamResolvedContext = {
  path: string;
  status: 200 | 206;
  start: number;
  end: number;
  fileSize: number;
  contentLength: number;
  headers: Record<string, string>;
};

type VideoStreamResolveError = VideoStreamError;

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
    const resolved = await this.resolveVideoStreamContext(
      videoFileId,
      sign,
      exp,
      rangeHeader,
      "get"
    );
    if ("error" in resolved) {
      return resolved;
    }

    const streamStartAt = Date.now();
    const nodeStream = createReadStream(resolved.path, {
      start: resolved.start,
      end: resolved.end,
    });
    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
    logger.debug({
      event: "video-stream-open",
      ts: new Date().toISOString(),
      videoFileId,
      elapsedMs: Date.now() - streamStartAt,
      status: resolved.status,
      start: resolved.start,
      end: resolved.end,
      contentLength: resolved.contentLength,
    });
    return { stream: webStream, headers: resolved.headers, status: resolved.status };
  }

  async getVideoStreamProbe(
    videoFileId: number,
    sign: string,
    exp: string,
    rangeHeader: string
  ): Promise<VideoStreamProbeResult | VideoStreamProbeError> {
    const resolved = await this.resolveVideoStreamContext(
      videoFileId,
      sign,
      exp,
      rangeHeader,
      "head"
    );
    if ("error" in resolved) {
      return resolved;
    }
    return { headers: resolved.headers, status: resolved.status };
  }

  private async resolveVideoStreamContext(
    videoFileId: number,
    sign: string,
    exp: string,
    rangeHeader: string,
    method: "get" | "head"
  ): Promise<VideoStreamResolvedContext | VideoStreamResolveError> {
    const requestStartedAt = Date.now();
    const requestTs = new Date().toISOString();

    if (!Number.isInteger(videoFileId) || !sign || !exp) {
      logger.warn({
        event: "video-stream-validate-failed",
        ts: requestTs,
        method,
        videoFileId,
      });
      return { error: "参数无效" };
    }

    const verifyStartedAt = Date.now();
    const signOk = verifyVideoFileSign(videoFileId, sign, exp);
    const verifyElapsedMs = Date.now() - verifyStartedAt;
    if (!signOk) {
      logger.warn({
        event: "video-stream-sign-failed",
        ts: requestTs,
        method,
        videoFileId,
        verifyElapsedMs,
      });
      return { error: "签名无效或已过期" };
    }

    const infoStartedAt = Date.now();
    const info = await videoFileManager.getVideoFileInfo(videoFileId);
    const infoElapsedMs = Date.now() - infoStartedAt;
    if (!info) {
      logger.warn({
        event: "video-stream-info-missing",
        ts: requestTs,
        method,
        videoFileId,
        infoElapsedMs,
      });
      return { error: "视频文件不存在" };
    }

    const { path, fileSize } = info;
    const rangeStartedAt = Date.now();
    const { start, end, status } = parseRangeHeader(rangeHeader, fileSize);
    const rangeElapsedMs = Date.now() - rangeStartedAt;
    const contentLength = end - start + 1;
    const ext = extname(path);
    const mime = getVideoMime(ext);

    const headers: Record<string, string> = {
      "Content-Type": mime,
      "Accept-Ranges": "bytes",
      "Content-Length": String(contentLength),
    };
    if (status === 206) {
      headers["Content-Range"] = `bytes ${start}-${end}/${fileSize}`;
    }

    logger.debug({
      event: "video-stream-resolved",
      ts: requestTs,
      method,
      videoFileId,
      totalElapsedMs: Date.now() - requestStartedAt,
      verifyElapsedMs,
      infoElapsedMs,
      rangeElapsedMs,
      rangeHeader: rangeHeader || "none",
      status,
      start,
      end,
      contentLength,
      fileSize,
    });

    return {
      path,
      status,
      start,
      end,
      fileSize,
      contentLength,
      headers,
    };
  }
}

export const fileService = new FileService();
