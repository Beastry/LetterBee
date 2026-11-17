import { afterEach, expect, it, vi } from "vitest";
import { encodeSession, decodeSession } from "./session-codec";
afterEach(() => vi.unstubAllEnvs());
it("rejects unsigned, tampered and wrong-secret user cookies", () => {
  vi.stubEnv("LETTER_SESSION_SECRET", "test-session-secret-one-not-for-production");
  const user = { id: "one", name: "Preview", publicId: "Abc1234" };
  const value = encodeSession(user);
  expect(decodeSession(value)).toEqual(user);
  expect(decodeSession(value.split(".")[0])).toBeNull();
  expect(decodeSession(value.replace(/^./, "x"))).toBeNull();
  vi.stubEnv("LETTER_SESSION_SECRET", "test-session-secret-two-not-for-production");
  expect(decodeSession(value)).toBeNull();
});
