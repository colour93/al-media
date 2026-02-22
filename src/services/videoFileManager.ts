import chokidar, { FSWatcher } from "chokidar";
import { readdir, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { db } from "../db";
import { fileDirsTable } from "../entities/FileDir";
import { and, eq } from "drizzle-orm";
import { createLogger } from "../utils/logger";
import { getFileCount, getFileUniqueId } from "../utils/file";
import { videoFilesTable } from "../entities/VideoFile";
import { videosTable } from "../entities/Video";
import { videoUniqueContentsTable } from "../entities/VideoUniqueContent";
import { ffmpegManager } from "./ffmpegManager";
import { videoFileUniquesTable } from "../entities/VideoFileUnique";
import { fileManager, FileCategory } from "./fileManager";

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

interface VideoFileDir {
  id: number;
  path: string;
}

class VideoFileDirScanTask {
  public dir: VideoFileDir;
  public currentFile: string | null;
  public currentFileCount: number;
  public totalFileCount: number;
  public status: "pending" | "paused" | "processing" | "completed" | "failed" | "aborted" | "stopped";
  public error: Error | null;
  private logger = createLogger("video-file-scan-task");
  private runPromise: Promise<void> | null = null;
  private pausePromise: Promise<void> | null = null;
  private resumeResolver: (() => void) | null = null;
  private stopRequested = false;
  private cancelRequested = false;
  private readonly fileProcessor: (dir: VideoFileDir, relativePath: string) => Promise<boolean>;

  constructor(dir: VideoFileDir, fileProcessor: (dir: VideoFileDir, relativePath: string) => Promise<boolean>) {
    this.dir = dir;
    this.fileProcessor = fileProcessor;
    this.currentFile = null;
    this.currentFileCount = 0;
    this.status = "pending";
    this.error = null;
    this.totalFileCount = 0;
    getFileCount(dir.path, ALLOWED_EXT).then(count => {
      this.totalFileCount = count;
    });
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
      throw new Error("scan task cancelled");
    }
    if (this.stopRequested) {
      throw new Error("scan task stopped");
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
      } else {
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
      await this.processDir(this.dir.path);
      if (this.cancelRequested) {
        this.status = "aborted";
      } else if (this.stopRequested) {
        this.status = "stopped";
      } else {
        this.complete();
      }
    } catch (error) {
      if (error instanceof Error && error.message === "scan task cancelled") {
        this.status = "aborted";
        return;
      }
      if (error instanceof Error && error.message === "scan task stopped") {
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

  async processFile(dir: VideoFileDir, relativePath: string): Promise<boolean> {
    if (!ALLOWED_EXT.has(extname(relativePath))) return true;
    const path = join(dir.path, relativePath);
    this.logger.debug(`开始处理文件: ${relativePath}`);
    const record = await db.query.videoFilesTable.findFirst({
      where: and(eq(videoFilesTable.fileKey, relativePath), eq(videoFilesTable.fileDirId, dir.id)),
    });

    const { size, mtime } = await stat(path);
    if (record && size === Number(record.fileSize) && mtime.getTime() === record.fileModifiedAt.getTime()) {
      this.logger.debug(`文件未变更，跳过文件: ${path}`);
      return true;
    }

    const uniqueId = await getFileUniqueId(path);
    const durationRaw = await ffmpegManager.getVideoDuration(path);
    const durationSeconds = durationRaw == null ? 0 : durationRaw;
    if (Number.isNaN(durationSeconds)) {
      this.logger.warn(`无法解析视频时长，跳过文件: ${path}`);
      return false;
    }

    try {
      await db.transaction(async (tx) => {
        let unique = await tx.query.videoFileUniquesTable.findFirst({
          where: eq(videoFileUniquesTable.uniqueId, uniqueId),
        });
        if (!unique) {
          const created = await tx.insert(videoFileUniquesTable).values({ uniqueId }).returning();
          unique = created[0];
        }
        await tx
          .insert(videoFilesTable)
          .values({
            fileKey: relativePath,
            uniqueId: unique.uniqueId,
            fileSize: size,
            fileModifiedAt: mtime,
            fileDirId: dir.id,
            videoDuration: Math.round(durationSeconds),
          })
          .returning({ id: videoFilesTable.id });
      });
    } catch (error) {
      this.logger.error(error, `写入数据库失败: ${path}, fileDirId=${dir.id}`);
      throw error;
    }

    const thumbBuf = await ffmpegManager.generateThumbnail(path);
    if (thumbBuf) {
      const thumbnailKey = `${uniqueId}.jpg`;
      await fileManager.write(thumbnailKey, FileCategory.Thumbnails, thumbBuf);
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

    this.logger.debug(`文件已处理: ${path}, 唯一ID: ${uniqueId}, 时长: ${durationSeconds}秒`);
    return true;
  }

  async handleFileChange(path: string) {
    if (!ALLOWED_EXT.has(extname(path))) return;
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
    if (!ALLOWED_EXT.has(extname(path))) return;
    this.logger.debug(`文件删除: ${path}`);
    const dir = await this.findDirByPath(path);
    if (!dir) {
      this.logger.warn(`未匹配到目录，跳过文件: ${path}`);
      return;
    }
    const relativePath = relative(dir.path, path);
    await db.delete(videoFilesTable).where(and(eq(videoFilesTable.fileKey, relativePath), eq(videoFilesTable.fileDirId, dir.id)));
  }

  async initWatchers(dirs: string[]) {
    const toDeleteWathcerDirs = Array.from(this.watchers.keys()).filter(dir => !dirs.includes(dir));
    for (const dir of toDeleteWathcerDirs) {
      this.watchers.get(dir)?.close();
      this.watchers.delete(dir);
    }

    const toAddWatcherDirs = dirs.filter(dir => !this.watchers.has(dir));
    for (const dir of toAddWatcherDirs) {
      const watcher = chokidar.watch(dir, {
        ignoreInitial: true,
        persistent: true,
      });
      watcher.on("add", path => this.handleFileChange(path));
      watcher.on("change", path => this.handleFileChange(path));
      watcher.on("unlink", path => this.handleFileDelete(path));
      this.watchers.set(dir, watcher);
    }
  }

  async getDirs(): Promise<VideoFileDir[]> {
    const dirs = await db.select().from(fileDirsTable).where(eq(fileDirsTable.enabled, true));
    return dirs.map((dir) => ({ id: dir.id, path: dir.path }));
  }

  async startScanTask(dir: VideoFileDir) {
    if (this.scanTask && (this.scanTask.status === "processing" || this.scanTask.status === "paused")) {
      throw new Error("任务正在运行中");
    }
    this.scanTask = new VideoFileDirScanTask(dir, this.processFile.bind(this));
    await this.scanTask.start();
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

  async init() {
    const dirs = await this.getDirs()

    this.logger.info(`监听目录数量：${dirs.length}`);

    this.initWatchers(dirs.map(dir => dir.path));
    for (const dir of dirs) {
      this.startScanTask(dir);
    }
  }
}

export const videoFileManager = new VideoFileManager();