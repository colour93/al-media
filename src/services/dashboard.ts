import { and, gte, lt, sql } from "drizzle-orm";
import { db } from "../db";
import { userVideoHistoriesTable } from "../entities/UserVideoHistory";
import { usersTable } from "../entities/User";
import { videoFilesTable } from "../entities/VideoFile";
import { videosTable } from "../entities/Video";
import { videoFileManager } from "./videoFileManager";
import { videosService } from "./videos";
import { videoReencodeManager } from "./videoReencodeManager";

export type DashboardTimeUnit = "day" | "week" | "month";

export type DashboardTrendPoint = {
  bucketKey: string;
  bucketStart: string;
  label: string;
  videos: number;
  videoFiles: number;
  playCount: number;
  users: number;
};

export type DashboardStatsSnapshot = {
  unit: DashboardTimeUnit;
  span: number;
  from: string;
  to: string;
  points: DashboardTrendPoint[];
  totals: {
    videos: number;
    videoFiles: number;
    playCount: number;
    users: number;
  };
  scanTask: ReturnType<typeof videoFileManager.getScanTaskSnapshot>;
  inferTask: ReturnType<typeof videosService.getInferTaskSnapshot>;
  reencodeTask: ReturnType<typeof videoReencodeManager.getTaskSnapshot>;
};

const DASHBOARD_UNIT_SPAN_DEFAULT: Record<DashboardTimeUnit, number> = {
  day: 30,
  week: 12,
  month: 12,
};

const DASHBOARD_UNIT_SPAN_LIMIT: Record<DashboardTimeUnit, { min: number; max: number }> = {
  day: { min: 7, max: 180 },
  week: { min: 4, max: 104 },
  month: { min: 3, max: 48 },
};

class DashboardService {
  private normalizeSpan(unit: DashboardTimeUnit, span?: number) {
    const fallback = DASHBOARD_UNIT_SPAN_DEFAULT[unit];
    if (!Number.isInteger(span)) return fallback;
    const limits = DASHBOARD_UNIT_SPAN_LIMIT[unit];
    return Math.min(limits.max, Math.max(limits.min, Number(span)));
  }

