import { spawn } from "bun";
import { createLogger } from "../utils/logger";

const THUMBNAIL_SEEK_RATIO = 0.3;
const THUMBNAIL_SEEK_SEC_FALLBACK_RAW = process.env.THUMBNAIL_SEEK_SEC
  ? Number(process.env.THUMBNAIL_SEEK_SEC)
  : 1;
const THUMBNAIL_SEEK_SEC_FALLBACK =
  Number.isFinite(THUMBNAIL_SEEK_SEC_FALLBACK_RAW) && THUMBNAIL_SEEK_SEC_FALLBACK_RAW >= 0
    ? THUMBNAIL_SEEK_SEC_FALLBACK_RAW
    : 1;
const THUMBNAIL_WIDTH = process.env.THUMBNAIL_WIDTH ? Number(process.env.THUMBNAIL_WIDTH) : 320;
const FFMPEG_BIN = process.env.FFMPEG_BIN?.trim() || "ffmpeg";
const FFPROBE_BIN = process.env.FFPROBE_BIN?.trim() || "ffprobe";

type GenerateThumbnailOptions = {
  seekSec?: number;
  durationSec?: number;
};

export class FfmpegManager {
  constructor() { }

  private logger = createLogger("ffmpeg-manager");

  private resolveThumbnailSeekSec(options: GenerateThumbnailOptions): number {
    const seekSec = options.seekSec;
    if (typeof seekSec === "number" && Number.isFinite(seekSec) && seekSec >= 0) {
      return seekSec;
    }
    const durationSec = options.durationSec;
    if (typeof durationSec === "number" && Number.isFinite(durationSec) && durationSec > 0) {
      return durationSec * THUMBNAIL_SEEK_RATIO;
    }
    return THUMBNAIL_SEEK_SEC_FALLBACK;
  }

  /** 从视频截取缩略图：默认取视频时长 30% 位置；可用 seekSec 覆盖 */
  async generateThumbnail(videoPath: string, options: GenerateThumbnailOptions = {}): Promise<Buffer | null> {
    let durationSec = options.durationSec;
    const hasManualSeek =
      typeof options.seekSec === "number" && Number.isFinite(options.seekSec) && options.seekSec >= 0;
    if (!hasManualSeek) {
      const hasDuration =
        typeof durationSec === "number" && Number.isFinite(durationSec) && durationSec > 0;
      if (!hasDuration) {
        durationSec = await this.getVideoDuration(videoPath);
      }
    }
    const seek = this.resolveThumbnailSeekSec({ ...options, durationSec: durationSec ?? undefined });
    const proc = spawn([
      FFMPEG_BIN,
      "-y",
      "-ss",
      String(seek),
      "-i",
      videoPath,
      "-vframes",
      "1",
      "-vf",
      `scale=${THUMBNAIL_WIDTH}:-2`,
      "-f",
      "image2",
      "-c:v",
      "mjpeg",
      "pipe:1",
    ], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const chunks: Uint8Array[] = [];
    for await (const chunk of proc.stdout) {
      chunks.push(chunk);
    }
    await proc.exited;

    if (chunks.length === 0) {
      this.logger.warn(`缩略图生成失败: ${videoPath}`);
      return null;
    }
    return Buffer.concat(chunks);
  }

  async getVideoDuration(path: string): Promise<number | null> {
    const proc = spawn([
      FFPROBE_BIN,
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      path,
    ]);

    const text = await new Response(proc.stdout).text();
    await proc.exited;

    if (!text) return null;

    const duration = parseFloat(text.trim());
    return Number.isNaN(duration) ? null : duration;
  }
}

export const ffmpegManager = new FfmpegManager();
