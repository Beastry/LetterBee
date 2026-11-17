import { afterEach, describe, expect, it, vi } from "vitest";
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
describe("application mount point", () => {
  it("scopes raw URLs and cookies without double prefixes", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/letterbee");
    vi.stubEnv("NODE_ENV", "production");
    const { appPath, cookieOptions } = await import("./app-path");
    expect(appPath("/app?to=a")).toBe("/letterbee/app?to=a");
    expect(appPath("/letterbee/app")).toBe("/letterbee/app");
    expect(appPath("/letterbee?x=1")).toBe("/letterbee?x=1");
    expect(cookieOptions()).toEqual({ path: "/letterbee", secure: true, httpOnly: true, sameSite: "lax" });
    expect(() => appPath("//example.com")).toThrow();
    expect(() => appPath("/\\example.com")).toThrow();
  });
  it("supports root-mounted local development", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "");
    vi.stubEnv("NODE_ENV", "development");
    const { appPath, cookieOptions } = await import("./app-path");
    expect(appPath("/login")).toBe("/login");
    expect(cookieOptions()).toMatchObject({ path: "/", secure: false });
  });
});
