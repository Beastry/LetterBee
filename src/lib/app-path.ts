/** Build-time public mount point. Next Link/router already apply this automatically. */
export const APP_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? (process.env.NODE_ENV === "production" ? "/letterbee" : "");
export function appPath(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//") || /[\\\u0000-\u0020]/.test(path)) throw new Error("Expected a safe application-relative path");
  if (!APP_BASE_PATH || path === APP_BASE_PATH || path.startsWith(`${APP_BASE_PATH}/`) || path.startsWith(`${APP_BASE_PATH}?`)) return path;
  return `${APP_BASE_PATH}${path}`;
}
export function cookieOptions() {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: APP_BASE_PATH || "/" };
}
