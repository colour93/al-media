import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { VideoFile } from "../entities/VideoFile";
import { videosTable } from "../entities/Video";
import { basename } from "node:path";
import { videoUniqueContentsTable } from "../entities/VideoUniqueContent";

class VideosService {
  constructor() { }

  async inferVideoInfo() {
    const systemPrompt = `
You are a helpful assistant that can help me extract information from a video file name. Give me all info following instruction strictly.
Please extract the information from the file name and return the information in the following json type:

type FileFromLlm = {
  title: string;
  creator?: string;
  creatorType?: 'person' | 'group';
  distributors?: string[];
  participants?: string[];
}

The content or domain name field in brackets [] is usually the creator.

When creator starts with @ or contains following keywords (case insensitive), it means the creator is a person.
If the following keywords are included but no valid creator can be retrieved, please keep the creator null. (like [NighTalks.Com] OnlyFans – 前編 熱々淫乱 雄生交尾.mp4 -> creator: null, distributors: [NighTalks.Com, OnlyFans])
- onlyfans
- justforfans
- fansone

For the following domains or keywords (case insensitive), they are distributors, not creators. Distributors do not participate in creatorType calculation.
- [NighTalks.com]

Known group creator list (case insensitive):
- [Bait Bus]
- [Bravo!]
- [RagingStallion]
- [MenOnEdge]
- [MenAtPlay]
- [Voyr]
- [NoirMale]
- [SeanCody]
- [KristenBjorn]
- [JapanBoyz]
- [LucasEntertainment]

Creator or distributor should not include [].
`;
  }

  async insertVideoFromVideoFile(videoFile: VideoFile) {
    return await db.transaction(async (tx) => {
      // uniqueId 在 video_unique_contents 表，需从该表查询再关联 video
      const existing = await tx.query.videoUniqueContentsTable.findFirst({
        where: eq(videoUniqueContentsTable.uniqueId, videoFile.uniqueId),
        with: {
          video: true,
        },
      });
      if (existing?.video) {
        return existing.video;
      }
      const created = await tx.insert(videosTable).values({
        title: basename(videoFile.fileKey),
      }).returning();
      await tx.insert(videoUniqueContentsTable).values({
        videoId: created[0].id,
        uniqueId: videoFile.uniqueId,
      });
      return created[0];
    })
  }
}

export const videosService = new VideosService();