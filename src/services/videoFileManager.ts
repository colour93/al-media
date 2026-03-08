import chokidar, { FSWatcher } from "chokidar";
import { readdir, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { db } from "../db";
import { fileDirsTable } from "../entities/FileDir";
import { and, eq } from "drizzle-orm";
import type { VideoFile } from "../entities/VideoFile";
import { createLogger } from "../utils/logger";
import { getFileCount, getFileUniqueId } from "../utils/file";
import { videoFilesTable } from "../entities/VideoFile";
import { videosTable } from "../entities/Video";
import { videoUniqueContentsTable } from "../entities/VideoUniqueContent";
import { ffmpegManager } from "./ffmpegManager";
import { videoFileUniquesTable } from "../entities/VideoFileUnique";
import { fileManager, FileCategory } from "./fileManager";
import { videoFileIndexStrategiesService } from "./videoFileIndexStrategies";
import { inspectMp4MoovAtom } from "../utils/mp4Atom";
import { videoFilesService } from "./videoFiles";

const ALLOWED_EXT = new Set([
  ".mp4",
  ".mov",
  ".avi",
  ".mkv",
  ".webm",
  ".flv",
  ".wmv",
  ".m4v",
  ".m4a",
]);

const FILE_WATCH_USE_POLLING =
  process.env.FILE_WATCH_USE_POLLING === "true" || process.env.FILE_WATCH_USE_POLLING === "1";
const FILE_WATCH_INTERVAL_RAW = process.env.FILE_WATCH_INTERVAL ? Number(process.env.FILE_WATCH_INTERVAL) : undefined;
const FILE_WATCH_INTERVAL =
  FILE_WATCH_INTERVAL_RAW && Number.isFinite(FILE_WATCH_INTERVAL_RAW) && FILE_WATCH_INTERVAL_RAW > 0
    ? Math.round(FILE_WATCH_INTERVAL_RAW)
    : undefined;

interface VideoFileDir {
  id: number;
  path: string;
}

type ScanTaskStatus = "pending" | "paused" | "processing" | "completed" | "failed" | "aborted" | "stopped";

type ProcessFileOptions = {
  force?: boolean;
  skipAutoVideoBind?: boolean;
  replaceThumbnail?: boolean;
};

type StartScanTaskOptions = {
  force?: boolean;
  waitForCompletion?: boolean;
};

export type VideoFileScanTaskSnapshot = {
  dir: VideoFileDir;
  currentFile: string | null;
  currentFileCount: number;
  totalFileCount: number;
  status: ScanTaskStatus;
  error: string | null;
  force: boolean;
};

class VideoFileDirScanTask {
  public dir: VideoFileDir;
  public currentFile: string | null;
  public currentFileCount: number;
  public totalFileCount: number;
  public status: ScanTaskStatus;
  public error: Error | null;
  public force: boolean;
  private logger = createLogger("video-file-scan-task");
  private runPromise: Promise<void> | null = null;
  private pausePromise: Promise<void> | null = null;
  private resumeResolver: (() => void) | null = null;
  private stopRequested = false;
  private cancelRequested = false;
  private readonly fileProcessor: (dir: VideoFileDir, relativePath: string) => Promise<boolean>;

  constructor(
    dir: VideoFileDir,
    fileProcessor: (dir: VideoFileDir, relativePath: string) => Promise<boolean>,
    force = false
  ) {
    this.dir = dir;
    this.fileProcessor = fileProcessor;
    this.currentFile = null;
    this.currentFileCount = 0;
    this.status = "pending";
    this.error = null;
    this.force = force;
    this.totalFileCount = 0;
  }

  private async waitForResumeOrInterrupt() {
    while (this.status === "paused") {
      if (!this.pausePromise) {
        this.pausePromise = new Promise<void>((resolve) => {
          this.resumeResolver = resolve;
        });
      }
      await this.pausePromise;
    }
  }

  private throwIfInterrupted() {
    if (this.cancelRequested) {
      throw new Error("扫描任务已取消");
    }
    if (this.stopRequested) {
      throw new Error("扫描任务已停止");
    }
  }

  private async checkControlPoint() {
    this.throwIfInterrupted();
    await this.waitForResumeOrInterrupt();
    this.throwIfInterrupted();
  }

  private async processFile(path: string): Promise<boolean> {
    await this.checkControlPoint();
    const relativePath = relative(this.dir.path, path);
    this.currentFile = relativePath;
    const success = await this.fileProcessor(this.dir, relativePath);
    this.currentFileCount += 1;
    return success;
  }

  private async processDir(dir: string) {
    await this.checkControlPoint();
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      await this.checkControlPoint();
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.processDir(fullPath);
      } else if (ALLOWED_EXT.has(extname(fullPath).toLowerCase())) {
        await this.processFile(fullPath);
      }
    }
  }

  public start() {
    if (this.runPromise) {
      return this.runPromise;
    }

    this.logger.debug(`开始扫描目录: ${this.dir.path}`);

    this.status = "processing";
    this.error = null;
    this.stopRequested = false;
    this.cancelRequested = false;
    this.currentFile = null;
    this.currentFileCount = 0;
    this.runPromise = this.run();
    return this.runPromise;
  }

  public pause() {
    if (this.status !== "processing") return;
    this.status = "paused";
  }

  public resume() {
    if (this.status !== "paused") return;
    this.status = "processing";
    if (this.resumeResolver) {
      this.resumeResolver();
      this.resumeResolver = null;
      this.pausePromise = null;
    }
  }

  public stop() {
    if (this.status !== "processing" && this.status !== "paused") return;
    this.stopRequested = true;
    if (this.status === "paused") {
      this.resume();
    }
  }

  public cancel() {
    if (
      this.status !== "processing" &&
      this.status !== "paused" &&
      this.status !== "pending"
    ) {
      return;
    }
    this.cancelRequested = true;
    if (this.status === "paused") {
      this.resume();
    }
  }

  public abort() {
    this.cancel();
  }

  public complete() {
    this.status = "completed";
  }

  public fail(error: Error) {
    this.status = "failed";
    this.error = error;
  }

  private async run() {
    try {
      this.totalFileCount = await getFileCount(this.dir.path, ALLOWED_EXT);
      await this.processDir(this.dir.path);
      if (this.cancelRequested) {
        this.status = "aborted";
      } else if (this.stopRequested) {
        this.status = "stopped";
      } else {
        this.complete();
      }
    } catch (error) {
      if (error instanceof Error && error.message === "扫描任务已取消") {
        this.status = "aborted";
        return;
      }
      if (error instanceof Error && error.message === "扫描任务已停止") {
        this.status = "stopped";
        return;
      }

      this.fail(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.currentFile = null;
    }
  }
}

