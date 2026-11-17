import { afterEach, expect, it, vi } from "vitest";
const { set } = vi.hoisted(() => ({ set: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set }) }));
vi.mock("./mail-store", () => ({ registerMailUser: async (u: object) => u }));
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); set.mockClear(); });
it("sets and expires the session using exactly the same mounted cookie path", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("LETTER_SESSION_SECRET", "test-session-secret-not-for-production");
  vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/letterbee");
  const { setCurrentUser, clearCurrentUser } = await import("./session");
  await setCurrentUser({ name: "Preview" });
  await clearCurrentUser();
  expect(set.mock.calls[0][2]).toMatchObject({ path: "/letterbee", secure: true, sameSite: "lax" });
  expect(set.mock.calls[1]).toEqual(["zqc_user", "", expect.objectContaining({ path: "/letterbee", maxAge: 0, secure: true })]);
});
