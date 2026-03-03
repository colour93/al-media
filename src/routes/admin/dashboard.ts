import { Elysia, t } from "elysia";
import { dashboardService, type DashboardTimeUnit } from "../../services/dashboard";

const dashboardTimeUnitSchema = t.Union([
  t.Literal("day"),
  t.Literal("week"),
  t.Literal("month"),
]);

export const dashboardRoutes = new Elysia({ prefix: "/dashboard" }).get(
  "/stats",
  async ({ query, set }) => {
    const unit = (query.unit as DashboardTimeUnit | undefined) ?? "day";
    const spanRaw = query.span == null ? undefined : Number(query.span);
    if (query.span != null && (!Number.isInteger(spanRaw) || Number(spanRaw) < 1)) {
      set.status = 400;
      return { message: "span 参数无效" };
    }
    return dashboardService.getStats({
      unit,
      span: spanRaw,
    });
  },
  {
    query: t.Object({
      unit: t.Optional(dashboardTimeUnitSchema),
      span: t.Optional(t.String()),
    }),
  }
);

