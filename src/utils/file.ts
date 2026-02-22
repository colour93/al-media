import { readdir, open } from "node:fs/promises";
import { extname, join } from "node:path";
import { createHash } from "crypto";

export async function getFileCount(dir: string, allowedExt?: Set<string>) {
  const entries = await readdir(dir, { withFileTypes: true });

  let count = 0;

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      count += await getFileCount(fullPath, allowedExt);
    } else {
      if (allowedExt?.has(extname(fullPath))) count++
    }
  }

  return count;
}

const CHUNK_SIZE = 1024 * 1024; // 1MB

export async function getFileUniqueId(path: string) {
  const fd = await open(path, "r");
  try {
    const { size } = await fd.stat();
    const positions = [
      0,
      Math.floor(size * 0.25),
      Math.floor(size * 0.5),
      Math.floor(size * 0.75),
      size > CHUNK_SIZE ? size - CHUNK_SIZE : 0
    ];

    // Ensure chunk positions are unique and within the file size
    const uniquePositions = Array.from(new Set(positions.map(pos => Math.min(pos, size > CHUNK_SIZE ? size - CHUNK_SIZE : 0))));

    const chunks: Buffer[] = [];

    for (let pos of uniquePositions) {
      const length = Math.min(CHUNK_SIZE, size - pos);
      const buffer = Buffer.alloc(length);
      await fd.read(buffer, 0, length, pos);
      chunks.push(buffer);
    }

    const hash = createHash("sha256");
    for (let buf of chunks) {
      hash.update(buf);
    }
    // Hash the file size
    const sizeHash = createHash("sha256").update(size.toString()).digest();
    hash.update(sizeHash);

    // Final hash
    return hash.digest("hex");
  } finally {
    await fd.close();
  }
}