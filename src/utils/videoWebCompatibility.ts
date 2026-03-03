export type VideoWebCompatibilityInput = {
  fileKey?: string | null;
  videoCodec?: string | null;
  audioCodec?: string | null;
  mp4MoovBeforeMdat?: boolean | null;
};

export type VideoWebCompatibilityResult = {
  webCompatible: boolean;
  webCompatibilityIssues: string[];
};

const WEB_FRIENDLY_CONTAINERS = new Set(["mp4", "m4v", "webm"]);
const WEB_FRIENDLY_VIDEO_CODECS = new Set([
  "h264",
  "avc",
  "avc1",
  "vp8",
  "vp9",
  "av1",
]);
const WEB_FRIENDLY_AUDIO_CODECS = new Set([
  "aac",
  "mp3",
  "opus",
  "vorbis",
]);

function normalizeCodec(codec?: string | null): string | null {
  if (!codec) return null;
  const raw = codec.trim().toLowerCase();
  if (!raw) return null;
  if (raw === "libx264") return "h264";
  if (raw.startsWith("avc")) return "avc";
  if (raw === "hevc" || raw === "h265") return "h265";
  return raw;
}

function inferContainerFromFileKey(fileKey?: string | null): string | null {
  if (!fileKey) return null;
  const idx = fileKey.lastIndexOf(".");
  if (idx < 0) return null;
  const ext = fileKey.slice(idx + 1).trim().toLowerCase();
  return ext || null;
}

export function evaluateVideoWebCompatibility(
  input: VideoWebCompatibilityInput
): VideoWebCompatibilityResult {
  const issues: string[] = [];
  const container = inferContainerFromFileKey(input.fileKey);
  const videoCodec = normalizeCodec(input.videoCodec);
  const audioCodec = normalizeCodec(input.audioCodec);

  const hasAnySignal =
    !!container || !!videoCodec || !!audioCodec || input.mp4MoovBeforeMdat != null;
  if (!hasAnySignal) {
    return {
      webCompatible: true,
      webCompatibilityIssues: [],
    };
  }

  if (!container) {
    issues.push("无法识别文件容器格式");
  } else if (!WEB_FRIENDLY_CONTAINERS.has(container)) {
    issues.push(`容器格式 ${container} 对 Web 兼容性较差`);
  }

  if (!videoCodec) {
    issues.push("未检测到视频编码");
  } else if (!WEB_FRIENDLY_VIDEO_CODECS.has(videoCodec)) {
    issues.push(`视频编码 ${videoCodec} 可能不兼容主流浏览器`);
  }

  if (audioCodec && !WEB_FRIENDLY_AUDIO_CODECS.has(audioCodec)) {
    issues.push(`音频编码 ${audioCodec} 可能不兼容主流浏览器`);
  }

  if (container === "mp4") {
    if (input.mp4MoovBeforeMdat === false) {
      issues.push("MP4 的 moov atom 位于文件尾部，可能导致网页端无法顺畅播放");
    } else if (input.mp4MoovBeforeMdat == null) {
      issues.push("MP4 的 moov atom 位置未知");
    }
  }

  return {
    webCompatible: issues.length === 0,
    webCompatibilityIssues: issues,
  };
}