class VideoFileManager {
  constructor() { }

  private logger = createLogger("video-file-manager");

  private readonly watchers: Map<string, FSWatcher> = new Map();

  public scanTask: VideoFileDirScanTask | null = null;

  private scanTaskRunPromise: Promise<void> | null = null;

  private initScanSequence = 0;

  private isAllowedVideoPath(path: string): boolean {
    return ALLOWED_EXT.has(extname(path).toLowerCase());
  }

  private shouldIgnoreWatchPath(path: string, stats?: { isDirectory(): boolean }): boolean {
    if (stats?.isDirectory()) return false;
    return !this.isAllowedVideoPath(path);
  }

  private createWatcher(dir: string, usePolling: boolean): FSWatcher {
    const watcher = chokidar.watch(dir, {
      ignoreInitial: true,
      persistent: true,
      ignorePermissionErrors: true,
      usePolling,
      interval: FILE_WATCH_INTERVAL,
      binaryInterval: FILE_WATCH_INTERVAL,
      ignored: (path, stats) => this.shouldIgnoreWatchPath(path, stats as { isDirectory(): boolean } | undefined),
    });
    watcher.on("add", path => this.handleFileChange(path));
    watcher.on("change", path => this.handleFileChange(path));
    watcher.on("unlink", path => this.handleFileDelete(path));
    watcher.on("error", (error) => {
      const err = error as NodeJS.ErrnoException;
      const code = err.code;
      if (!usePolling && (code === "EINVAL" || code === "ENOSYS")) {
        this.logger.warn(`目录监听不支持原生 watch，回退轮询: ${dir}, code=${code}`);
        this.watchers.delete(dir);
        watcher.close().catch(() => undefined);
        try {
          const fallback = this.createWatcher(dir, true);
          this.watchers.set(dir, fallback);
        } catch (fallbackError) {
          this.logger.error(fallbackError, `目录监听回退失败: ${dir}`);
        }
        return;
      }
      this.logger.error(error, `目录监听异常: ${dir}`);
    });
    return watcher;
  }

