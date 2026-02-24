import { spawn } from "bun";
import { createLogger } from "../utils/logger";

const THUMBNAIL_SEEK_SEC = process.env.THUMBNAIL_SEEK_SEC ? Number(process.env.THUMBNAIL_SEEK_SEC) : 1;
const THUMBNAIL_WIDTH = process.env.THUMBNAIL_WIDTH ? Number(process.env.THUMBNAIL_WIDTH) : 320;

export class FfmpegManager {
  constructor() { }

  private logger = createLogger("ffmpeg-manager");

  /** 从视频指定时间截取缩略图，seekSec 默认 1 秒 */
  async generateThumbnail(videoPath: string, seekSec?: number): Promise<Buffer | null> {
    const seek = seekSec ?? THUMBNAIL_SEEK_SEC;
    const proc = spawn([
      "ffmpeg",
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
      "ffprobe",
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