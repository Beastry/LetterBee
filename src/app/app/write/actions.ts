"use server";
import { redirect } from "next/navigation";
import { ensurePublicId, getCurrentUser } from "@/lib/session";
import { createInvitationWithLetter } from "@/lib/mail-store";
export async function createInviteLetterAction(form: FormData) {
  const rawUser = await getCurrentUser();
  if (!rawUser) redirect("/login?next=/app/write");
  const user = await ensurePublicId(rawUser);
  const recipientHintName = String(form.get("recipientHintName") ?? "").trim();
  const content = String(form.get("content") ?? "").trim();
  const passphrase = String(form.get("passphrase") ?? "");
  const expiresInDays = Number(form.get("expiresInDays") || 7);
  if (!recipientHintName || recipientHintName.length > 40 || !content || Array.from(content).length > 800 || passphrase.length > 128 || !Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 30) redirect("/app/write?error=invalid");
  const invitation = await createInvitationWithLetter(user, { recipientHintName, content, passphrase, expiresInDays });
  redirect(`/app/write/invite-created?token=${invitation.token}`);
}
