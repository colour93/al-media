import { createHmac, timingSafeEqual } from "node:crypto";

const SIGN_SECRET = process.env.FILE_SIGN_SECRET ?? "al-media-default-secret";
const DEFAULT_EXPIRY_SEC = 3600; // 1 hour
const port = Number(process.env.PORT) || 39994;
const baseUrl = process.env.BASE_URL ?? `http://localhost:${port}`;
const apiPrefix = "/api";

export function createVideoFileSign(videoFileId: number, expSec = DEFAULT_EXPIRY_SEC): { sign: string; exp: number } {
  const exp = Math.floor(Date.now() / 1000) + expSec;
  const payload = `${videoFileId}:${exp}`;
  const sign = createHmac("sha256", SIGN_SECRET).update(payload).digest("hex");
  return { sign, exp };
}

export function verifyVideoFileSign(videoFileId: number, sign: string, exp: string): boolean {
  const expNum = parseInt(exp, 10);
  if (Number.isNaN(expNum) || expNum < Math.floor(Date.now() / 1000)) {
    return false;
  }
  const payload = `${videoFileId}:${exp}`;
  const expected = createHmac("sha256", SIGN_SECRET).update(payload).digest("hex");
  if (expected.length !== sign.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sign, "hex"));
  } catch {
    return false;
  }
}

/** 生成带签名的视频文件完整访问 URL（admin file 路由在 /api/admin/file 下） */
export function buildSignedVideoFileUrl(videoFileId: number): string {
  const { sign, exp } = createVideoFileSign(videoFileId);
  return `${baseUrl}${apiPrefix}/admin/file/video-stream/${videoFileId}?sign=${sign}&exp=${exp}`;
}

/** 生成带签名的视频文件 URL（common file 路由在 /api/common/file 下，供 C 端使用） */
export function buildCommonSignedVideoFileUrl(videoFileId: number, pathOnly = false): string {
  const { sign, exp } = createVideoFileSign(videoFileId);
  const path = `${apiPrefix}/common/file/video-stream/${videoFileId}?sign=${sign}&exp=${exp}`;
  return pathOnly ? path : `${baseUrl}${path}`;
}
