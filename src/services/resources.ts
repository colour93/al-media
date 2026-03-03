import { and, asc, desc, ilike, inArray, notInArray, or, sql } from "drizzle-orm";
import { db } from "../db";
import { actorsTable } from "../entities/Actor";
import { actorTagsTable } from "../entities/ActorTag";
import { creatorsTable } from "../entities/Creator";
import { creatorTagsTable } from "../entities/CreatorTag";
import { distributorsTable } from "../entities/Distributor";
import { tagsTable } from "../entities/Tag";
import { videoActorsTable } from "../entities/VideoActor";
import { videoCreatorsTable } from "../entities/VideoCreator";
import { videoDistributorsTable } from "../entities/VideoDistributor";
import { videoFilesTable } from "../entities/VideoFile";
import { videoTagsTable } from "../entities/VideoTag";
import { videoUniqueContentsTable } from "../entities/VideoUniqueContent";
import { videosTable } from "../entities/Video";
import type { PaginatedResult } from "../utils/pagination";
import { videosService } from "./videos";

export type ResourceCategory = "all" | "video" | "actor" | "creator" | "distributor" | "tag";

export type SearchResourcesInput = {
  q?: string;
  category: ResourceCategory;
  page: number;
  pageSize: number;
  includeTagIds?: number[];
  excludeTagIds?: number[];
};

export type SearchResourcesResult = {
  q: string;
  category: ResourceCategory;
  filters: {
    includeTagIds: number[];
    excludeTagIds: number[];
  };
  videos: PaginatedResult<unknown>;
  actors: PaginatedResult<unknown>;
  creators: PaginatedResult<unknown>;
  distributors: PaginatedResult<unknown>;
  tags: PaginatedResult<unknown>;
};

const actorWithTags = {
  actorTags: { with: { tag: { with: { tagType: true } } } },
} as const;

const creatorWithRelations = {
  actor: true,
  creatorTags: { with: { tag: { with: { tagType: true } } } },
} as const;

function toActorResponse(item: { actorTags: Array<{ tag: unknown }> } & Record<string, unknown>) {
  const { actorTags, ...actor } = item;
  return {
    ...actor,
    tags: actorTags.map((it) => it.tag).filter((tag) => tag != null),
  };
}

function toCreatorResponse(item: { creatorTags: Array<{ tag: unknown }> } & Record<string, unknown>) {
  const { creatorTags, ...creator } = item;
  return {
    ...creator,
    tags: creatorTags.map((it) => it.tag).filter((tag) => tag != null),
  };
}

function buildSqlNumberList(values: number[]) {
  return sql.join(values.map((v) => sql`${v}`), sql`,`);
}

function buildVideoHasAnyTagCondition(tagIds: number[], videoIdExpr: unknown) {
  const inClause = buildSqlNumberList(tagIds);
  return sql<boolean>`(
    exists (
      select 1
      from ${videoTagsTable}
      where ${videoTagsTable.videoId} = ${videoIdExpr}
        and ${videoTagsTable.tagId} in (${inClause})
    )
    or exists (
      select 1
      from ${videoActorsTable}
      inner join ${actorTagsTable}
        on ${actorTagsTable.actorId} = ${videoActorsTable.actorId}
      where ${videoActorsTable.videoId} = ${videoIdExpr}
        and ${actorTagsTable.tagId} in (${inClause})
    )
    or exists (
      select 1
      from ${videoCreatorsTable}
      inner join ${creatorTagsTable}
        on ${creatorTagsTable.creatorId} = ${videoCreatorsTable.creatorId}
      where ${videoCreatorsTable.videoId} = ${videoIdExpr}
        and ${creatorTagsTable.tagId} in (${inClause})
    )
    or exists (
      select 1
      from ${videoCreatorsTable}
      inner join ${creatorsTable}
        on ${creatorsTable.id} = ${videoCreatorsTable.creatorId}
      inner join ${actorTagsTable}
        on ${actorTagsTable.actorId} = ${creatorsTable.actorId}
      where ${videoCreatorsTable.videoId} = ${videoIdExpr}
        and ${actorTagsTable.tagId} in (${inClause})
    )
  )`;
}

