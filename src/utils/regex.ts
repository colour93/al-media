const REGEX_FLAGS_RE = /^[dgimsuvy]*$/;

function splitRegexLiteral(input: string): { source: string; flags: string } | null {
  if (!input.startsWith("/")) return null;
  if (input.length < 2) return null;

  let slashIndex = -1;
  for (let i = input.length - 1; i > 0; i -= 1) {
    if (input[i] !== "/") continue;
    let escapeCount = 0;
    for (let j = i - 1; j >= 0 && input[j] === "\\"; j -= 1) {
      escapeCount += 1;
    }
    if (escapeCount % 2 === 0) {
      slashIndex = i;
      break;
    }
  }

  if (slashIndex <= 0) return null;
  return {
    source: input.slice(1, slashIndex),
    flags: input.slice(slashIndex + 1),
  };
}

function normalizeFlags(flags: string): string | null {
  if (!REGEX_FLAGS_RE.test(flags)) return null;
  const seen = new Set<string>();
  let normalized = "";
  for (const flag of flags) {
    if (seen.has(flag)) continue;
    seen.add(flag);
    normalized += flag;
  }
  return normalized;
}

export type ParsedRegex = {
  source: string;
  flags: string;
  normalizedInput: string;
  regex: RegExp;
};

export function parseRegexInput(input: string): ParsedRegex | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const literal = splitRegexLiteral(trimmed);
  const source = literal ? literal.source : trimmed;
  const rawFlags = literal ? literal.flags : "";
  const flags = normalizeFlags(rawFlags);
  if (flags == null) return null;

  try {
    const regex = new RegExp(source, flags);
    return {
      source,
      flags,
      normalizedInput: literal ? `/${source}/${flags}` : source,
      regex,
    };
  } catch {
    return null;
  }
}