  private async findDirByPath(path: string): Promise<VideoFileDir | null> {
    const dirs = await db.select().from(fileDirsTable).where(eq(fileDirsTable.enabled, true));
    let matched: VideoFileDir | null = null;
    for (const dir of dirs) {
      if (!path.startsWith(dir.path)) continue;
      if (!matched || dir.path.length > matched.path.length) {
        matched = { id: dir.id, path: dir.path };
      }
    }
    return matched;
  }

  async processFile(dir: VideoFileDir, relativePath: string, options: ProcessFileOptions = {}): Promise<boolean> {
    if (!this.isAllowedVideoPath(relativePath)) return true;
    const path = join(dir.path, relativePath);
    this.logger.debug(`开始处理文件: ${relativePath}`);
    const record = await db.query.videoFilesTable.findFirst({
      where: and(eq(videoFilesTable.fileKey, relativePath), eq(videoFilesTable.fileDirId, dir.id)),
    });

    const matchedIndexStrategy = await videoFileIndexStrategiesService.findMatchingEnabledStrategy(dir.id, relativePath);
    if (matchedIndexStrategy) {
      if (record) {
        await db
          .delete(videoFilesTable)
          .where(and(eq(videoFilesTable.fileKey, relativePath), eq(videoFilesTable.fileDirId, dir.id)));
        videoFilesService.invalidateFolderCaches(dir.id);
        this.logger.debug(
          `命中索引黑名单策略，已移除索引记录: ${path}, strategyId=${matchedIndexStrategy.id}`
        );
      } else {
        this.logger.debug(`命中索引黑名单策略，跳过索引: ${path}, strategyId=${matchedIndexStrategy.id}`);
      }
      return true;
    }

    const { size, mtime } = await stat(path);
    const ext = extname(relativePath).toLowerCase();
    const isMp4 = ext === ".mp4";
    const mediaMetadataIncomplete =
      !!record &&
      (record.videoCodec == null ||
        (isMp4 && (record.mp4MoovAtomOffset == null || record.mp4MoovBeforeMdat == null)));

    if (
      !options.force &&
      record &&
      size === Number(record.fileSize) &&
      mtime.getTime() === record.fileModifiedAt.getTime() &&
      !mediaMetadataIncomplete
    ) {
      this.logger.debug(`文件未变更，跳过文件: ${path}`);
      return true;
    }

    let uniqueId: string;
    if (!options.force && record) {
      const nextUniqueId = await getFileUniqueId(path);
      if (nextUniqueId === record.uniqueId && !mediaMetadataIncomplete) {
        await db
          .update(videoFilesTable)
          .set({
            fileSize: size,
            fileModifiedAt: mtime,
            updatedAt: new Date(),
          })
          .where(eq(videoFilesTable.id, record.id));
        this.logger.debug(`文件特征值未变化，跳过重索引: ${path}`);
        return true;
      }
      uniqueId = nextUniqueId;
    } else {
      uniqueId = await getFileUniqueId(path);
    }

    const mediaInfo = await ffmpegManager.getVideoMediaInfo(path);
    const durationRaw = mediaInfo.durationSec;
    const durationSeconds = durationRaw == null ? 0 : durationRaw;
    if (Number.isNaN(durationSeconds)) {
      this.logger.warn(`无法解析视频时长，跳过文件: ${path}`);
      return false;
    }
    const mp4MoovInfo =
      isMp4
        ? await inspectMp4MoovAtom(path)
        : { moovOffset: null, mdatOffset: null, moovBeforeMdat: null };

    let videoFileId: number | null = null;
    try {
      await db.transaction(async (tx) => {
        let unique = await tx.query.videoFileUniquesTable.findFirst({
          where: eq(videoFileUniquesTable.uniqueId, uniqueId),
        });
        if (!unique) {
          const created = await tx.insert(videoFileUniquesTable).values({ uniqueId }).returning();
          unique = created[0];
        }
        if (record) {
          const updated = await tx
            .update(videoFilesTable)
            .set({
              fileKey: relativePath,
              uniqueId: unique.uniqueId,
              fileSize: size,
              fileModifiedAt: mtime,
              fileDirId: dir.id,
              videoDuration: Math.round(durationSeconds),
              videoCodec: mediaInfo.videoCodec,
              audioCodec: mediaInfo.audioCodec,
              mp4MoovAtomOffset: mp4MoovInfo.moovOffset,
              mp4MdatAtomOffset: mp4MoovInfo.mdatOffset,
              mp4MoovBeforeMdat: mp4MoovInfo.moovBeforeMdat,
              updatedAt: new Date(),
            })
            .where(eq(videoFilesTable.id, record.id))
            .returning({ id: videoFilesTable.id });
          videoFileId = updated[0]?.id ?? null;
        } else {
          const created = await tx
            .insert(videoFilesTable)
            .values({
              fileKey: relativePath,
              uniqueId: unique.uniqueId,
              fileSize: size,
              fileModifiedAt: mtime,
              fileDirId: dir.id,
              videoDuration: Math.round(durationSeconds),
              videoCodec: mediaInfo.videoCodec,
              audioCodec: mediaInfo.audioCodec,
              mp4MoovAtomOffset: mp4MoovInfo.moovOffset,
              mp4MdatAtomOffset: mp4MoovInfo.mdatOffset,
              mp4MoovBeforeMdat: mp4MoovInfo.moovBeforeMdat,
            })
            .returning({ id: videoFilesTable.id });
          videoFileId = created[0]?.id ?? null;
        }
      });
    } catch (error) {
      this.logger.error(error, `写入数据库失败: ${path}, fileDirId=${dir.id}`);
      throw error;
    }
    if (videoFileId == null) {
      this.logger.warn(`写入数据库未返回视频文件 ID: ${path}, fileDirId=${dir.id}`);
      return false;
    }
    videoFilesService.invalidateFolderCaches(dir.id);

    const thumbnailKey = `${uniqueId}.jpg`;
    const hasExistingThumbnail = fileManager.exists(thumbnailKey, FileCategory.Thumbnails);
    let thumbnailReady = hasExistingThumbnail;
    if (options.replaceThumbnail === true || !hasExistingThumbnail) {
      const thumbBuf = await ffmpegManager.generateThumbnail(path, { durationSec: durationSeconds });
      if (thumbBuf) {
        await fileManager.write(thumbnailKey, FileCategory.Thumbnails, thumbBuf);
        thumbnailReady = true;
      } else if (!hasExistingThumbnail) {
        thumbnailReady = false;
      }
    } else {
      this.logger.debug(`缩略图已存在，默认不覆盖: ${thumbnailKey}`);
    }

    if (thumbnailReady) {
      const contents = await db.query.videoUniqueContentsTable.findMany({
        where: eq(videoUniqueContentsTable.uniqueId, uniqueId),
        columns: { videoId: true },
      });
      for (const c of contents) {
        await db
          .update(videosTable)
          .set({ thumbnailKey, updatedAt: new Date() })
          .where(eq(videosTable.id, c.videoId));
      }
      if (contents.length > 0) {
        this.logger.debug(`缩略图已更新: ${thumbnailKey}, 关联 ${contents.length} 个视频`);
      }
    }

    if (!options.skipAutoVideoBind) {
      const videoFile = await db.query.videoFilesTable.findFirst({
        where: eq(videoFilesTable.id, videoFileId),
      });
      if (videoFile?.fileDirId != null) {
        const content = await db.query.videoUniqueContentsTable.findFirst({
          where: eq(videoUniqueContentsTable.uniqueId, uniqueId),
          columns: { videoId: true },
        });
        if (!content) {
          const video = await (await import("./videos")).videosService.insertVideoFromVideoFile(
            videoFile as VideoFile,
            { autoExtract: true, waitForAutoExtract: false }
          );
          if (video) {
            this.logger.debug(`已自动创建视频并应用策略: ${path}`);
          }
        } else {
          await (await import("./bindingStrategies")).bindingStrategiesService.applyMatchingStrategiesForVideoFile(
            { fileDirId: videoFile.fileDirId, fileKey: videoFile.fileKey },
            content.videoId
          );
          this.logger.debug(`已自动应用策略: ${path}`);
        }
      }
    }

    this.logger.debug(
      `文件已处理: ${path}, 唯一ID: ${uniqueId}, 时长: ${durationSeconds}秒, 视频编码: ${mediaInfo.videoCodec ?? "-"}, 音频编码: ${mediaInfo.audioCodec ?? "-"}, moov前置: ${mp4MoovInfo.moovBeforeMdat ?? "-"}`
    );
    return true;
  }

