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

export type VideoMediaInfo = {
  durationSec: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
};

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

  private async readProcessOutput(proc: ReturnType<typeof spawn>) {
    const [stdoutText, stderrText] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const exitCode = await proc.exited;
    return { stdoutText, stderrText, exitCode };
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
    const info = await this.getVideoMediaInfo(path);
    return info.durationSec;
  }

  async getVideoMediaInfo(path: string): Promise<VideoMediaInfo> {
    const proc = spawn([
      FFPROBE_BIN,
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=codec_type,codec_name",
      "-of",
      "json",
      path,
    ], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const { stdoutText, stderrText, exitCode } = await this.readProcessOutput(proc);
    if (exitCode !== 0 || !stdoutText.trim()) {
      if (stderrText.trim()) {
        this.logger.warn(`ffprobe 读取媒体信息失败: ${path}, ${stderrText.trim()}`);
      }
      return { durationSec: null, videoCodec: null, audioCodec: null };
    }

    let json: {
      format?: { duration?: string };
      streams?: Array<{ codec_type?: string; codec_name?: string }>;
    };
    try {
      json = JSON.parse(stdoutText) as {
        format?: { duration?: string };
        streams?: Array<{ codec_type?: string; codec_name?: string }>;
      };
    } catch {
      this.logger.warn(`ffprobe JSON 解析失败: ${path}`);
      return { durationSec: null, videoCodec: null, audioCodec: null };
    }

    const durationRaw = json.format?.duration;
    const duration = durationRaw ? parseFloat(durationRaw.trim()) : NaN;
    const streams = json.streams ?? [];
    const videoCodec =
      streams.find((stream) => stream.codec_type === "video")?.codec_name?.trim() ?? null;
    const audioCodec =
      streams.find((stream) => stream.codec_type === "audio")?.codec_name?.trim() ?? null;
    return {
      durationSec: Number.isNaN(duration) ? null : duration,
      videoCodec,
      audioCodec,
    };
  }

  async reencodeToWebMp4(inputPath: string, outputPath: string): Promise<void> {
    const proc = spawn([
      FFMPEG_BIN,
      "-y",
      "-i",
      inputPath,
      "-map",
      "0:v:0",
      "-map",
      "0:a:0?",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "23",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      outputPath,
    ], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const { stderrText, exitCode } = await this.readProcessOutput(proc);
    if (exitCode !== 0) {
      throw new Error(`ffmpeg 重编码失败(code=${exitCode}): ${stderrText.trim() || "unknown error"}`);
    }
  }

  async remuxToMp4Faststart(inputPath: string, outputPath: string): Promise<void> {
    const proc = spawn([
      FFMPEG_BIN,
      "-y",
      "-i",
      inputPath,
      "-map",
      "0",
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      outputPath,
    ], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const { stderrText, exitCode } = await this.readProcessOutput(proc);
    if (exitCode !== 0) {
      throw new Error(
        `ffmpeg faststart 重封装失败(code=${exitCode}): ${stderrText.trim() || "unknown error"}`
      );
    }
  }
}

export const ffmpegManager = new FfmpegManager();
