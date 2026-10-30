"use server";
import { redirect } from "next/navigation";
import { ensurePublicId, getCurrentUser } from "@/lib/session";
import { createInvitationWithLetter, sendLetterToConnected, SendLetterError } from "@/lib/mail-store";
export async function createInviteLetterAction(form: FormData) {
  const rawUser = await getCurrentUser();
  if (!rawUser) redirect("/login?next=/app/write");
  const user = await ensurePublicId(rawUser);
  const recipientHintName = String(form.get("recipientHintName") ?? "").trim();
  const content = String(form.get("content") ?? "").trim();
  const passphrase = String(form.get("passphrase") ?? "");
  const expiresInDays = Number(form.get("expiresInDays") || 7);
  if (!recipientHintName || recipientHintName.length > 40 || !content || Array.from(content).length > 800 || passphrase.length > 128 || !Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 30) redirect("/app/write?mode=new&error=invalid");
  const invitation = await createInvitationWithLetter(user, { recipientHintName, content, passphrase, expiresInDays });
  redirect(`/app/write/invite-created?token=${invitation.token}`);
}

export async function sendConnectedLetterAction(form: FormData) {
  const rawUser = await getCurrentUser();
  if (!rawUser) redirect("/login?next=/app/write");
  const user = await ensurePublicId(rawUser);
  const recipientPublicId = String(form.get("recipientPublicId") ?? "");
  const contactUserId = String(form.get("contactUserId") ?? "");
  const content = String(form.get("content") ?? "");
  let id: string;
  try {
    id = await sendLetterToConnected(user, { recipientPublicId, contactUserId, content });
  } catch (error) {
    if (!(error instanceof SendLetterError)) throw error;
    redirect(`/app/write?mode=${contactUserId ? "contacts" : "public"}&to=${encodeURIComponent(recipientPublicId)}&error=${encodeURIComponent(error.message)}`);
  }
  redirect(`/app/write/sent?id=${encodeURIComponent(id)}`);
}
