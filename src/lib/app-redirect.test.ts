import { afterEach, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(path);
  },
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});
it("server action 303显式带生产prefix，已带prefix的目标不会重复", async () => {
  vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/letterbee");
  const { appRedirect } = await import("./app-redirect");
  expect(() => appRedirect("/app/write")).toThrow("/letterbee/app/write");
  expect(() => appRedirect("/letterbee/app/write")).toThrow(
    /^\/letterbee\/app\/write$/,
  );
  expect(() => appRedirect("//outside.example")).toThrow(
    "safe application-relative",
  );
});
it("server action本地根路径开关仍可用", async () => {
  vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "");
  const { appRedirect } = await import("./app-redirect");
  expect(() => appRedirect("/app/write")).toThrow(/^\/app\/write$/);
});
