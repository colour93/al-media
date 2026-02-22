import { spawn } from "bun";
import { createLogger } from "../utils/logger";

export class FfmpegManager {
  constructor() { }

  private logger = createLogger("ffmpeg-manager");

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