function buildActorHasAnyTagCondition(tagIds: number[], actorIdExpr: unknown) {
  const inClause = buildSqlNumberList(tagIds);
  return sql<boolean>`exists (
    select 1
    from ${actorTagsTable}
    where ${actorTagsTable.actorId} = ${actorIdExpr}
      and ${actorTagsTable.tagId} in (${inClause})
  )`;
}

function buildCreatorHasAnyTagCondition(tagIds: number[], creatorIdExpr: unknown) {
  const inClause = buildSqlNumberList(tagIds);
  return sql<boolean>`(
    exists (
      select 1
      from ${creatorTagsTable}
      where ${creatorTagsTable.creatorId} = ${creatorIdExpr}
        and ${creatorTagsTable.tagId} in (${inClause})
    )
    or exists (
      select 1
      from ${creatorsTable}
      inner join ${actorTagsTable}
        on ${actorTagsTable.actorId} = ${creatorsTable.actorId}
      where ${creatorsTable.id} = ${creatorIdExpr}
        and ${actorTagsTable.tagId} in (${inClause})
    )
  )`;
}

class ResourcesService {
  private emptyPage(page: number, pageSize: number): PaginatedResult<unknown> {
    return { page, pageSize, total: 0, items: [] };
  }

  private normalizeTagIds(tagIds?: number[]) {
    if (!Array.isArray(tagIds) || tagIds.length === 0) return [];
    return [...new Set(tagIds.filter((id) => Number.isInteger(id) && id > 0))];
  }

  private isCategoryEnabled(category: ResourceCategory, target: Exclude<ResourceCategory, "all">) {
    return category === "all" || category === target;
  }

  async search(input: SearchResourcesInput): Promise<SearchResourcesResult> {
    const q = (input.q ?? "").trim();
    const includeTagIds = this.normalizeTagIds(input.includeTagIds);
    const excludeTagIds = this.normalizeTagIds(input.excludeTagIds);
    const excludeSet = new Set(excludeTagIds);
    const effectiveIncludeTagIds = includeTagIds.filter((id) => !excludeSet.has(id));

    const params = {
      q,
      page: input.page,
      pageSize: input.pageSize,
      includeTagIds: effectiveIncludeTagIds,
      excludeTagIds,
    };

    const [videos, actors, creators, distributors, tags] = await Promise.all([
      this.isCategoryEnabled(input.category, "video")
        ? this.searchVideos(params)
        : Promise.resolve(this.emptyPage(input.page, input.pageSize)),
      this.isCategoryEnabled(input.category, "actor")
        ? this.searchActors(params)
        : Promise.resolve(this.emptyPage(input.page, input.pageSize)),
      this.isCategoryEnabled(input.category, "creator")
        ? this.searchCreators(params)
        : Promise.resolve(this.emptyPage(input.page, input.pageSize)),
      this.isCategoryEnabled(input.category, "distributor")
        ? this.searchDistributors(params)
        : Promise.resolve(this.emptyPage(input.page, input.pageSize)),
      this.isCategoryEnabled(input.category, "tag")
        ? this.searchTags(params)
        : Promise.resolve(this.emptyPage(input.page, input.pageSize)),
    ]);

    return {
      q,
      category: input.category,
      filters: {
        includeTagIds: effectiveIncludeTagIds,
        excludeTagIds,
      },
      videos,
      actors,
      creators,
      distributors,
      tags,
    };
  }

  async searchTagOptions(q: string | undefined, page: number, pageSize: number): Promise<PaginatedResult<unknown>> {
    const keyword = (q ?? "").trim();
    const conditions: Array<Parameters<typeof and>[number]> = [];
    if (keyword) {
      conditions.push(ilike(tagsTable.name, `%${keyword}%`));
    }
    const where = and(...conditions) ?? sql<boolean>`true`;

    const [items, total] = await Promise.all([
      db.query.tagsTable.findMany({
        where,
        orderBy: [asc(tagsTable.name), asc(tagsTable.id)],
        limit: pageSize,
        offset: (page - 1) * pageSize,
        with: { tagType: true },
      }),
      db.$count(tagsTable, where),
    ]);

    return {
      page,
      pageSize,
      total: total ?? 0,
      items,
    };
  }

