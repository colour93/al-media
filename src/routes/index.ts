import { Elysia } from "elysia";
import { actorsRoutes } from "./actors";
import { creatorsRoutes } from "./creators";
import { distributorsRoutes } from "./distributors";
import { fileRoutes } from "./file";
import { fileDirsRoutes } from "./fileDirs";
import { tagsRoutes } from "./tags";
import { tagTypesRoutes } from "./tagTypes";
import { videoFilesRoutes } from "./videoFiles";
import { videosRoutes } from "./videos";
import { ErrorCode } from "../types/error";
import { createLogger } from "../utils/logger";
import { BaseResponse } from "../types/response";

const logger = createLogger('routes')

const toSuccess = (data: unknown) => ({
  success: true,
  data,
});

const toError = (message: string, code?: string) => ({
  success: false,
  error: {
    message,
    code,
  },
});

const isStandardResponse = (value: unknown) => {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value &&
    typeof (value as { success: unknown }).success === "boolean"
  );
};

export const appRoutes = new Elysia({ prefix: "/api" })
  .guard({
    response: BaseResponse
  })
  .onAfterHandle(({ responseValue, set }) => {
    if (responseValue instanceof Response || isStandardResponse(responseValue)) {
      return responseValue;
    }

    if (typeof set.status === "number" && set.status >= 400) {
      const message =
        typeof responseValue === "object" && responseValue !== null && "message" in responseValue
          ? String((responseValue as { message: unknown }).message)
          : "Request failed";
      return toError(message);
    }

    return toSuccess(responseValue);
  })
  .onError(({ error, code, set }) => {

    if (code === "VALIDATION") {
      set.status = 422;

      const details = process.env.NODE_ENV !== "production" ?
        ((error as any).all?.map((item: any) => ({
          field: item.path?.replace(/^\//, "") || "unknown",
          message: item.message,
        })) ?? []) : undefined;

      return {
        success: false,
        message: details[0]?.message || "请求参数校验失败",
        code: ErrorCode.VALIDATION,
        errors: details,
      };
    }

    // DrizzleQueryError 通常把 pg 错误放在 cause 里
    const pgErr = (error as any)?.cause ?? error;
    const pgCode = (pgErr as any)?.code;
    const constraint = (pgErr as any)?.constraint;

    if (pgCode === "23503") {
      // foreign_key_violation
      set.status = 400;

      return {
        success: false,
        message: "关联数据不存在或已被删除",
        code: ErrorCode.FOREIGN_KEY_VIOLATION,
        constraint: constraint as string | undefined,
      };
    }

    if (pgCode === "23505") {
      set.status = 409;
      return { success: false, message: "数据已存在", code: ErrorCode.UNIQUE_VIOLATION };
    }


    logger.error(error);

    set.status = 500;
    return {
      success: false,
      message: "服务器异常",
      code: ErrorCode.UNKNOWN,
    };
  })
  .get("/health", () => ({ success: true, status: "ok" }))
  .use(fileRoutes)
  .use(videosRoutes)
  .use(videoFilesRoutes)
  .use(fileDirsRoutes)
  .use(tagsRoutes)
  .use(tagTypesRoutes)
  .use(actorsRoutes)
  .use(creatorsRoutes)
  .use(distributorsRoutes);