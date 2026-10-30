import { describe, expect, it, vi } from "vitest";
import { allocatePublicId, generatePublicId } from "./public-id";

describe("public IDs", () => {
  it("generates seven characters without ambiguous letters or digits", () => {
    for (let i = 0; i < 100; i++) {
      expect(generatePublicId()).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{7}$/);
    }
  });

  it("retries a collision before returning an available ID", async () => {
    const exists = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const id = await allocatePublicId(exists);
    expect(exists).toHaveBeenCalledTimes(2);
    expect(exists).toHaveBeenLastCalledWith(id);
  });

  it("throws after the maximum number of attempts", async () => {
    const exists = vi.fn(() => true);
    await expect(allocatePublicId(exists, 3)).rejects.toThrow("maximum attempts");
    expect(exists).toHaveBeenCalledTimes(3);
  });
});
