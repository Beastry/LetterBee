export function safeNextPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return "/app/settings";
  try {
    const pathname = decodeURIComponent(value.split(/[?#]/, 1)[0]);
    if (/[\\\u0000-\u0020]/.test(pathname) || pathname.startsWith("//") || pathname.split("/").some(segment => segment === "." || segment === "..")) return "/app/settings";
  } catch { return "/app/settings"; }
  return value;
}
