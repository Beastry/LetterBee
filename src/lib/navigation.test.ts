import { expect, it } from "vitest";
import { safeNextPath } from "./navigation";
it("登录只允许站内跳转", () => {
  expect(safeNextPath("/invite/token?test=1")).toBe("/invite/token?test=1");
  for (const value of ["/../other-site", "/app/%2e%2e/%2e%2e/", "/%2fexample.com", "https://example.com", "//example.com", "/\\example.com", "/\n/example.com", ""]) expect(safeNextPath(value)).toBe("/app/settings");
});
