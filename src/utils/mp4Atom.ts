import { open } from "node:fs/promises";

export type Mp4AtomInfo = {
  moovOffset: number | null;
  mdatOffset: number | null;
  moovBeforeMdat: boolean | null;
};

const MP4_BOX_HEADER_SIZE = 8;
const MP4_EXTENDED_SIZE_HEADER_SIZE = 16;
const MAX_SCAN_BOX_COUNT = 100_000;

function readBigUInt64AsNumber(buf: Buffer, offset: number): number | null {
  const value = buf.readBigUInt64BE(offset);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(value);
}

/**
 * 解析 MP4 顶层 box，获取 moov/mdat 偏移并判断 moov 是否在 mdat 前。
 * 仅遍历顶层结构，不展开子 box，性能和准确性可用于 faststart 判定。
 */
export async function inspectMp4MoovAtom(filePath: string): Promise<Mp4AtomInfo> {
  const file = await open(filePath, "r");
  try {
    const stat = await file.stat();
    const fileSize = Number(stat.size);
    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return { moovOffset: null, mdatOffset: null, moovBeforeMdat: null };
    }

    let offset = 0;
    let moovOffset: number | null = null;
    let mdatOffset: number | null = null;
    let scannedBoxes = 0;

    while (offset + MP4_BOX_HEADER_SIZE <= fileSize && scannedBoxes < MAX_SCAN_BOX_COUNT) {
      const header = Buffer.alloc(MP4_BOX_HEADER_SIZE);
      const readHeader = await file.read(header, 0, header.length, offset);
      if (readHeader.bytesRead < header.length) break;

      const size32 = header.readUInt32BE(0);
      const type = header.toString("ascii", 4, 8);
      let boxSize = 0;
      let headerSize = MP4_BOX_HEADER_SIZE;

      if (size32 === 0) {
        boxSize = fileSize - offset;
      } else if (size32 === 1) {
        const ext = Buffer.alloc(8);
        const readExt = await file.read(ext, 0, ext.length, offset + MP4_BOX_HEADER_SIZE);
        if (readExt.bytesRead < ext.length) break;
        const extSize = readBigUInt64AsNumber(ext, 0);
        if (extSize == null) break;
        boxSize = extSize;
        headerSize = MP4_EXTENDED_SIZE_HEADER_SIZE;
      } else {
        boxSize = size32;
      }

      if (!Number.isFinite(boxSize) || boxSize < headerSize) break;
      if (type === "moov" && moovOffset == null) {
        moovOffset = offset;
      }
      if (type === "mdat" && mdatOffset == null) {
        mdatOffset = offset;
      }
      if (moovOffset != null && mdatOffset != null) {
        break;
      }

      offset += boxSize;
      scannedBoxes += 1;
    }

    return {
      moovOffset,
      mdatOffset,
      moovBeforeMdat:
        moovOffset != null && mdatOffset != null ? moovOffset < mdatOffset : null,
    };
  } finally {
    await file.close();
  }
}
