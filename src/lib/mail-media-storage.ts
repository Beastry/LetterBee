import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { RichLetterError } from "@/modules/letter-kit/rich/model";
export interface MediaStorage {
  put(key: string, bytes: Uint8Array, mime: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
}
/** Independent private storage. Never points at the birthday site's public bucket. */
export async function mailMediaStorage(): Promise<MediaStorage> {
  if (process.env.MAIL_STORAGE_DRIVER === "kv") {
    const { env } = await import("cloudflare:workers");
    const r2 = (env as unknown as { LETTER_MEDIA?: R2Bucket }).LETTER_MEDIA;
    if (!r2)
      throw new RichLetterError(
        "云端附件尚未配置 LetterBee 独立 LETTER_MEDIA R2 存储；文字、排版和装饰仍可使用。",
        503,
      );
    return r2MediaStorage(r2);
  }
  const dir =
    process.env.MAIL_MEDIA_DIR ||
    path.join(/* turbopackIgnore: true */ process.cwd(), "data", "mail-media");
  // Local private runtime files must not be traced into deployment assets.
  return {
    async put(key, bytes) {
      checkKey(key);
      await mkdir(dir, { recursive: true, mode: 0o700 });
      await writeFile(path.join(/* turbopackIgnore: true */ dir, key), bytes, {
        mode: 0o600,
        flag: "wx",
      });
    },
    async get(key) {
      checkKey(key);
      try {
        return new Uint8Array(
          await readFile(path.join(/* turbopackIgnore: true */ dir, key)),
        );
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw e;
      }
    },
  };
}

export async function mailMediaAvailable() {
  if (process.env.MAIL_STORAGE_DRIVER !== "kv") return true;
  const { env } = await import("cloudflare:workers");
  return !!(env as unknown as { LETTER_MEDIA?: R2Bucket }).LETTER_MEDIA;
}

function checkKey(key: string) {
  if (!/^[a-f0-9-]{36}$/.test(key)) throw new RichLetterError("附件编号无效");
}
export function r2MediaStorage(
  r2: Pick<R2Bucket, "get" | "put">,
): MediaStorage {
  return {
    async put(key, bytes, mime) {
      checkKey(key);
      await r2.put(`v1/${key}`, bytes, { httpMetadata: { contentType: mime } });
    },
    async get(key) {
      checkKey(key);
      const value = await r2.get(`v1/${key}`);
      return value ? new Uint8Array(await value.arrayBuffer()) : null;
    },
  };
}
