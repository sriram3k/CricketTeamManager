import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../env.js';

/**
 * Storage is behind this interface so the local-disk implementation can be
 * swapped for S3 without touching any route or service.
 */
export interface StoredFile {
  key: string;
  url: string;
  size: number;
  contentType: string;
  originalName: string;
}

export interface StorageService {
  save(input: {
    buffer: Buffer;
    originalName: string;
    contentType: string;
    prefix?: string;
  }): Promise<StoredFile>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  /** Publicly reachable (or app-routed) URL for a stored key. */
  urlFor(key: string): string;
}

export class LocalStorageService implements StorageService {
  constructor(private readonly baseDir: string = env.uploadDir) {}

  private resolve(key: string): string {
    // Keys are generated internally, but resolve defensively so a crafted key
    // can never escape the upload directory.
    const full = path.resolve(this.baseDir, key);
    if (!full.startsWith(path.resolve(this.baseDir) + path.sep)) {
      throw new Error('Invalid storage key');
    }
    return full;
  }

  async save(input: {
    buffer: Buffer;
    originalName: string;
    contentType: string;
    prefix?: string;
  }): Promise<StoredFile> {
    const ext = path.extname(input.originalName) || '';
    const safeBase = crypto.randomBytes(16).toString('hex');
    const key = path.posix.join(input.prefix ?? 'misc', `${Date.now()}-${safeBase}${ext}`);

    const target = this.resolve(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, input.buffer);

    return {
      key,
      url: this.urlFor(key),
      size: input.buffer.length,
      contentType: input.contentType,
      originalName: input.originalName,
    };
  }

  async read(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }

  urlFor(key: string): string {
    return `/api/files/${key}`;
  }
}

export const storageService: StorageService = new LocalStorageService();