  private startOfUnit(date: Date, unit: DashboardTimeUnit): Date {
    const d = new Date(date);
    d.setMilliseconds(0);
    d.setSeconds(0);
    d.setMinutes(0);
    d.setHours(0);
    if (unit === "week") {
      const day = d.getDay();
      const delta = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + delta);
      return d;
    }
    if (unit === "month") {
      d.setDate(1);
      return d;
    }
    return d;
  }

  private addUnit(date: Date, unit: DashboardTimeUnit, step: number): Date {
    const d = new Date(date);
    if (unit === "day") {
      d.setDate(d.getDate() + step);
      return d;
    }
    if (unit === "week") {
      d.setDate(d.getDate() + step * 7);
      return d;
    }
    d.setMonth(d.getMonth() + step);
    return d;
  }

  private toBucketKey(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  private toBucketLabel(date: Date, unit: DashboardTimeUnit) {
    if (unit === "month") {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    }
    const m = date.getMonth() + 1;
    const day = date.getDate();
    return `${m}/${day}`;
  }

  private toPgTruncUnit(unit: DashboardTimeUnit) {
    if (unit === "week") return "week";
    if (unit === "month") return "month";
    return "day";
  }

  private buildBucketExpr(unit: DashboardTimeUnit, column: unknown) {
    const pgUnit = this.toPgTruncUnit(unit);
    return sql<string>`to_char(date_trunc(${sql.raw(`'${pgUnit}'`)}, ${column}), 'YYYY-MM-DD')`;
  }

  async getStats(options?: { unit?: DashboardTimeUnit; span?: number }): Promise<DashboardStatsSnapshot> {
    const unit = options?.unit ?? "day";
    const span = this.normalizeSpan(unit, options?.span);
    const currentBucketStart = this.startOfUnit(new Date(), unit);
    const bucketStarts: Date[] = [];
    for (let i = span - 1; i >= 0; i -= 1) {
      bucketStarts.push(this.addUnit(currentBucketStart, unit, -i));
    }
    const from = bucketStarts[0] ?? currentBucketStart;
    const toExclusive = this.addUnit(currentBucketStart, unit, 1);

    const videoBucketExpr = this.buildBucketExpr(unit, videosTable.createdAt);
    const videoFileBucketExpr = this.buildBucketExpr(unit, videoFilesTable.createdAt);
    const userBucketExpr = this.buildBucketExpr(unit, usersTable.createdAt);
    const playBucketExpr = this.buildBucketExpr(unit, userVideoHistoriesTable.lastPlayedAt);

    const [
      videoRows,
      videoFileRows,
      userRows,
      playRows,
      totalVideos,
      totalVideoFiles,
      totalUsers,
      totalPlayCountRows,
    ] = await Promise.all([
      db
        .select({
          bucket: videoBucketExpr,
          value: sql<number>`count(*)`,
        })
        .from(videosTable)
        .where(and(gte(videosTable.createdAt, from), lt(videosTable.createdAt, toExclusive)))
        .groupBy(videoBucketExpr),
      db
        .select({
          bucket: videoFileBucketExpr,
          value: sql<number>`count(*)`,
        })
        .from(videoFilesTable)
        .where(and(gte(videoFilesTable.createdAt, from), lt(videoFilesTable.createdAt, toExclusive)))
        .groupBy(videoFileBucketExpr),
      db
        .select({
          bucket: userBucketExpr,
          value: sql<number>`count(*)`,
        })
        .from(usersTable)
        .where(and(gte(usersTable.createdAt, from), lt(usersTable.createdAt, toExclusive)))
        .groupBy(userBucketExpr),
      db
        .select({
          bucket: playBucketExpr,
          value: sql<number>`coalesce(sum(${userVideoHistoriesTable.playCount}), 0)`,
        })
        .from(userVideoHistoriesTable)
        .where(and(gte(userVideoHistoriesTable.lastPlayedAt, from), lt(userVideoHistoriesTable.lastPlayedAt, toExclusive)))
        .groupBy(playBucketExpr),
      db.$count(videosTable),
      db.$count(videoFilesTable),
      db.$count(usersTable),
      db
        .select({
          value: sql<number>`coalesce(sum(${userVideoHistoriesTable.playCount}), 0)`,
        })
        .from(userVideoHistoriesTable),
    ]);

    const videoMap = new Map<string, number>(
      videoRows.map((row) => [row.bucket, Number(row.value ?? 0)])
    );
    const videoFileMap = new Map<string, number>(
      videoFileRows.map((row) => [row.bucket, Number(row.value ?? 0)])
    );
    const userMap = new Map<string, number>(
      userRows.map((row) => [row.bucket, Number(row.value ?? 0)])
    );
    const playMap = new Map<string, number>(
      playRows.map((row) => [row.bucket, Number(row.value ?? 0)])
    );

    const points: DashboardTrendPoint[] = bucketStarts.map((bucketStart) => {
      const bucketKey = this.toBucketKey(bucketStart);
      return {
        bucketKey,
        bucketStart: bucketStart.toISOString(),
        label: this.toBucketLabel(bucketStart, unit),
        videos: videoMap.get(bucketKey) ?? 0,
        videoFiles: videoFileMap.get(bucketKey) ?? 0,
        playCount: playMap.get(bucketKey) ?? 0,
        users: userMap.get(bucketKey) ?? 0,
      };
    });

    return {
      unit,
      span,
      from: from.toISOString(),
      to: toExclusive.toISOString(),
      points,
      totals: {
        videos: Number(totalVideos ?? 0),
        videoFiles: Number(totalVideoFiles ?? 0),
        users: Number(totalUsers ?? 0),
        playCount: Number(totalPlayCountRows[0]?.value ?? 0),
      },
      scanTask: videoFileManager.getScanTaskSnapshot(),
      inferTask: videosService.getInferTaskSnapshot(),
      reencodeTask: videoReencodeManager.getTaskSnapshot(),
    };
  }
}

export const dashboardService = new DashboardService();