  async handleFileChange(path: string) {
    if (!this.isAllowedVideoPath(path)) return;
    this.logger.debug(`文件变更: ${path}`);
    const dir = await this.findDirByPath(path);
    if (!dir) {
      this.logger.warn(`未匹配到目录，跳过文件: ${path}`);
      return;
    }
    const relativePath = relative(dir.path, path);
    await this.processFile(dir, relativePath);
  }

  async handleFileDelete(path: string) {
    if (!this.isAllowedVideoPath(path)) return;
    this.logger.debug(`文件删除: ${path}`);
    const dir = await this.findDirByPath(path);
    if (!dir) {
      this.logger.warn(`未匹配到目录，跳过文件: ${path}`);
      return;
    }
    const relativePath = relative(dir.path, path);
    await db.delete(videoFilesTable).where(and(eq(videoFilesTable.fileKey, relativePath), eq(videoFilesTable.fileDirId, dir.id)));
    videoFilesService.invalidateFolderCaches(dir.id);
  }

  async initWatchers(dirs: string[]) {
    const toDeleteWathcerDirs = Array.from(this.watchers.keys()).filter(dir => !dirs.includes(dir));
    for (const dir of toDeleteWathcerDirs) {
      const watcher = this.watchers.get(dir);
      if (watcher) {
        await watcher.close().catch(() => undefined);
      }
      this.watchers.delete(dir);
    }

    const toAddWatcherDirs = dirs.filter(dir => !this.watchers.has(dir));
    for (const dir of toAddWatcherDirs) {
      try {
        const watcher = this.createWatcher(dir, FILE_WATCH_USE_POLLING);
        this.watchers.set(dir, watcher);
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (!FILE_WATCH_USE_POLLING && (err.code === "EINVAL" || err.code === "ENOSYS")) {
          this.logger.warn(`目录监听创建失败，尝试轮询模式: ${dir}, code=${err.code}`);
          try {
            const pollingWatcher = this.createWatcher(dir, true);
            this.watchers.set(dir, pollingWatcher);
          } catch (fallbackError) {
            this.logger.error(fallbackError, `目录监听创建失败(轮询): ${dir}`);
          }
        } else {
          this.logger.error(error, `目录监听创建失败: ${dir}`);
        }
      }
    }
  }

