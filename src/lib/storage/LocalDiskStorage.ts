import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { FileStorageService } from './FileStorageService';

const BASE_DIR = path.resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR ?? './storage');

/// Dev/self-hosted fallback: stores file bytes on local disk under a
/// per-application subdirectory, keyed by a random UUID + extension so keys
/// never leak the original filename. Documents are private by construction —
/// they are served only through the authenticated `/api/files/[id]` route,
/// never as a static/public path.
export class LocalDiskStorage implements FileStorageService {
  async upload({
    applicationId,
    fileName,
    data,
  }: {
    applicationId: string;
    fileName: string;
    data: Buffer;
  }): Promise<string> {
    const ext = path.extname(fileName);
    const key = path.posix.join(applicationId, `${randomUUID()}${ext}`);
    const fullPath = path.join(BASE_DIR, key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, data);
    return key;
  }

  async retrieve(storageKey: string): Promise<Buffer> {
    const fullPath = this.resolveSafe(storageKey);
    return fs.readFile(fullPath);
  }

  async delete(storageKey: string): Promise<void> {
    const fullPath = this.resolveSafe(storageKey);
    await fs.rm(fullPath, { force: true });
  }

  /// Resolves a storageKey to an absolute path while rejecting any key that
  /// would escape BASE_DIR (defense in depth against a malformed/hostile key).
  private resolveSafe(storageKey: string): string {
    const fullPath = path.join(BASE_DIR, storageKey);
    if (!fullPath.startsWith(BASE_DIR + path.sep)) {
      throw new Error('Invalid storage key');
    }
    return fullPath;
  }
}

let instance: FileStorageService | null = null;

export function getFileStorage(): FileStorageService {
  if (!instance) {
    instance = new LocalDiskStorage();
  }
  return instance;
}
