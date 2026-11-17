import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export interface SnapshotStorage {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
}
export interface MailKV {
  get(key: string, type?: "text"): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}
export function kvSnapshotStorage(kv: MailKV, key = "mail:v1"): SnapshotStorage {
  return { read: () => kv.get(key, "text"), write: value => kv.put(key, value) };
}
export function fileSnapshotStorage(filename: string): SnapshotStorage {
  return {
    async read() {
      try { return await readFile(filename, "utf8"); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
    },
    async write(value) {
      await mkdir(path.dirname(filename), { recursive: true });
      const temporary = `${filename}.${randomUUID()}.tmp`;
      await writeFile(temporary, value, { mode: 0o600 });
      await rename(temporary, filename);
    },
  };
}
/** Cloud explicitly selects KV; a missing binding must never fall back to ephemeral files. */
export async function cloudMailKV(): Promise<MailKV | null> {
  if (process.env.MAIL_STORAGE_DRIVER !== "kv") return null;
  const { env } = await import("cloudflare:workers");
  if (!env.MAIL_STORE) throw new Error("MAIL_STORE KV binding is required");
  return env.MAIL_STORE;
}
export async function mailSnapshotStorage(): Promise<SnapshotStorage> {
  const kv = await cloudMailKV();
  return kv ? kvSnapshotStorage(kv) : fileSnapshotStorage(path.join(process.env.MAIL_DATA_DIR || path.join(process.cwd(), "data/mail"), "mail.json"));
}
