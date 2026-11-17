import { getCurrentUser } from "./session";
import { RichLetterError } from "@/modules/letter-kit/rich/model";
import { loadMailStore, SendLetterError } from "./mail-store";
export const privateHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
export async function apiUser(request: Request, mutation = false) {
  if (mutation && request.headers.get("origin") !== new URL(request.url).origin)
    throw new RichLetterError("请从本站页面操作", 403);
  const user = await getCurrentUser();
  if (!user) throw new RichLetterError("请先登录", 401);
  const profile = user.id ? (await loadMailStore()).users[user.id] : undefined;
  if (!profile) throw new RichLetterError("请重新登录", 401);
  return profile;
}
export async function readLimited(
  request: Request,
  max: number,
): Promise<Uint8Array> {
  const reader = request.body?.getReader();
  if (!reader) throw new RichLetterError("请求为空");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new RichLetterError("文件或信笺超过大小限制", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
export async function readMailJSON(
  request: Request,
): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new RichLetterError("需要JSON格式");
  try {
    const data = JSON.parse(
      new TextDecoder().decode(await readLimited(request, 160000)),
    );
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new Error();
    return data;
  } catch (e) {
    if (e instanceof RichLetterError) throw e;
    throw new RichLetterError("请求格式不正确");
  }
}
export function mailError(e: unknown) {
  const known = e instanceof RichLetterError || e instanceof SendLetterError;
  return Response.json(
    { error: known ? e.message : "暂时无法完成，请稍后重试" },
    {
      status: e instanceof RichLetterError ? e.status : known ? 400 : 500,
      headers: privateHeaders,
    },
  );
}
