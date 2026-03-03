import { stat } from "node:fs/promises";
import { join } from "node:path";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../db";
import { videoFilesTable } from "../entities/VideoFile";
import { videoUniqueContentsTable } from "../entities/VideoUniqueContent";
import { fileDirsTable } from "../entities/FileDir";
import { ffmpegManager } from "./ffmpegManager";
import { videoFileManager } from "./videoFileManager";
import { createLogger } from "../utils/logger";
import { evaluateVideoWebCompatibility } from "../utils/videoWebCompatibility";

export type VideoReencodeTaskSnapshot = {
  status: "idle" | "processing";
  waitingCount: number;
  current: {
    videoFileId: number;
    sourceFileKey: string;
    outputFileKey: string | null;
    startedAt: string;
  } | null;
  lastFinishedAt: string | null;
  lastError: string | null;
  lastOutputVideoFileId: number | null;
  lastOutputFileKey: string | null;
  lastSourceVideoFileId: number | null;
  lastSourceFileKey: string | null;
};

type EnqueueReencodeOptions = {
  deleteSourceAfterSuccess?: boolean;
};

export type EnqueueAllReencodeResult = {
  candidateCount: number;
  enqueuedCount: number;
  skippedCount: number;
  deleteSourceAfterSuccess: boolean;
  task: VideoReencodeTaskSnapshot;
};

class VideoReencodeManager {
  private logger = createLogger("video-reencode-manager");

  private readonly webFriendlyVideoCodecs = new Set(["h264", "avc", "avc1", "vp8", "vp9", "av1"]);

  private readonly webFriendlyAudioCodecs = new Set(["aac", "mp3", "opus", "vorbis"]);

  private queue: Promise<void> = Promise.resolve();

  private waitingCount = 0;

  private running: {
    videoFileId: number;
    sourceFileKey: string;
    outputFileKey: string | null;
    startedAt: Date;
  } | null = null;

  private lastFinishedAt: Date | null = null;

  private lastError: string | null = null;

  private lastOutputVideoFileId: number | null = null;

  private lastOutputFileKey: string | null = null;

  private lastSourceVideoFileId: number | null = null;

  private lastSourceFileKey: string | null = null;

  private pendingVideoFileIds = new Set<number>();

  getTaskSnapshot(): VideoReencodeTaskSnapshot {
    return {
      status: this.running ? "processing" : "idle",
      waitingCount: this.waitingCount,
      current: this.running
        ? {
            videoFileId: this.running.videoFileId,
            sourceFileKey: this.running.sourceFileKey,
            outputFileKey: this.running.outputFileKey,
            startedAt: this.running.startedAt.toISOString(),
          }
        : null,
      lastFinishedAt: this.lastFinishedAt?.toISOString() ?? null,
      lastError: this.lastError,
      lastOutputVideoFileId: this.lastOutputVideoFileId,
      lastOutputFileKey: this.lastOutputFileKey,
      lastSourceVideoFileId: this.lastSourceVideoFileId,
      lastSourceFileKey: this.lastSourceFileKey,
    };
  }

