import { mkdir, rm, stat, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

function safePath(root: string, key: string) {
  const path = resolve(root, key);
  if (path !== root && !path.startsWith(root + "/"))
    throw new Error("invalid file key");
  return path;
}

export class DiskBucket {
  constructor(private root: string) {}

  async put(
    key: string,
    value: ArrayBuffer | Uint8Array,
    _options?: { httpMetadata?: { contentType?: string } },
  ) {
    const path = safePath(this.root, key);
    await mkdir(dirname(path), { recursive: true });
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    await writeFile(path, bytes);
  }

  async head(key: string) {
    try {
      const info = await stat(safePath(this.root, key));
      return { size: info.size };
    } catch {
      return null;
    }
  }

  async get(key: string, options?: { range?: { offset: number; length: number } }) {
    try {
      let bytes = await readFile(safePath(this.root, key));
      if (options?.range) {
        const end = options.range.offset + options.range.length;
        bytes = bytes.subarray(options.range.offset, end);
      }
      return { body: bytes };
    } catch {
      return null;
    }
  }

  async delete(keys: string | string[]) {
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      await rm(safePath(this.root, key), { force: true });
    }
  }
}