  async getDirs(): Promise<VideoFileDir[]> {
    const dirs = await db.select().from(fileDirsTable).where(eq(fileDirsTable.enabled, true));
    return dirs.map((dir) => ({ id: dir.id, path: dir.path }));
  }

  /** 根据 videoFileId 获取视频文件的物理路径 */
  async getVideoFilePath(videoFileId: number): Promise<string | null> {
    const info = await this.getVideoFileInfo(videoFileId);
    return info?.path ?? null;
  }

  /** 根据 videoFileId 获取视频文件路径和大小（用于 Range 请求） */
  async getVideoFileInfo(videoFileId: number): Promise<{ path: string; fileSize: number } | null> {
    const row = await db.query.videoFilesTable.findFirst({
      where: eq(videoFilesTable.id, videoFileId),
      columns: { fileKey: true, fileDirId: true, fileSize: true },
      with: { fileDir: { columns: { path: true } } },
    });
    if (!row?.fileDir?.path) return null;
    return {
      path: join(row.fileDir.path, row.fileKey),
      fileSize: Number(row.fileSize) || 0,
    };
  }

  private hasRunningTask() {
    return !!this.scanTask && (this.scanTask.status === "processing" || this.scanTask.status === "paused");
  }

  getScanTaskSnapshot(): VideoFileScanTaskSnapshot | null {
    const task = this.scanTask;
    if (!task) return null;
    return {
      dir: task.dir,
      currentFile: task.currentFile,
      currentFileCount: task.currentFileCount,
      totalFileCount: task.totalFileCount,
      status: task.status,
      error: task.error?.message ?? null,
      force: task.force,
    };
  }

