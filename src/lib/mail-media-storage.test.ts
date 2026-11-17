import { expect, it, vi } from "vitest";
import { r2MediaStorage } from "./mail-media-storage";
it("独立R2适配使用绑定对象和私有v1键，不引用个人bucket；拒绝路径穿越", async () => {
  const bytes = new Uint8Array([1, 2, 3]),
    put = vi.fn().mockResolvedValue({}),
    get = vi.fn().mockResolvedValue({ arrayBuffer: async () => bytes.buffer });
  const adapter = r2MediaStorage({ put, get } as unknown as Pick<
      R2Bucket,
      "get" | "put"
    >),
    id = crypto.randomUUID();
  await adapter.put(id, bytes, "image/png");
  expect(put).toHaveBeenCalledWith(`v1/${id}`, bytes, {
    httpMetadata: { contentType: "image/png" },
  });
  expect(await adapter.get(id)).toEqual(bytes);
  get.mockResolvedValue(null);
  expect(await adapter.get(id)).toBeNull();
  await expect(adapter.get("../../private")).rejects.toThrow("编号");
  expect(get).toHaveBeenCalledTimes(2);
});
