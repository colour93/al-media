import { eq, ilike, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { VideoFile } from "../entities/VideoFile";
import { videosTable } from "../entities/Video";
import { basename } from "node:path";
import { videoUniqueContentsTable } from "../entities/VideoUniqueContent";
import { videoFilesTable } from "../entities/VideoFile";
import { videoActorsTable } from "../entities/VideoActor";
import { videoCreatorsTable } from "../entities/VideoCreator";
import { videoDistributorsTable } from "../entities/VideoDistributor";
import { videoTagsTable } from "../entities/VideoTag";
import { actorsTable } from "../entities/Actor";
import { creatorsTable } from "../entities/Creator";
import { distributorsTable } from "../entities/Distributor";
import { userVideoHistoriesTable } from "../entities/UserVideoHistory";
import { fileManager, FileCategory } from "./fileManager";
import { ffmpegManager } from "./ffmpegManager";
import { videoFileManager } from "./videoFileManager";
import { actorsService } from "./actors";
import { bindingStrategiesService } from "./bindingStrategies";
import { creatorsService } from "./creators";
import { distributorsService } from "./distributors";
import { tagsService } from "./tags";
import type { PaginatedResult } from "../utils/pagination";
import OpenAI from "openai";
import { createLogger } from "../utils/logger";
import { buildCommonSignedVideoFileUrl, buildSignedVideoFileUrl } from "../utils/videoFileSign";
import { evaluateVideoWebCompatibility } from "../utils/videoWebCompatibility";

export type CreateVideoInput = {
  title: string;
  thumbnailKey?: string | null;
  actors?: number[];
  creators?: number[];
  distributors?: number[];
  tags?: number[];
};

export type UpdateVideoInput = {
  title?: string;
  thumbnailKey?: string | null;
  actors?: number[];
  creators?: number[];
  distributors?: number[];
  tags?: number[];
  isFeatured?: boolean;
  isBanner?: boolean;
  bannerOrder?: number | null;
  recommendedOrder?: number | null;
};

const videoWithRelations = {
  videoActors: {
    with: {
      actor: {
        with: { actorTags: { with: { tag: { with: { tagType: true } } } } },
      },
    },
  },
  videoCreators: {
    with: {
      creator: {
        with: {
          actor: { with: { actorTags: { with: { tag: { with: { tagType: true } } } } } },
          creatorTags: { with: { tag: { with: { tagType: true } } } },
        },
      },
    },
  },
  videoDistributors: { with: { distributor: true } },
  videoTags: { with: { tag: { with: { tagType: true } } } },
} as const;

function collectTagsFromActor(actor: { actorTags?: Array<{ tag: unknown }> } | null): unknown[] {
  if (!actor?.actorTags) return [];
  return actor.actorTags.map((at) => at.tag).filter((t) => t != null);
}

function collectTagsFromCreator(creator: {
  creatorTags?: Array<{ tag: unknown }>;
  actor?: { actorTags?: Array<{ tag: unknown }> } | null;
} | null): unknown[] {
  if (!creator) return [];
  const fromCreator = (creator.creatorTags ?? []).map((ct) => ct.tag).filter((t) => t != null);
  const fromActor = collectTagsFromActor(creator.actor ?? null);
  return [...fromCreator, ...fromActor];
}

function mergeTagsDedupeById(
  videoTags: unknown[],
  actorTags: unknown[],
  creatorTags: unknown[]
): unknown[] {
  const seen = new Set<number>();
  const result: unknown[] = [];
  for (const tag of [...videoTags, ...actorTags, ...creatorTags]) {
    const t = tag as { id?: number };
    if (t?.id != null && !seen.has(t.id)) {
      seen.add(t.id);
      result.push(tag);
    }
  }
  return result;
}

function toVideoResponse(item: {
  videoActors: Array<{ actor: unknown }>;
  videoCreators: Array<{ creator: unknown }>;
  videoDistributors: Array<{ distributor: unknown }>;
  videoTags: Array<{ tag: unknown }>;
} & Record<string, unknown>) {
  if (!item) return null;
  const { videoActors, videoCreators, videoDistributors, videoTags, ...video } = item;
  const directTags = videoTags.map((it) => it.tag).filter((tag) => tag != null);
  const actorTags = videoActors.flatMap((va) =>
    collectTagsFromActor(va.actor as { actorTags?: Array<{ tag: unknown }> } | null)
  );
  const creatorTags = videoCreators.flatMap((vc) =>
    collectTagsFromCreator(vc.creator as Parameters<typeof collectTagsFromCreator>[0])
  );
  const tags = mergeTagsDedupeById(directTags, actorTags, creatorTags);
  return {
    ...video,
    actors: videoActors.map((it) => it.actor).filter((actor) => actor != null),
    creators: videoCreators.map((it) => it.creator).filter((creator) => creator != null),
    distributors: videoDistributors.map((it) => it.distributor).filter((distributor) => distributor != null),
    tags,
  };
}

function normalizeIds(ids: number[]) {
  return [...new Set(ids)];
}

const VIDEO_SORT_KEYS = ["id", "title", "createdAt", "updatedAt"] as const;

function buildVideoOrderBy(sortBy?: string, sortOrder?: "asc" | "desc") {
  const col = sortBy && VIDEO_SORT_KEYS.includes(sortBy as (typeof VIDEO_SORT_KEYS)[number])
    ? sortBy
    : "id";
  const isAsc = sortOrder === "asc";
  return (t: typeof videosTable, op: { asc: (c: unknown) => unknown; desc: (c: unknown) => unknown }) =>
    isAsc ? [op.asc(t[col as keyof typeof t])] : [op.desc(t[col as keyof typeof t])];
}

export type InferVideoInfoResult = {
  title: string;
  creator?: string | null;
  creatorType?: "person" | "group";
  distributors?: string[];
  actors?: string[];
};

type VideoInferTaskSource = "admin-infer-preview" | "video-re-extract" | "video-auto-extract";

export type VideoInferTaskSnapshot = {
  status: "idle" | "processing" | "paused";
  waitingCount: number;
  current: {
    source: VideoInferTaskSource;
    target: string;
    startedAt: string;
  } | null;
  lastFinishedAt: string | null;
  lastError: string | null;
};

const extractVideoInfoTool = {
  type: "function" as const,
  function: {
    name: "extract_video_info",
    description: "从视频文件名中提取 title、creator、creatorType、distributors、actors 等信息。无法提取的字段留空，禁止随意填写",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "视频标题" },
        creator: { type: ["string", "null"], description: "创作者，若无法识别则为 null" },
        creatorType: {
          type: "string",
          enum: ["person", "group"],
          description: "创作者类型：person 个人 / group 团体",
        },
        distributors: {
          type: "array",
          items: { type: "string" },
          description: "发行商列表",
        },
        actors: {
          type: "array",
          items: { type: "string" },
          description: "参与者/演员列表",
        },
      },
      required: ["title"],
      additionalProperties: false,
    },
  },
};

