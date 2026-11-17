import { randomUUID } from "node:crypto";
import { attachDraftMedia, getMailDraft } from "@/lib/mail-store";
import {
  apiUser,
  mailError,
  readLimited,
  privateHeaders,
} from "@/lib/mail-api";
import { mailMediaStorage } from "@/lib/mail-media-storage";
import { MAX_MEDIA_BYTES, sniffMedia } from "@/modules/letter-kit/validate";
import { RichLetterError } from "@/modules/letter-kit/rich/model";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await apiUser(request, true),
      draftId = (await params).id;
    await getMailDraft(user.id, draftId);
    const storage = await mailMediaStorage(),
      raw = request.headers.get("content-type") || "",
      mime = raw.split(";")[0].trim().toLowerCase(),
      bytes = await readLimited(request, MAX_MEDIA_BYTES);
    if (!bytes.length || !sniffMedia(bytes, mime))
      throw new RichLetterError(
        "只支持有效的图片、音频或视频（不支持SVG），每个文件最多8MB",
      );
    const id = randomUUID();
    await attachDraftMedia(
      user.id,
      draftId,
      { id, mime, size: bytes.length },
      () => storage.put(id, bytes, mime),
    );
    return Response.json(
      { src: `/api/mail-media/${id}`, mime },
      { status: 201, headers: privateHeaders },
    );
  } catch (e) {
    return mailError(e);
  }
}
