import { readableDraftMedia } from "@/lib/mail-store";
import { apiUser, mailError, privateHeaders } from "@/lib/mail-api";
import { mailMediaStorage } from "@/lib/mail-media-storage";
import { formatISODate } from "@/modules/letter-kit/today";
import { RichLetterError } from "@/modules/letter-kit/rich/model";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await apiUser(request),
      id = (await params).id;
    if (!/^[a-f0-9-]{36}$/.test(id))
      throw new RichLetterError("找不到附件", 404);
    const media = await readableDraftMedia(
      user.id,
      id,
      formatISODate(new Date(), "Asia/Shanghai"),
    );
    if (!media) throw new RichLetterError("找不到附件", 404);
    const bytes = await (await mailMediaStorage()).get(id);
    if (!bytes) throw new RichLetterError("找不到附件", 404);
    const range = request.headers.get("range"),
      base = {
        ...privateHeaders,
        "Content-Type": media.mime,
        "Content-Disposition": "inline",
        "Accept-Ranges": "bytes",
      };
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2]))
        return new Response(null, {
          status: 416,
          headers: { ...base, "Content-Range": `bytes */${bytes.length}` },
        });
      const start = match[1]
          ? Number(match[1])
          : Math.max(0, bytes.length - Number(match[2])),
        end =
          match[1] && match[2]
            ? Math.min(Number(match[2]), bytes.length - 1)
            : bytes.length - 1;
      if (start > end || start >= bytes.length)
        return new Response(null, {
          status: 416,
          headers: { ...base, "Content-Range": `bytes */${bytes.length}` },
        });
      const part = bytes.slice(start, end + 1);
      return new Response(part, {
        status: 206,
        headers: {
          ...base,
          "Content-Range": `bytes ${start}-${end}/${bytes.length}`,
          "Content-Length": String(part.length),
        },
      });
    }
    return new Response(bytes.slice(), {
      headers: { ...base, "Content-Length": String(bytes.length) },
    });
  } catch (e) {
    return mailError(e);
  }
}
