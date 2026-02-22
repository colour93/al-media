import { existsSync, mkdirSync } from "node:fs";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export enum FileCategory {
  Avatars = "avatars",
  Thumbnails = "thumbnails",
  Misc = "misc",
}

const CATEGORY_DIRS: Record<FileCategory, string> = {
  [FileCategory.Avatars]: "avatars",
  [FileCategory.Thumbnails]: "thumbnails",
  [FileCategory.Misc]: "misc",
};

export class FileManager {
  private readonly basePath: string;

  constructor() {
    const envPath = process.env.DATA_PATH;
    this.basePath = envPath ? resolve(process.cwd(), envPath) : join(process.cwd(), "data");
  }

  getBasePath(): string {
    return this.basePath;
  }

  getCategoryPath(category: FileCategory): string {
    return join(this.basePath, CATEGORY_DIRS[category as keyof typeof CATEGORY_DIRS]);
  }

  resolve(key: string, category: FileCategory): string {
    return join(this.getCategoryPath(category), key);
  }

  exists(key: string, category: FileCategory): boolean {
    return existsSync(this.resolve(key, category));
  }

  ensureCategoryDir(category: FileCategory): void {
    const dir = this.getCategoryPath(category);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  ensureAllDirs(): void {
    for (const cat of Object.keys(CATEGORY_DIRS) as FileCategory[]) {
      this.ensureCategoryDir(cat);
    }
  }

  async write(key: string, category: FileCategory, data: Buffer | string): Promise<void> {
    this.ensureCategoryDir(category);
    const path = this.resolve(key, category);
    await writeFile(path, data);
  }

  async read(key: string, category: FileCategory): Promise<Buffer> {
    const path = this.resolve(key, category);
    return readFile(path);
  }

  async delete(key: string, category: FileCategory): Promise<void> {
    const path = this.resolve(key, category);
    await unlink(path);
  }
}

export const fileManager = new FileManager();
