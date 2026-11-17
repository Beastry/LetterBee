import {
  createInvitationWithLetter,
  sendLetterToConnected,
} from "@/lib/mail-store";
import {
  apiUser,
  mailError,
  readMailJSON,
  privateHeaders,
} from "@/lib/mail-api";
import { ensurePublicId } from "@/lib/session";
import { RichLetterError } from "@/modules/letter-kit/rich/model";
import { appPath } from "@/lib/app-path";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await ensurePublicId(await apiUser(request, true)),
      data = await readMailJSON(request),
      draft = { id: (await params).id, revision: Number(data.revision) };
    if (data.mode === "new") {
      const recipientHintName = String(data.recipientHintName || "").trim(),
        passphrase = String(data.passphrase || ""),
        expiresInDays = Number(data.expiresInDays || 7);
      if (
        !recipientHintName ||
        recipientHintName.length > 40 ||
        passphrase.length > 128 ||
        !Number.isInteger(expiresInDays) ||
        expiresInDays < 1 ||
        expiresInDays > 30
      )
        throw new RichLetterError("请检查收信人、口令和有效期");
      const invite = await createInvitationWithLetter(user, {
        recipientHintName,
        passphrase,
        expiresInDays,
        content: "",
        draft,
      });
      return Response.json(
        {
          href: appPath(
            `/app/write/invite-created?token=${encodeURIComponent(invite.token)}`,
          ),
        },
        { headers: privateHeaders },
      );
    }
    if (data.mode !== "contact" && data.mode !== "public")
      throw new RichLetterError("请选择寄信方式");
    const id = await sendLetterToConnected(user, {
      content: "",
      draft,
      ...(data.mode === "contact"
        ? { contactUserId: String(data.contactUserId || "") }
        : { recipientPublicId: String(data.recipientPublicId || "") }),
    });
    return Response.json(
      { href: appPath(`/app/letters/${id}`) },
      { headers: privateHeaders },
    );
  } catch (e) {
    return mailError(e);
  }
}
