import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fileSnapshotStorage, kvSnapshotStorage, mailSnapshotStorage } from "./persistence";
afterEach(() => vi.unstubAllEnvs());
describe("snapshot adapters", () => {
  it("reads missing local stores and atomically replaces snapshots", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "letterbee-"));
    try {
      const storage = fileSnapshotStorage(path.join(dir, "mail.json"));
      expect(await storage.read()).toBeNull();
      await storage.write('{"letters":[]}');
      expect(await storage.read()).toBe('{"letters":[]}');
      await writeFile(path.join(dir, "not-a-directory"), "x");
      await expect(fileSnapshotStorage(path.join(dir, "not-a-directory/file")).read()).rejects.toThrow();
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it("uses only the mail snapshot key for KV and propagates failures", async () => {
    const get = vi.fn().mockResolvedValue(null);
    const put = vi.fn().mockResolvedValue(undefined);
    const storage = kvSnapshotStorage({ get, put });
    expect(await storage.read()).toBeNull();
    await storage.write('{"users":{}}');
    expect(get).toHaveBeenCalledWith("mail:v1", "text");
    expect(put).toHaveBeenCalledWith("mail:v1", '{"users":{}}');
    get.mockRejectedValue(new Error("KV unavailable"));
    await expect(storage.read()).rejects.toThrow("KV unavailable");
  });
  it("fails closed when cloud bindings cannot be resolved", async () => {
    vi.stubEnv("MAIL_STORAGE_DRIVER", "kv");
    await expect(mailSnapshotStorage()).rejects.toThrow();
  });
});
