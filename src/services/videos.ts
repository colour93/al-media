import { eq, ilike } from "drizzle-orm";
import { db } from "../db";
import { VideoFile } from "../entities/VideoFile";
import { videosTable } from "../entities/Video";
import { basename } from "node:path";
import { videoUniqueContentsTable } from "../entities/VideoUniqueContent";
import { videoFilesTable } from "../entities/VideoFile";
import { videoActorsTable } from "../entities/VideoActor";
import { videoCreatorsTable } from "../entities/VideoCreator";
import { videoDistributorsTable } from "../entities/VideoDistributor";
import { actorsTable } from "../entities/Actor";
import { creatorsTable } from "../entities/Creator";
import { distributorsTable } from "../entities/Distributor";
import { fileManager, FileCategory } from "./fileManager";
import OpenAI from "openai";

export type InferVideoInfoResult = {
  title: string;
  creator?: string | null;
  creatorType?: "person" | "group";
  distributors?: string[];
  participants?: string[];
};

const extractVideoInfoTool = {
  type: "function" as const,
  function: {
    name: "extract_video_info",
    description: "从视频文件名中提取 title、creator、creatorType、distributors、participants 等信息。无法提取的字段留空，禁止随意填写",
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
        participants: {
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

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL });
  }

  private async getKnownEntities() {
    const [creators, distributors, actors] = await Promise.all([
      db.query.creatorsTable.findMany({
        columns: { name: true, type: true },
      }),
      db.query.distributorsTable.findMany({
        columns: { name: true },
      }),
      db.query.actorsTable.findMany({
        columns: { name: true },
      }),
    ]);

    const creatorGroups = creators.filter((c) => c.type === "group").map((c) => c.name);
    const creatorPersons = creators.filter((c) => c.type === "person").map((c) => c.name);
    const distributorNames = distributors.map((d) => d.name);
    const actorNames = actors.map((a) => a.name);

    return {
      creatorGroups,
      creatorPersons,
      distributorNames,
      actorNames,
    };
  }

  async inferVideoInfo(filename: string): Promise<InferVideoInfoResult> {
    const { creatorGroups, creatorPersons, distributorNames, actorNames } =
      await this.getKnownEntities();

    const systemPrompt = `你是一个助手，从视频文件名中提取结构化信息。严格按以下规则执行。

【重要】对于未能从文件名中有效提取到的信息，必须留空或置 null，禁止猜测、编造或随意填写。宁可留空也不要填入不确定的内容。

已知实体（仅从这些列表中匹配，或识别为 null/新值）：
- 已知团体创作者 (creatorType=group): ${creatorGroups.length ? creatorGroups.join(", ") : "无"}
- 已知个人创作者 (creatorType=person): ${creatorPersons.length ? creatorPersons.join(", ") : "无"}
- 已知发行商 (distributors): ${distributorNames.length ? distributorNames.join(", ") : "无"}
- 已知演员 (participants): ${actorNames.length ? actorNames.join(", ") : "无"}

规则：
1. 方括号 [] 中的内容通常是创作者或发行商
2. 若 creator 以 @ 开头或包含 onlyfans、justforfans、fansone（不区分大小写），则为 person
3. 若上述平台关键词存在但无法识别有效创作者，creator 设为 null，放入 distributors
4. 优先在已知列表中匹配；若匹配到已知团体创作者则 creatorType=group，匹配到已知个人则 creatorType=person
5. creator 和 distributor 名称不要包含方括号 []
6. distributors、participants 若无法明确识别则返回空数组 []，不要填入不确定的项`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `请从以下文件名提取信息：\n\n${filename}` },
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

    const args = JSON.parse(toolCall.function.arguments) as InferVideoInfoResult;
    return {
      title: args.title ?? filename.replace(/\.[^.]+$/, ""),
      creator: args.creator ?? null,
      creatorType: args.creatorType,
      distributors: args.distributors ?? [],
      participants: args.participants ?? [],
    };
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
        where: ilike(creatorsTable.name, info.creator),
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
      let dist = await tx.query.distributorsTable.findFirst({
        where: ilike(distributorsTable.name, name),
        columns: { id: true },
      });
      if (!dist) {
        const [created] = await tx.insert(distributorsTable).values({ name }).returning({ id: distributorsTable.id });
        if (created) dist = created;
      }
      if (dist) {
        await tx.insert(videoDistributorsTable).values({ videoId, distributorId: dist.id });
      }
    }

    for (const name of info.participants ?? []) {
      let actor = await tx.query.actorsTable.findFirst({
        where: ilike(actorsTable.name, name),
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
    options?: { autoExtract?: boolean }
  ) {
    const autoExtract = options?.autoExtract ?? true;
    let inferredInfo: InferVideoInfoResult | null = null;

    if (autoExtract) {
      inferredInfo = await this.inferVideoInfo(basename(videoFile.fileKey));
    }

    return await db.transaction(async (tx) => {
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
      });
    });
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

    const info = await this.inferVideoInfo(basename(videoFile.fileKey));
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