  private async searchVideos(params: {
    q: string;
    page: number;
    pageSize: number;
    includeTagIds: number[];
    excludeTagIds: number[];
  }): Promise<PaginatedResult<unknown>> {
    const { q, page, pageSize, includeTagIds, excludeTagIds } = params;
    const conditions: Array<Parameters<typeof and>[number]> = [];

    if (q) {
      const pattern = `%${q}%`;
      conditions.push(sql<boolean>`(
        ${videosTable.title} ilike ${pattern}
        or exists (
          select 1
          from ${videoUniqueContentsTable}
          inner join ${videoFilesTable}
            on ${videoFilesTable.uniqueId} = ${videoUniqueContentsTable.uniqueId}
          where ${videoUniqueContentsTable.videoId} = ${videosTable.id}
            and ${videoFilesTable.fileKey} ilike ${pattern}
        )
      )`);
    }

    if (includeTagIds.length > 0) {
      conditions.push(buildVideoHasAnyTagCondition(includeTagIds, videosTable.id));
    }

    if (excludeTagIds.length > 0) {
      conditions.push(sql<boolean>`not (${buildVideoHasAnyTagCondition(excludeTagIds, videosTable.id)})`);
    }

    const where = and(...conditions) ?? sql<boolean>`true`;
    const offset = (page - 1) * pageSize;

    const [rows, total] = await Promise.all([
      db
        .select({ id: videosTable.id })
        .from(videosTable)
        .where(where)
        .orderBy(desc(videosTable.id))
        .limit(pageSize)
        .offset(offset),
      db.$count(videosTable, where),
    ]);

    const itemsRaw = await Promise.all(
      rows.map((row) => videosService.findById(row.id, { useCommonUrl: true, pathOnly: true }))
    );
    const items = itemsRaw.filter((item) => item != null);

    return { page, pageSize, total: total ?? 0, items };
  }

  private async searchActors(params: {
    q: string;
    page: number;
    pageSize: number;
    includeTagIds: number[];
    excludeTagIds: number[];
  }): Promise<PaginatedResult<unknown>> {
    const { q, page, pageSize, includeTagIds, excludeTagIds } = params;
    const conditions: Array<Parameters<typeof and>[number]> = [];

    if (q) {
      conditions.push(ilike(actorsTable.name, `%${q}%`));
    }

    if (includeTagIds.length > 0) {
      conditions.push(buildActorHasAnyTagCondition(includeTagIds, actorsTable.id));
    }

    if (excludeTagIds.length > 0) {
      conditions.push(sql<boolean>`not (${buildActorHasAnyTagCondition(excludeTagIds, actorsTable.id)})`);
    }

    const where = and(...conditions) ?? sql<boolean>`true`;
    const offset = (page - 1) * pageSize;

    const [rows, total] = await Promise.all([
      db.query.actorsTable.findMany({
        where,
        orderBy: [desc(actorsTable.id)],
        limit: pageSize,
        offset,
        with: actorWithTags,
      }),
      db.$count(actorsTable, where),
    ]);

    return {
      page,
      pageSize,
      total: total ?? 0,
      items: rows.map((row) => toActorResponse(row as Parameters<typeof toActorResponse>[0])),
    };
  }

