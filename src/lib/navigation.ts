export function safeNextPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return "/app/settings";
  return value;
}