  private async existsPath(filePath: string): Promise<boolean> {
    try {
      await stat(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private splitFileKey(fileKey: string) {
    const useBackslash = fileKey.includes("\\");
    const sep = useBackslash ? "\\" : "/";
    const parts = fileKey.split(/[\\/]/);
    const fileName = parts.pop() ?? fileKey;
    const dirPrefix = parts.length > 0 ? `${parts.join(sep)}${sep}` : "";
    const dot = fileName.lastIndexOf(".");
    const baseName = dot > 0 ? fileName.slice(0, dot) : fileName;
    return { sep, dirPrefix, baseName };
  }

  private getFileExt(fileKey: string): string {
    const parts = fileKey.split(/[\\/]/);
    const fileName = parts[parts.length - 1] ?? fileKey;
    const dot = fileName.lastIndexOf(".");
    if (dot < 0) return "";
    return fileName.slice(dot + 1).toLowerCase();
  }

  private normalizeCodec(codec: string | null): string | null {
    if (!codec) return null;
    const raw = codec.trim().toLowerCase();
    if (!raw) return null;
    if (raw === "libx264") return "h264";
    if (raw.startsWith("avc")) return "avc";
    return raw;
  }

  private canUseFaststartRemux(source: {
    fileKey: string;
    videoCodec: string | null;
    audioCodec: string | null;
  }): boolean {
    const ext = this.getFileExt(source.fileKey);
    if (ext !== "mp4" && ext !== "m4v") return false;
    const videoCodec = this.normalizeCodec(source.videoCodec);
    if (!videoCodec || !this.webFriendlyVideoCodecs.has(videoCodec)) return false;
    const audioCodec = this.normalizeCodec(source.audioCodec);
    if (audioCodec && !this.webFriendlyAudioCodecs.has(audioCodec)) return false;
    return true;
  }

  private async allocateOutputFileKey(dirPath: string, sourceFileKey: string): Promise<string> {
    const { sep, dirPrefix, baseName } = this.splitFileKey(sourceFileKey);
    let index = 0;
    while (index < 10_000) {
      const suffix = index === 0 ? ".web.mp4" : `.web.${index}.mp4`;
      const candidate = `${dirPrefix}${baseName}${suffix}`;
      const candidatePath = join(dirPath, candidate);
      if (!(await this.existsPath(candidatePath))) {
        return candidate;
      }
      index += 1;
    }
    throw new Error("无法分配可用的重编码输出文件名");
  }

  private async processReencode(
    videoFileId: number,
    options?: EnqueueReencodeOptions
  ): Promise<void> {
    const source = await db.query.videoFilesTable.findFirst({
      where: eq(videoFilesTable.id, videoFileId),
      columns: {
        id: true,
        fileDirId: true,
        fileKey: true,
        uniqueId: true,
        videoCodec: true,
        audioCodec: true,
      },
    });
    if (!source) {
      throw new Error("视频文件不存在，无法执行重编码");
    }
    const sourceDirPath =
      source.fileDirId == null
        ? null
        : (
          await db.query.fileDirsTable.findFirst({
            where: eq(fileDirsTable.id, source.fileDirId),
            columns: { path: true },
          })
        )?.path ?? null;

    if (!sourceDirPath || source.fileDirId == null) {
      throw new Error("视频文件目录不存在，无法执行重编码");
    }

    const sourceFilePath = join(sourceDirPath, source.fileKey);
    if (!(await this.existsPath(sourceFilePath))) {
      throw new Error("源视频文件不存在，无法执行重编码");
    }

    const outputFileKey = await this.allocateOutputFileKey(sourceDirPath, source.fileKey);
    this.running = this.running
      ? {
          ...this.running,
          outputFileKey,
        }
      : null;
    const outputFilePath = join(sourceDirPath, outputFileKey);

    const preferFaststartRemux = this.canUseFaststartRemux(source);
    this.logger.info(
      `开始处理重编码任务: source=${source.fileKey}, output=${outputFileKey}, preferFaststartRemux=${preferFaststartRemux}`
    );
    if (preferFaststartRemux) {
      try {
        await ffmpegManager.remuxToMp4Faststart(sourceFilePath, outputFilePath);
        this.logger.info(`已执行 faststart 无损重封装: source=${source.fileKey}, output=${outputFileKey}`);
      } catch (error) {
        this.logger.warn(error, `faststart 重封装失败，回退到全量重编码: source=${source.fileKey}`);
        await ffmpegManager.reencodeToWebMp4(sourceFilePath, outputFilePath);
      }
    } else {
      await ffmpegManager.reencodeToWebMp4(sourceFilePath, outputFilePath);
    }

    const sourceVideoRows = await db
      .select({ videoId: videoUniqueContentsTable.videoId })
      .from(videoUniqueContentsTable)
      .where(eq(videoUniqueContentsTable.uniqueId, source.uniqueId));
    const sourceVideoIds = [...new Set(sourceVideoRows.map((row) => row.videoId))];

    await videoFileManager.processFile(
      { id: source.fileDirId, path: sourceDirPath },
      outputFileKey,
      { force: true, skipAutoVideoBind: true }
    );

    const outputVideoFile = await db.query.videoFilesTable.findFirst({
      where: and(
        eq(videoFilesTable.fileDirId, source.fileDirId),
        eq(videoFilesTable.fileKey, outputFileKey)
      ),
      columns: { id: true, uniqueId: true },
    });
    if (!outputVideoFile) {
      throw new Error("重编码完成后未找到输出文件索引记录");
    }

    await db
      .update(videoFilesTable)
      .set({ sourceVideoFileId: source.id, updatedAt: new Date() })
      .where(eq(videoFilesTable.id, outputVideoFile.id));

    if (sourceVideoIds.length > 0) {
      const existingRows = await db
        .select({ videoId: videoUniqueContentsTable.videoId })
        .from(videoUniqueContentsTable)
        .where(
          and(
            eq(videoUniqueContentsTable.uniqueId, outputVideoFile.uniqueId),
            inArray(videoUniqueContentsTable.videoId, sourceVideoIds)
          )
        );
      const existingVideoIds = new Set(existingRows.map((row) => row.videoId));
      const rowsToInsert = sourceVideoIds
        .filter((videoId) => !existingVideoIds.has(videoId))
        .map((videoId) => ({
          videoId,
          uniqueId: outputVideoFile.uniqueId,
        }));
      if (rowsToInsert.length > 0) {
        await db.insert(videoUniqueContentsTable).values(rowsToInsert);
      }
    }

    this.lastOutputVideoFileId = outputVideoFile.id;
    this.lastOutputFileKey = outputFileKey;
    this.lastSourceVideoFileId = source.id;
    this.lastSourceFileKey = source.fileKey;

    if (options?.deleteSourceAfterSuccess) {
      const { videoFilesService } = await import("./videoFiles");
      const deleted = await videoFilesService.removeFileById(source.id);
      if ("error" in deleted) {
        throw new Error("重编码成功但删除源文件失败：源文件不存在");
      }
      this.logger.info(
        `重编码后已删除源文件: sourceVideoFileId=${source.id}, sourceFileKey=${source.fileKey}, outputVideoFileId=${outputVideoFile.id}`
      );
    }
    this.logger.info(`重编码完成并关联原视频: output=${outputFileKey}, outputVideoFileId=${outputVideoFile.id}`);
  }

  async enqueue(
    videoFileId: number,
    options?: EnqueueReencodeOptions
  ): Promise<VideoReencodeTaskSnapshot | { error: string }> {
    if (!Number.isInteger(videoFileId) || videoFileId <= 0) {
      return { error: "videoFileId 无效" };
    }
    if (this.pendingVideoFileIds.has(videoFileId)) {
      return { error: "该视频文件已在重编码队列中" };
    }

    const source = await db.query.videoFilesTable.findFirst({
      where: eq(videoFilesTable.id, videoFileId),
      columns: { id: true, fileKey: true },
    });
    if (!source) {
      return { error: "视频文件不存在" };
    }

    this.pendingVideoFileIds.add(videoFileId);
    this.waitingCount += 1;

    const execute = async () => {
      this.waitingCount = Math.max(0, this.waitingCount - 1);
      this.running = {
        videoFileId,
        sourceFileKey: source.fileKey,
        outputFileKey: null,
        startedAt: new Date(),
      };
      try {
        await this.processReencode(videoFileId, options);
        this.lastError = null;
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : String(error);
        this.logger.error(error, `重编码任务失败: videoFileId=${videoFileId}`);
      } finally {
        this.lastFinishedAt = new Date();
        this.pendingVideoFileIds.delete(videoFileId);
        this.running = null;
      }
    };

    const next = this.queue.then(execute, execute);
    this.queue = next.then(
      () => undefined,
      () => undefined
    );

    return this.getTaskSnapshot();
  }

  async enqueueAll(options?: EnqueueReencodeOptions): Promise<EnqueueAllReencodeResult> {
    const deleteSourceAfterSuccess = options?.deleteSourceAfterSuccess ?? false;
    const rawCandidates = await db
      .select({
        id: videoFilesTable.id,
        fileKey: videoFilesTable.fileKey,
        videoCodec: videoFilesTable.videoCodec,
        audioCodec: videoFilesTable.audioCodec,
        mp4MoovBeforeMdat: videoFilesTable.mp4MoovBeforeMdat,
      })
      .from(videoFilesTable)
      .where(isNull(videoFilesTable.sourceVideoFileId))
      .orderBy(asc(videoFilesTable.id));
    const webOutputFilePattern = /\.web(?:\.\d+)?\.mp4$/i;
    const candidates = rawCandidates.filter((row) => {
      if (webOutputFilePattern.test(row.fileKey)) return false;
      const compatibility = evaluateVideoWebCompatibility({
        fileKey: row.fileKey,
        videoCodec: row.videoCodec,
        audioCodec: row.audioCodec,
        mp4MoovBeforeMdat: row.mp4MoovBeforeMdat,
      });
      return compatibility.webCompatible === false;
    });

    let enqueuedCount = 0;
    let skippedCount = 0;
    for (const row of candidates) {
      const result = await this.enqueue(row.id, { deleteSourceAfterSuccess });
      if ("error" in result) {
        skippedCount += 1;
      } else {
        enqueuedCount += 1;
      }
    }

    return {
      candidateCount: candidates.length,
      enqueuedCount,
      skippedCount,
      deleteSourceAfterSuccess,
      task: this.getTaskSnapshot(),
    };
  }
}

export const videoReencodeManager = new VideoReencodeManager();