  private async searchCreators(params: {
    q: string;
    page: number;
    pageSize: number;
    includeTagIds: number[];
    excludeTagIds: number[];
  }): Promise<PaginatedResult<unknown>> {
    const { q, page, pageSize, includeTagIds, excludeTagIds } = params;
    const conditions: Array<Parameters<typeof and>[number]> = [];

    if (q) {
      const pattern = `%${q}%`;
      const textCondition = or(
        ilike(creatorsTable.name, pattern),
        sql<boolean>`cast(${creatorsTable.platform} as text) ilike ${pattern}`,
        ilike(creatorsTable.platformId, pattern),
      );
      if (textCondition) {
        conditions.push(textCondition);
      }
    }

    if (includeTagIds.length > 0) {
      conditions.push(buildCreatorHasAnyTagCondition(includeTagIds, creatorsTable.id));
    }

    if (excludeTagIds.length > 0) {
      conditions.push(sql<boolean>`not (${buildCreatorHasAnyTagCondition(excludeTagIds, creatorsTable.id)})`);
    }

    const where = and(...conditions) ?? sql<boolean>`true`;
    const offset = (page - 1) * pageSize;

    const [rows, total] = await Promise.all([
      db.query.creatorsTable.findMany({
        where,
        orderBy: [desc(creatorsTable.id)],
        limit: pageSize,
        offset,
        with: creatorWithRelations,
      }),
      db.$count(creatorsTable, where),
    ]);

    return {
      page,
      pageSize,
      total: total ?? 0,
      items: rows.map((row) => toCreatorResponse(row as Parameters<typeof toCreatorResponse>[0])),
    };
  }

  private async searchDistributors(params: {
    q: string;
    page: number;
    pageSize: number;
    includeTagIds: number[];
    excludeTagIds: number[];
  }): Promise<PaginatedResult<unknown>> {
    const { q, page, pageSize, includeTagIds, excludeTagIds } = params;
    const conditions: Array<Parameters<typeof and>[number]> = [];

    if (q) {
      const pattern = `%${q}%`;
      const textCondition = or(
        ilike(distributorsTable.name, pattern),
        ilike(distributorsTable.domain, pattern),
      );
      if (textCondition) {
        conditions.push(textCondition);
      }
    }

    if (includeTagIds.length > 0) {
      const includeVideoTagCondition = buildVideoHasAnyTagCondition(includeTagIds, videoDistributorsTable.videoId);
      conditions.push(sql<boolean>`exists (
        select 1
        from ${videoDistributorsTable}
        where ${videoDistributorsTable.distributorId} = ${distributorsTable.id}
          and ${includeVideoTagCondition}
      )`);
    }

    if (excludeTagIds.length > 0) {
      const excludeVideoTagCondition = buildVideoHasAnyTagCondition(excludeTagIds, videoDistributorsTable.videoId);
      conditions.push(sql<boolean>`not exists (
        select 1
        from ${videoDistributorsTable}
        where ${videoDistributorsTable.distributorId} = ${distributorsTable.id}
          and ${excludeVideoTagCondition}
      )`);
    }

    const where = and(...conditions) ?? sql<boolean>`true`;
    const offset = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      db.query.distributorsTable.findMany({
        where,
        orderBy: [desc(distributorsTable.id)],
        limit: pageSize,
        offset,
      }),
      db.$count(distributorsTable, where),
    ]);

    return { page, pageSize, total: total ?? 0, items };
  }

  private async searchTags(params: {
    q: string;
    page: number;
    pageSize: number;
    includeTagIds: number[];
    excludeTagIds: number[];
  }): Promise<PaginatedResult<unknown>> {
    const { q, page, pageSize, includeTagIds, excludeTagIds } = params;
    const conditions: Array<Parameters<typeof and>[number]> = [];

    if (q) {
      conditions.push(ilike(tagsTable.name, `%${q}%`));
    }

    if (includeTagIds.length > 0) {
      conditions.push(inArray(tagsTable.id, includeTagIds));
    }

    if (excludeTagIds.length > 0) {
      conditions.push(notInArray(tagsTable.id, excludeTagIds));
    }

    const where = and(...conditions) ?? sql<boolean>`true`;
    const offset = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      db.query.tagsTable.findMany({
        where,
        orderBy: [desc(tagsTable.id)],
        limit: pageSize,
        offset,
        with: { tagType: true },
      }),
      db.$count(tagsTable, where),
    ]);

    return { page, pageSize, total: total ?? 0, items };
  }
}

export const resourcesService = new ResourcesService();