class VideosService {
  private openai: OpenAI;

  private logger = createLogger("videos-service");

  private inferQueue: Promise<void> = Promise.resolve();

  private inferWaitingCount = 0;

  private inferRunning: { source: VideoInferTaskSource; target: string; startedAt: Date } | null = null;

  private inferPaused = false;

  private inferResumePromise: Promise<void> | null = null;

  private inferResumeResolver: (() => void) | null = null;

  private inferLastFinishedAt: Date | null = null;

  private inferLastError: string | null = null;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL });
  }

  getInferTaskSnapshot(): VideoInferTaskSnapshot {
    return {
      status: this.inferRunning ? "processing" : this.inferPaused ? "paused" : "idle",
      waitingCount: this.inferWaitingCount,
      current: this.inferRunning
        ? {
            source: this.inferRunning.source,
            target: this.inferRunning.target,
            startedAt: this.inferRunning.startedAt.toISOString(),
          }
        : null,
      lastFinishedAt: this.inferLastFinishedAt ? this.inferLastFinishedAt.toISOString() : null,
      lastError: this.inferLastError,
    };
  }

  pauseInferTask() {
    this.inferPaused = true;
  }

  resumeInferTask() {
    if (!this.inferPaused) return;
    this.inferPaused = false;
    const resolver = this.inferResumeResolver;
    this.inferResumeResolver = null;
    this.inferResumePromise = null;
    resolver?.();
  }

  private async waitForInferResume() {
    while (this.inferPaused) {
      if (!this.inferResumePromise) {
        this.inferResumePromise = new Promise<void>((resolve) => {
          this.inferResumeResolver = resolve;
        });
      }
      await this.inferResumePromise;
    }
  }

  private enqueueInferTask<T>(
    source: VideoInferTaskSource,
    target: string,
    task: () => Promise<T>
  ): Promise<T> {
    this.inferWaitingCount += 1;
    const execute = async () => {
      await this.waitForInferResume();
      this.inferWaitingCount = Math.max(0, this.inferWaitingCount - 1);
      this.inferRunning = { source, target, startedAt: new Date() };
      try {
        const result = await task();
        this.inferLastError = null;
        return result;
      } catch (error) {
        this.inferLastError = error instanceof Error ? error.message : String(error);
        throw error;
      } finally {
        this.inferLastFinishedAt = new Date();
        this.inferRunning = null;
      }
    };

    const next = this.inferQueue.then(execute, execute);
    this.inferQueue = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  private toLikePattern(value: string) {
    return `%${value.trim()}%`;
  }

  private normalizeName(value: string) {
    return value.trim().replace(/\s+/g, " ");
  }

  private dedupeNames(values: string[]) {
    const deduped = new Map<string, string>();
    for (const value of values) {
      const normalized = this.normalizeName(value);
      if (!normalized) continue;
      const key = normalized.toLowerCase();
      if (!deduped.has(key)) {
        deduped.set(key, normalized);
      }
    }
    return Array.from(deduped.values());
  }

  private attachVideoMetaAndCompatibility(
    shapedVideos: unknown[],
    metaMap: Map<number, { videoDuration?: number; fileSize?: number; playCount: number }>,
    videoFileInfoMap: Map<
      number,
      {
        id: number;
        fileKey: string;
        videoCodec: string | null;
        audioCodec: string | null;
        mp4MoovBeforeMdat: boolean | null;
      }
    >
  ) {
    return shapedVideos.map((s) => {
      const videoId = (s as { id: number }).id;
      const meta = metaMap.get(videoId);
      const videoFileInfo = videoFileInfoMap.get(videoId) ?? null;
      const compatibility = evaluateVideoWebCompatibility({
        fileKey: videoFileInfo?.fileKey ?? null,
        videoCodec: videoFileInfo?.videoCodec ?? null,
        audioCodec: videoFileInfo?.audioCodec ?? null,
        mp4MoovBeforeMdat: videoFileInfo?.mp4MoovBeforeMdat ?? null,
      });
      return {
        ...s,
        ...(meta?.videoDuration != null ? { videoDuration: meta.videoDuration } : {}),
        ...(meta?.fileSize != null ? { fileSize: meta.fileSize } : {}),
        playCount: meta?.playCount ?? 0,
        ...(videoFileInfo ? {
          videoFileVideoCodec: videoFileInfo.videoCodec,
          videoFileAudioCodec: videoFileInfo.audioCodec,
          videoFileMp4MoovBeforeMdat: videoFileInfo.mp4MoovBeforeMdat,
        } : {}),
        ...compatibility,
      };
    });
  }

  private extractCandidateNames(filename: string) {
    const name = filename.replace(/\.[^.]+$/, "");
    const candidates: string[] = [];

    for (const match of name.matchAll(/\[([^[\]]+)\]/g)) {
      const raw = match[1] ?? "";
      const splitParts = raw.split(/[,&/|+，、]/g);
      for (const part of splitParts) {
        const cleaned = this.normalizeName(part);
        if (cleaned.length >= 2) {
          candidates.push(cleaned);
        }
      }
    }

    for (const handle of name.match(/@[\w.-]+/g) ?? []) {
      const cleaned = this.normalizeName(handle);
      if (cleaned.length >= 2) {
        candidates.push(cleaned);
      }
    }

    return this.dedupeNames(candidates);
  }

  private async findMatchedHints(filename: string) {
    const candidates = this.extractCandidateNames(filename);
    if (!candidates.length) {
      return {
        creatorGroups: [] as string[],
        creatorPersons: [] as string[],
        distributors: [] as string[],
        actors: [] as string[],
      };
    }

    const creatorGroups = new Set<string>();
    const creatorPersons = new Set<string>();
    const distributors = new Set<string>();
    const actors = new Set<string>();

    for (const candidate of candidates) {
      const pattern = this.toLikePattern(candidate);
      const [creator, distributor, actor] = await Promise.all([
        db.query.creatorsTable.findFirst({
          where: ilike(creatorsTable.name, pattern),
          columns: { name: true, type: true },
        }),
        distributorsService.findByNameOrNormalized(candidate),
        db.query.actorsTable.findFirst({
          where: ilike(actorsTable.name, pattern),
          columns: { name: true },
        }),
      ]);

      if (creator?.name) {
        if (creator.type === "group") {
          creatorGroups.add(creator.name);
        } else {
          creatorPersons.add(creator.name);
        }
      }
      if (distributor?.name) {
        distributors.add(distributor.name);
      }
      if (actor?.name) {
        actors.add(actor.name);
      }
    }

    return {
      creatorGroups: Array.from(creatorGroups),
      creatorPersons: Array.from(creatorPersons),
      distributors: Array.from(distributors),
      actors: Array.from(actors),
    };
  }

  private async resolveInfoWithDatabase(info: InferVideoInfoResult): Promise<InferVideoInfoResult> {
    const creatorInput = info.creator ? this.normalizeName(info.creator) : null;
    let creator: string | null = creatorInput;
    let creatorType = info.creatorType;

    if (creatorInput) {
      const foundCreator = await db.query.creatorsTable.findFirst({
        where: ilike(creatorsTable.name, this.toLikePattern(creatorInput)),
        columns: { name: true, type: true },
      });
      if (foundCreator) {
        creator = foundCreator.name;
        creatorType = foundCreator.type;
      }
    }

    const resolvedDistributors: string[] = [];
    for (const name of this.dedupeNames(info.distributors ?? [])) {
      const found = await distributorsService.findByNameOrNormalized(name);
      resolvedDistributors.push(found?.name ?? name);
    }

    const resolvedactors: string[] = [];
    for (const name of this.dedupeNames(info.actors ?? [])) {
      const found = await db.query.actorsTable.findFirst({
        where: ilike(actorsTable.name, this.toLikePattern(name)),
        columns: { name: true },
      });
      resolvedactors.push(found?.name ?? name);
    }

    return {
      title: info.title,
      creator,
      creatorType,
      distributors: this.dedupeNames(resolvedDistributors),
      actors: this.dedupeNames(resolvedactors),
    };
  }

  async findManyPaginated(
    page: number,
    pageSize: number,
    offset: number,
    sortBy?: string,
    sortOrder?: "asc" | "desc"
  ): Promise<PaginatedResult<unknown>> {
    const orderByFn = buildVideoOrderBy(sortBy, sortOrder);
    const [items, total] = await Promise.all([
      db.query.videosTable.findMany({
        orderBy: orderByFn as Parameters<typeof db.query.videosTable.findMany>[0]["orderBy"],
        limit: pageSize,
        offset,
        with: videoWithRelations,
      }),
      db.$count(videosTable),
    ]);
    const shaped = (items as Parameters<typeof toVideoResponse>[0][]).map((it) => toVideoResponse(it));
    const videoIds = shaped.map((s) => (s as { id: number }).id);
    const [metaMap, videoFileInfoMap] = await Promise.all([
      this.getVideoFileMetaMap(videoIds),
      this.getVideoFileInfoMapForVideos(videoIds),
    ]);
    const enriched = this.attachVideoMetaAndCompatibility(shaped, metaMap, videoFileInfoMap);
    return { page, pageSize, total: total ?? 0, items: enriched };
  }

  async searchPaginated(
    keyword: string,
    page: number,
    pageSize: number,
    offset: number,
    sortBy?: string,
    sortOrder?: "asc" | "desc"
  ): Promise<PaginatedResult<unknown>> {
    const keywordTrimmed = keyword.trim();
    const numericKeyword = keywordTrimmed.startsWith("#")
      ? keywordTrimmed.slice(1)
      : keywordTrimmed;
    const condition =
      /^\d+$/.test(numericKeyword) && Number.isSafeInteger(Number(numericKeyword)) && Number(numericKeyword) > 0
        ? eq(videosTable.id, Number(numericKeyword))
        : ilike(videosTable.title, `%${keywordTrimmed}%`);
    const orderByFn = buildVideoOrderBy(sortBy, sortOrder);
    const [items, total] = await Promise.all([
      db.query.videosTable.findMany({
        where: condition,
        orderBy: orderByFn as Parameters<typeof db.query.videosTable.findMany>[0]["orderBy"],
        limit: pageSize,
        offset,
        with: videoWithRelations,
      }),
      db.$count(videosTable, condition),
    ]);
    const shaped = (items as Parameters<typeof toVideoResponse>[0][]).map((it) => toVideoResponse(it));
    const videoIds = shaped.map((s) => (s as { id: number }).id);
    const [metaMap, videoFileInfoMap] = await Promise.all([
      this.getVideoFileMetaMap(videoIds),
      this.getVideoFileInfoMapForVideos(videoIds),
    ]);
    const enriched = this.attachVideoMetaAndCompatibility(shaped, metaMap, videoFileInfoMap);
    return { page, pageSize, total: total ?? 0, items: enriched };
  }

  async findById(id: number, options?: { useCommonUrl?: boolean; pathOnly?: boolean }) {
    const rows = await this.findManyByIds([id], options);
    return rows[0] ?? null;
  }

  async findManyByIds(
    videoIds: number[],
    options?: { useCommonUrl?: boolean; pathOnly?: boolean }
  ) {
    const uniqueIds = normalizeIds(videoIds).filter((id) => Number.isInteger(id) && id > 0);
    if (uniqueIds.length === 0) return [];
    const [items, videoFileInfoMap, metaMap] = await Promise.all([
      db.query.videosTable.findMany({
        where: inArray(videosTable.id, uniqueIds),
        with: videoWithRelations,
      }),
      this.getVideoFileInfoMapForVideos(uniqueIds),
      this.getVideoFileMetaMap(uniqueIds),
    ]);
    const itemMap = new Map<number, unknown>(
      (items as Array<{ id: number }>).map((item) => [item.id, item as unknown])
    );
    return uniqueIds
      .map((videoId) => {
        const item = itemMap.get(videoId) as Parameters<typeof toVideoResponse>[0] | undefined;
        if (!item) return null;
        const shaped = toVideoResponse(item);
        const videoFileInfo = videoFileInfoMap.get(videoId) ?? null;
        const videoFileUrl = videoFileInfo
          ? options?.useCommonUrl
            ? buildCommonSignedVideoFileUrl(videoFileInfo.id, options.pathOnly ?? false)
            : buildSignedVideoFileUrl(videoFileInfo.id)
          : null;
        const meta = metaMap.get(videoId);
        const compatibility = evaluateVideoWebCompatibility({
          fileKey: videoFileInfo?.fileKey ?? null,
          videoCodec: videoFileInfo?.videoCodec ?? null,
          audioCodec: videoFileInfo?.audioCodec ?? null,
          mp4MoovBeforeMdat: videoFileInfo?.mp4MoovBeforeMdat ?? null,
        });
        return {
          ...shaped,
          videoFileUrl,
          videoFileKey: videoFileInfo?.fileKey ?? null,
          ...(meta?.videoDuration != null ? { videoDuration: meta.videoDuration } : {}),
          ...(meta?.fileSize != null ? { fileSize: meta.fileSize } : {}),
          playCount: meta?.playCount ?? 0,
          ...(videoFileInfo ? {
            videoFileVideoCodec: videoFileInfo.videoCodec,
            videoFileAudioCodec: videoFileInfo.audioCodec,
            videoFileMp4MoovBeforeMdat: videoFileInfo.mp4MoovBeforeMdat,
          } : {}),
          ...compatibility,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item != null);
  }

  async findRecommended() {
    const items = await db.query.videosTable.findMany({
      where: eq(videosTable.isFeatured, true),
      orderBy: (t, { asc }) => [asc(t.recommendedOrder), asc(t.id)],
      with: videoWithRelations,
    });
    const shaped = (items as Parameters<typeof toVideoResponse>[0][]).map((it) => toVideoResponse(it));
    const videoIds = shaped.map((s) => (s as { id: number }).id);
    const [metaMap, videoFileInfoMap] = await Promise.all([
      this.getVideoFileMetaMap(videoIds),
      this.getVideoFileInfoMapForVideos(videoIds),
    ]);
    return this.attachVideoMetaAndCompatibility(shaped, metaMap, videoFileInfoMap);
  }

  async findBanner() {
    const items = await db.query.videosTable.findMany({
      where: eq(videosTable.isBanner, true),
      orderBy: (t, { asc }) => [asc(t.bannerOrder), asc(t.id)],
      with: videoWithRelations,
    });
    const shaped = (items as Parameters<typeof toVideoResponse>[0][]).map((it) => toVideoResponse(it));
    const videoIds = shaped.map((s) => (s as { id: number }).id);
    const [metaMap, videoFileInfoMap] = await Promise.all([
      this.getVideoFileMetaMap(videoIds),
      this.getVideoFileInfoMapForVideos(videoIds),
    ]);
    return this.attachVideoMetaAndCompatibility(shaped, metaMap, videoFileInfoMap);
  }

  async findLatest(page: number, pageSize: number, offset: number): Promise<PaginatedResult<unknown>> {
    const [items, total] = await Promise.all([
      db.query.videosTable.findMany({
        orderBy: (t, { desc }) => [desc(t.createdAt)],
        limit: pageSize,
        offset,
        with: videoWithRelations,
      }),
      db.$count(videosTable),
    ]);
    const shaped = (items as Parameters<typeof toVideoResponse>[0][]).map((it) => toVideoResponse(it));
    const videoIds = shaped.map((s) => (s as { id: number }).id);
    const [metaMap, videoFileInfoMap] = await Promise.all([
      this.getVideoFileMetaMap(videoIds),
      this.getVideoFileInfoMapForVideos(videoIds),
    ]);
    const enriched = this.attachVideoMetaAndCompatibility(shaped, metaMap, videoFileInfoMap);
    return { page, pageSize, total: total ?? 0, items: enriched };
  }

  async batchAddTags(videoIds: number[], tagIds: number[]): Promise<{ added: number }> {
    if (videoIds.length === 0 || tagIds.length === 0) {
      return { added: 0 };
    }
    const allTagsExist = await tagsService.idsExist(tagIds);
    if (!allTagsExist) {
      return { added: 0 };
    }
    let added = 0;
    await db.transaction(async (tx) => {
      for (const videoId of videoIds) {
        const existing = await tx
          .select({ tagId: videoTagsTable.tagId })
          .from(videoTagsTable)
          .where(eq(videoTagsTable.videoId, videoId));
        const existingTagIds = new Set(existing.map((r) => r.tagId));
        for (const tagId of tagIds) {
          if (!existingTagIds.has(tagId)) {
            await tx.insert(videoTagsTable).values({ videoId, tagId });
            added++;
          }
        }
      }
    });
    return { added };
  }

  async batchAddActors(videoIds: number[], actorIds: number[]): Promise<{ added: number }> {
    if (videoIds.length === 0 || actorIds.length === 0) return { added: 0 };
    const allActorsExist = await actorsService.idsExist(actorIds);
    if (!allActorsExist) return { added: 0 };
    let added = 0;
    await db.transaction(async (tx) => {
      for (const videoId of videoIds) {
        const existing = await tx
          .select({ actorId: videoActorsTable.actorId })
          .from(videoActorsTable)
          .where(eq(videoActorsTable.videoId, videoId));
        const existingActorIds = new Set(existing.map((r) => r.actorId));
        for (const actorId of actorIds) {
          if (!existingActorIds.has(actorId)) {
            await tx.insert(videoActorsTable).values({ videoId, actorId });
            added++;
          }
        }
      }
    });
    return { added };
  }

  async batchAddCreators(videoIds: number[], creatorIds: number[]): Promise<{ added: number }> {
    if (videoIds.length === 0 || creatorIds.length === 0) return { added: 0 };
    const allCreatorsExist = await creatorsService.idsExist(creatorIds);
    if (!allCreatorsExist) return { added: 0 };
    let added = 0;
    await db.transaction(async (tx) => {
      for (const videoId of videoIds) {
        const existing = await tx
          .select({ creatorId: videoCreatorsTable.creatorId })
          .from(videoCreatorsTable)
          .where(eq(videoCreatorsTable.videoId, videoId));
        const existingCreatorIds = new Set(existing.map((r) => r.creatorId));
        for (const creatorId of creatorIds) {
          if (!existingCreatorIds.has(creatorId)) {
            await tx.insert(videoCreatorsTable).values({ videoId, creatorId });
            added++;
          }
        }
      }
    });
    return { added };
  }

  async batchAddDistributors(videoIds: number[], distributorIds: number[]): Promise<{ added: number }> {
    if (videoIds.length === 0 || distributorIds.length === 0) return { added: 0 };
    const allDistributorsExist = await distributorsService.idsExist(distributorIds);
    if (!allDistributorsExist) return { added: 0 };
    let added = 0;
    await db.transaction(async (tx) => {
      for (const videoId of videoIds) {
        const existing = await tx
          .select({ distributorId: videoDistributorsTable.distributorId })
          .from(videoDistributorsTable)
          .where(eq(videoDistributorsTable.videoId, videoId));
        const existingDistributorIds = new Set(existing.map((r) => r.distributorId));
        for (const distributorId of distributorIds) {
          if (!existingDistributorIds.has(distributorId)) {
            await tx.insert(videoDistributorsTable).values({ videoId, distributorId });
            added++;
          }
        }
      }
    });
    return { added };
  }

  /** 从关联视频文件截取缩略图，默认取视频时长 30% 位置，返回新 thumbnailKey */
  async captureThumbnail(
    videoId: number,
    seekSec?: number,
    options?: { replaceExisting?: boolean }
  ): Promise<{ thumbnailKey: string } | { error: string }> {
    const content = await db.query.videoUniqueContentsTable.findFirst({
      where: eq(videoUniqueContentsTable.videoId, videoId),
      columns: { uniqueId: true },
    });
    if (!content) return { error: "视频没有关联的文件" };
    const videoFile = await db.query.videoFilesTable.findFirst({
      where: eq(videoFilesTable.uniqueId, content.uniqueId),
      columns: { id: true, videoDuration: true },
    });
    if (!videoFile) return { error: "视频文件记录不存在" };
    const path = await videoFileManager.getVideoFilePath(videoFile.id);
    if (!path) return { error: "无法获取视频文件路径" };
    const thumbnailKey = `${content.uniqueId}.jpg`;
    const replaceExisting = options?.replaceExisting ?? false;
    if (!replaceExisting && fileManager.exists(thumbnailKey, FileCategory.Thumbnails)) {
      await db
        .update(videosTable)
        .set({ thumbnailKey, updatedAt: new Date() })
        .where(eq(videosTable.id, videoId));
      return { thumbnailKey };
    }
    const durationSecRaw = Number(videoFile.videoDuration);
    const durationSec =
      Number.isFinite(durationSecRaw) && durationSecRaw > 0 ? durationSecRaw : undefined;
    const thumbBuf = await ffmpegManager.generateThumbnail(path, { seekSec, durationSec });
    if (!thumbBuf) return { error: "缩略图截取失败" };
    await fileManager.write(thumbnailKey, FileCategory.Thumbnails, thumbBuf);
    await db
      .update(videosTable)
      .set({ thumbnailKey, updatedAt: new Date() })
      .where(eq(videosTable.id, videoId));
    return { thumbnailKey };
  }

  /** 获取视频关联的 video file id 和 fileKey（通过 video_unique_contents） */
  async getVideoFileInfoForVideo(
    videoId: number
  ): Promise<{
    id: number;
    fileKey: string;
    videoCodec: string | null;
    audioCodec: string | null;
    mp4MoovBeforeMdat: boolean | null;
  } | null> {
    const map = await this.getVideoFileInfoMapForVideos([videoId]);
    return map.get(videoId) ?? null;
  }

  /** 批量获取视频关联的 video file id 和 fileKey（通过 video_unique_contents） */
  async getVideoFileInfoMapForVideos(
    videoIds: number[]
  ): Promise<
    Map<
      number,
      {
        id: number;
        fileKey: string;
        videoCodec: string | null;
        audioCodec: string | null;
        mp4MoovBeforeMdat: boolean | null;
      }
    >
  > {
    const uniqueIds = normalizeIds(videoIds).filter((id) => Number.isInteger(id) && id > 0);
    if (uniqueIds.length === 0) return new Map();
    const rows = await db
      .select({
        videoId: videoUniqueContentsTable.videoId,
        id: videoFilesTable.id,
        fileKey: videoFilesTable.fileKey,
        videoCodec: videoFilesTable.videoCodec,
        audioCodec: videoFilesTable.audioCodec,
        mp4MoovBeforeMdat: videoFilesTable.mp4MoovBeforeMdat,
      })
      .from(videoUniqueContentsTable)
      .innerJoin(videoFilesTable, eq(videoFilesTable.uniqueId, videoUniqueContentsTable.uniqueId))
      .where(inArray(videoUniqueContentsTable.videoId, uniqueIds))
      .orderBy(videoFilesTable.id);
    const map = new Map<
      number,
      {
        id: number;
        fileKey: string;
        videoCodec: string | null;
        audioCodec: string | null;
        mp4MoovBeforeMdat: boolean | null;
      }
    >();
    for (const row of rows) {
      if (!map.has(row.videoId)) {
        map.set(row.videoId, {
          id: row.id,
          fileKey: row.fileKey,
          videoCodec: row.videoCodec,
          audioCodec: row.audioCodec,
          mp4MoovBeforeMdat: row.mp4MoovBeforeMdat,
        });
      }
    }
    return map;
  }

  /** 批量获取视频的时长/文件大小/播放量 */
  async getVideoFileMetaMap(
    videoIds: number[]
  ): Promise<Map<number, { videoDuration?: number; fileSize?: number; playCount: number }>> {
    if (videoIds.length === 0) return new Map();
    const [rows, playCountRows] = await Promise.all([
      db
        .select({
          videoId: videoUniqueContentsTable.videoId,
          videoDuration: videoFilesTable.videoDuration,
          fileSize: videoFilesTable.fileSize,
        })
        .from(videoUniqueContentsTable)
        .innerJoin(videoFilesTable, eq(videoFilesTable.uniqueId, videoUniqueContentsTable.uniqueId))
        .where(inArray(videoUniqueContentsTable.videoId, videoIds)),
      db
        .select({
          videoId: userVideoHistoriesTable.videoId,
          playCount: sql<number>`sum(case when ${userVideoHistoriesTable.playCount} > 0 then ${userVideoHistoriesTable.playCount} else 1 end)`,
        })
        .from(userVideoHistoriesTable)
        .where(inArray(userVideoHistoriesTable.videoId, videoIds))
        .groupBy(userVideoHistoriesTable.videoId),
    ]);
    const map = new Map<number, { videoDuration?: number; fileSize?: number; playCount: number }>();
    for (const videoId of videoIds) {
      map.set(videoId, { playCount: 0 });
    }
    for (const row of rows) {
      const prev = map.get(row.videoId) ?? { playCount: 0 };
      map.set(row.videoId, {
        ...prev,
        videoDuration: Number(row.videoDuration),
        fileSize: Number(row.fileSize),
      });
    }
    for (const row of playCountRows) {
      const prev = map.get(row.videoId) ?? { playCount: 0 };
      map.set(row.videoId, {
        ...prev,
        playCount: Number(row.playCount),
      });
    }
    return map;
  }

  async create(data: CreateVideoInput) {
    const actorIds = normalizeIds(data.actors ?? []);
    const creatorIds = normalizeIds(data.creators ?? []);
    const distributorIds = normalizeIds(data.distributors ?? []);
    const tagIds = normalizeIds(data.tags ?? []);

    const [allActors, allCreators, allDistributors, allTags] = await Promise.all([
      actorsService.idsExist(actorIds),
      creatorsService.idsExist(creatorIds),
      distributorsService.idsExist(distributorIds),
      tagsService.idsExist(tagIds),
    ]);
    if (!allActors) return { error: "演员 ID 不存在" as const };
    if (!allCreators) return { error: "创作者 ID 不存在" as const };
    if (!allDistributors) return { error: "发行商 ID 不存在" as const };
    if (!allTags) return { error: "标签 ID 不存在" as const };

    const item = await db.transaction(async (tx) => {
      const rows = await tx
        .insert(videosTable)
        .values({ title: data.title, thumbnailKey: data.thumbnailKey ?? null })
        .returning();
      const created = rows[0];
      if (!created) return null;

      if (actorIds.length > 0) {
        await tx.insert(videoActorsTable).values(actorIds.map((actorId) => ({ videoId: created.id, actorId })));
      }
      if (creatorIds.length > 0) {
        await tx.insert(videoCreatorsTable).values(creatorIds.map((creatorId) => ({ videoId: created.id, creatorId })));
      }
      if (distributorIds.length > 0) {
        await tx.insert(videoDistributorsTable).values(distributorIds.map((d) => ({ videoId: created.id, distributorId: d })));
      }
      if (tagIds.length > 0) {
        await tx.insert(videoTagsTable).values(tagIds.map((tagId) => ({ videoId: created.id, tagId })));
      }

      return tx.query.videosTable.findFirst({
        where: eq(videosTable.id, created.id),
        with: videoWithRelations,
      });
    });

    if (!item) return { error: "创建视频失败" as const };
    return { item: toVideoResponse(item as Parameters<typeof toVideoResponse>[0]) };
  }

  async update(id: number, data: UpdateVideoInput) {
    const actorIds = data.actors === undefined ? undefined : normalizeIds(data.actors);
    const creatorIds = data.creators === undefined ? undefined : normalizeIds(data.creators);
    const distributorIds = data.distributors === undefined ? undefined : normalizeIds(data.distributors);
    const tagIds = data.tags === undefined ? undefined : normalizeIds(data.tags);

    const checks = await Promise.all([
      actorIds === undefined ? true : actorsService.idsExist(actorIds),
      creatorIds === undefined ? true : creatorsService.idsExist(creatorIds),
      distributorIds === undefined ? true : distributorsService.idsExist(distributorIds),
      tagIds === undefined ? true : tagsService.idsExist(tagIds),
    ]);
    if (!checks[0]) return { error: "演员 ID 不存在" as const };
    if (!checks[1]) return { error: "创作者 ID 不存在" as const };
    if (!checks[2]) return { error: "发行商 ID 不存在" as const };
    if (!checks[3]) return { error: "标签 ID 不存在" as const };

    let videoNotFound = false;
    const item = await db.transaction(async (tx) => {
      const updateFields: Record<string, unknown> = {
        title: data.title ?? undefined,
        thumbnailKey: data.thumbnailKey ?? undefined,
        updatedAt: new Date(),
      };
      if (data.isFeatured !== undefined) updateFields.isFeatured = data.isFeatured;
      if (data.isBanner !== undefined) updateFields.isBanner = data.isBanner;
      if (data.bannerOrder !== undefined) updateFields.bannerOrder = data.bannerOrder;
      if (data.recommendedOrder !== undefined) updateFields.recommendedOrder = data.recommendedOrder;

      const rows = await tx
        .update(videosTable)
        .set(updateFields as Record<string, never>)
        .where(eq(videosTable.id, id))
        .returning();
      if (!rows[0]) {
        videoNotFound = true;
        return null;
      }

      if (actorIds !== undefined) {
        await tx.delete(videoActorsTable).where(eq(videoActorsTable.videoId, id));
        if (actorIds.length > 0) {
          await tx.insert(videoActorsTable).values(actorIds.map((actorId) => ({ videoId: id, actorId })));
        }
      }
      if (creatorIds !== undefined) {
        await tx.delete(videoCreatorsTable).where(eq(videoCreatorsTable.videoId, id));
        if (creatorIds.length > 0) {
          await tx.insert(videoCreatorsTable).values(creatorIds.map((creatorId) => ({ videoId: id, creatorId })));
        }
      }
      if (distributorIds !== undefined) {
        await tx.delete(videoDistributorsTable).where(eq(videoDistributorsTable.videoId, id));
        if (distributorIds.length > 0) {
          await tx.insert(videoDistributorsTable).values(distributorIds.map((d) => ({ videoId: id, distributorId: d })));
        }
      }
      if (tagIds !== undefined) {
        await tx.delete(videoTagsTable).where(eq(videoTagsTable.videoId, id));
        if (tagIds.length > 0) {
          await tx.insert(videoTagsTable).values(tagIds.map((tagId) => ({ videoId: id, tagId })));
        }
      }

      return tx.query.videosTable.findFirst({
        where: eq(videosTable.id, id),
        with: videoWithRelations,
      });
    });

    if (!item) {
      if (videoNotFound) return { error: "视频不存在" as const };
      return { error: "更新视频失败" as const };
    }
    return { item: toVideoResponse(item as Parameters<typeof toVideoResponse>[0]) };
  }

  async delete(id: number) {
    const rows = await db.delete(videosTable).where(eq(videosTable.id, id)).returning();
    return rows[0] ?? null;
  }

  private async inferVideoInfoInternal(
    filename: string,
    options?: {
      fileKey?: string;
    }
  ): Promise<InferVideoInfoResult> {
    const fileKey = options?.fileKey?.trim() || "";
    const hintSource = fileKey ? `${fileKey} ${filename}` : filename;
    const hints = await this.findMatchedHints(hintSource);
    const hintLines: string[] = [];
    if (hints.creatorGroups.length) {
      hintLines.push(`- 候选团体创作者: ${hints.creatorGroups.join(", ")}`);
    }
    if (hints.creatorPersons.length) {
      hintLines.push(`- 候选个人创作者: ${hints.creatorPersons.join(", ")}`);
    }
    if (hints.distributors.length) {
      hintLines.push(`- 候选发行商: ${hints.distributors.join(", ")}`);
    }
    if (hints.actors.length) {
      hintLines.push(`- 候选演员: ${hints.actors.join(", ")}`);
    }
    const hintBlock = hintLines.length
      ? `\n\n文件名候选匹配（数据库模糊查询确认，仅供参考）：\n${hintLines.join("\n")}`
      : "";

    const systemPrompt = `你是一个助手，从视频文件名中提取结构化信息。你还会收到 fileKey（完整相对路径）作为辅助上下文。严格按以下规则执行。

【重要】对于未能从文件名中有效提取到的信息，必须留空或置 null，禁止猜测、编造或随意填写。宁可留空也不要填入不确定的内容。

规则：
1. 方括号 [] 中的内容通常是创作者或发行商
2. 若 creator 以 @ 开头或包含 onlyfans、justforfans、fansone（不区分大小写），则为 person
3. 若上述平台关键词存在但无法识别有效创作者，creator 设为 null，放入 distributors
4. creator 和 distributor 名称不要包含方括号 []
5. distributors、actors 若无法明确识别则返回空数组 []，不要填入不确定的项
6. 可以参考 fileKey 的目录信息辅助判断，但优先以文件名主体为准，不要把纯路径层级名机械当作标题${hintBlock}`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content:
            `请根据以下信息提取：\n\n` +
            `filename: ${filename}\n` +
            `fileKey: ${fileKey || "(未提供)"}`,
        },
      ],
      tools: [extractVideoInfoTool],
      tool_choice: { type: "function", function: { name: "extract_video_info" } },
    });

    const toolCall = completion.choices[0]?.message?.tool_calls?.[0];
    if (
      !toolCall ||
      toolCall.type !== "function" ||
      toolCall.function.name !== "extract_video_info"
    ) {
      return { title: filename.replace(/\.[^.]+$/, "") };
    }

    this.logger.debug(`视频信息推理 token 消耗: ${completion.usage?.total_tokens}`);

    const args = JSON.parse(toolCall.function.arguments) as InferVideoInfoResult;
    return this.resolveInfoWithDatabase({
      title: args.title ?? filename.replace(/\.[^.]+$/, ""),
      creator: args.creator ?? null,
      creatorType: args.creatorType,
      distributors: args.distributors ?? [],
      actors: args.actors ?? [],
    });
  }

  async inferVideoInfo(
    filename: string,
    options?: {
      source?: VideoInferTaskSource;
      target?: string;
      fileKey?: string;
    }
  ): Promise<InferVideoInfoResult> {
    const source = options?.source ?? "admin-infer-preview";
    const target = options?.target ?? filename;
    return this.enqueueInferTask(source, target, () =>
      this.inferVideoInfoInternal(filename, { fileKey: options?.fileKey })
    );
  }

  private async inferAndApplyInfoForVideo(
    videoId: number,
    videoFile: Pick<VideoFile, "fileKey" | "fileDirId">
  ) {
    const info = await this.inferVideoInfo(basename(videoFile.fileKey), {
      source: "video-auto-extract",
      target: videoFile.fileKey,
      fileKey: videoFile.fileKey,
    });
    await db.transaction(async (tx) => {
      await this.applyInferredInfo(tx, videoId, info);
    });
    if (videoFile.fileDirId != null) {
      await bindingStrategiesService.applyMatchingStrategiesForVideoFile(
        { fileDirId: videoFile.fileDirId, fileKey: videoFile.fileKey },
        videoId
      );
    }
  }

  private scheduleInferAndApplyInfoForVideo(
    videoId: number,
    videoFile: Pick<VideoFile, "fileKey" | "fileDirId">
  ) {
    void this.inferAndApplyInfoForVideo(videoId, videoFile).catch((error) => {
      this.logger.warn(
        error,
        `自动提取视频信息失败(已忽略，不影响索引): videoId=${videoId}, fileKey=${videoFile.fileKey}`
      );
    });
  }

  private async applyInferredInfo(
    tx: Awaited<Parameters<Parameters<typeof db.transaction>[0]>[0]>,
    videoId: number,
    info: InferVideoInfoResult
  ) {
    await tx.update(videosTable).set({
      title: info.title,
      updatedAt: new Date(),
    }).where(eq(videosTable.id, videoId));

    await tx.delete(videoCreatorsTable).where(eq(videoCreatorsTable.videoId, videoId));
    await tx.delete(videoDistributorsTable).where(eq(videoDistributorsTable.videoId, videoId));
    await tx.delete(videoActorsTable).where(eq(videoActorsTable.videoId, videoId));

    const creatorType = info.creatorType ?? "person";
    if (info.creator) {
      let creator = await tx.query.creatorsTable.findFirst({
        where: ilike(creatorsTable.name, this.toLikePattern(info.creator)),
        columns: { id: true },
      });
      if (!creator) {
        const [created] = await tx.insert(creatorsTable).values({
          name: info.creator,
          type: creatorType,
        }).returning({ id: creatorsTable.id });
        if (created) creator = created;
      }
      if (creator) {
        await tx.insert(videoCreatorsTable).values({ videoId, creatorId: creator.id });
      }
    }

    for (const name of info.distributors ?? []) {
      let dist = await distributorsService.findByNameOrNormalized(name);
      if (!dist) {
        const [created] = await tx
          .insert(distributorsTable)
          .values({ name: name.trim() })
          .returning({ id: distributorsTable.id, name: distributorsTable.name });
        if (created) dist = created;
      }
      if (dist) {
        await tx.insert(videoDistributorsTable).values({ videoId, distributorId: dist.id });
      }
    }

    for (const name of info.actors ?? []) {
      let actor = await tx.query.actorsTable.findFirst({
        where: ilike(actorsTable.name, this.toLikePattern(name)),
        columns: { id: true },
      });
      if (!actor) {
        const [created] = await tx.insert(actorsTable).values({ name }).returning({ id: actorsTable.id });
        if (created) actor = created;
      }
      if (actor) {
        await tx.insert(videoActorsTable).values({ videoId, actorId: actor.id });
      }
    }
  }

  async insertVideoFromVideoFile(
    videoFile: VideoFile,
    options?: { autoExtract?: boolean; waitForAutoExtract?: boolean }
  ) {
    const autoExtract = options?.autoExtract ?? true;
    const waitForAutoExtract = options?.waitForAutoExtract ?? true;

    // 查询 uniqueId 是否已经存在（仅查 videoId，避免触发深层关联的大型 lateral join）
    const content = await db.query.videoUniqueContentsTable.findFirst({
      where: eq(videoUniqueContentsTable.uniqueId, videoFile.uniqueId),
      columns: { videoId: true },
    });
    if (content) {
      const video = await db.query.videosTable.findFirst({
        where: eq(videosTable.id, content.videoId),
        with: videoWithRelations,
      });
      if (video) {
        return toVideoResponse(video as Parameters<typeof toVideoResponse>[0]);
      }
    }

    let inferredInfo: InferVideoInfoResult | null = null;

    if (autoExtract && waitForAutoExtract) {
      inferredInfo = await this.inferVideoInfo(basename(videoFile.fileKey), {
        source: "video-auto-extract",
        target: videoFile.fileKey,
        fileKey: videoFile.fileKey,
      });
    }

    const raw = await db.transaction(async (tx) => {
      const existing = await tx.query.videoUniqueContentsTable.findFirst({
        where: eq(videoUniqueContentsTable.uniqueId, videoFile.uniqueId),
        with: { video: true },
      });
      if (existing?.video) {
        if (inferredInfo) {
          await this.applyInferredInfo(tx, existing.video.id, inferredInfo);
        }
        return tx.query.videosTable.findFirst({
          where: eq(videosTable.id, existing.video.id),
          with: videoWithRelations,
        });
      }
      const thumbnailKey = fileManager.exists(`${videoFile.uniqueId}.jpg`, FileCategory.Thumbnails)
        ? `${videoFile.uniqueId}.jpg`
        : null;
      const [created] = await tx.insert(videosTable).values({
        title: inferredInfo?.title ?? basename(videoFile.fileKey),
        thumbnailKey,
      }).returning();
      await tx.insert(videoUniqueContentsTable).values({
        videoId: created.id,
        uniqueId: videoFile.uniqueId,
      });
      if (inferredInfo) {
        await this.applyInferredInfo(tx, created.id, inferredInfo);
      }
      return tx.query.videosTable.findFirst({
        where: eq(videosTable.id, created.id),
        with: videoWithRelations,
      });
    });
    if (raw) {
      const createdVideoId = (raw as { id: number }).id;
      if (videoFile.fileDirId != null) {
        await bindingStrategiesService.applyMatchingStrategiesForVideoFile(
          { fileDirId: videoFile.fileDirId, fileKey: videoFile.fileKey },
          createdVideoId
        );
      }
      if (autoExtract && !waitForAutoExtract) {
        this.scheduleInferAndApplyInfoForVideo(createdVideoId, videoFile);
      }
    }
    return raw ? toVideoResponse(raw as Parameters<typeof toVideoResponse>[0]) : null;
  }

  async reExtractVideoInfo(videoId: number): Promise<{ video: Awaited<ReturnType<typeof db.query.videosTable.findFirst>>; info: InferVideoInfoResult } | null> {
    const content = await db.query.videoUniqueContentsTable.findFirst({
      where: eq(videoUniqueContentsTable.videoId, videoId),
      columns: { uniqueId: true },
    });
    if (!content) return null;

    const videoFile = await db.query.videoFilesTable.findFirst({
      where: eq(videoFilesTable.uniqueId, content.uniqueId),
      columns: { fileKey: true },
    });
    if (!videoFile) return null;

    const info = await this.inferVideoInfo(basename(videoFile.fileKey), {
      source: "video-re-extract",
      target: `video:${videoId}:${videoFile.fileKey}`,
      fileKey: videoFile.fileKey,
    });
    const video = await db.transaction(async (tx) => {
      await this.applyInferredInfo(tx, videoId, info);
      return tx.query.videosTable.findFirst({
        where: eq(videosTable.id, videoId),
      });
    });
    return video ? { video, info } : null;
  }
}

export const videosService = new VideosService();