  async startScanTask(dir: VideoFileDir, options: StartScanTaskOptions = {}) {
    if (this.hasRunningTask()) {
      throw new Error("任务正在运行中");
    }
    const force = options.force ?? false;
    this.scanTask = new VideoFileDirScanTask(
      dir,
      (scanDir, relativePath) => this.processFile(scanDir, relativePath, { force }),
      force
    );
    this.scanTaskRunPromise = this.scanTask.start();
    if (options.waitForCompletion) {
      await this.scanTaskRunPromise;
    }
    return this.getScanTaskSnapshot();
  }

  async startScanTaskByDirId(fileDirId: number, options: StartScanTaskOptions = {}) {
    const dirs = await this.getDirs();
    const dir = dirs.find((item) => item.id === fileDirId);
    if (!dir) throw new Error("目录不存在或未启用");
    return this.startScanTask(dir, options);
  }

  pauseScanTask() {
    this.scanTask?.pause();
  }

  resumeScanTask() {
    this.scanTask?.resume();
  }

  stopScanTask() {
    this.scanTask?.stop();
  }

  cancelScanTask() {
    this.scanTask?.cancel();
  }

  private async runInitScan(dirs: VideoFileDir[], sequence: number) {
    for (const dir of dirs) {
      if (sequence !== this.initScanSequence) return;
      if (this.hasRunningTask()) {
        this.logger.info("已有运行中的索引任务，跳过自动索引");
        return;
      }
      try {
        await this.startScanTask(dir, { waitForCompletion: true, force: false });
      } catch (error) {
        this.logger.error(error, `自动索引目录失败: ${dir.path}`);
      }
    }
  }

  async init() {
    const dirs = await this.getDirs();

    this.logger.info(`监听目录数量：${dirs.length}`);

    await this.initWatchers(dirs.map((dir) => dir.path));
    this.initScanSequence += 1;
    const sequence = this.initScanSequence;
    void this.runInitScan(dirs, sequence);
  }
}

export const videoFileManager = new VideoFileManager();
