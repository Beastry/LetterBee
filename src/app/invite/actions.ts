"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ensurePublicId, getCurrentUser } from "@/lib/session";
import { claimInvitation, getInvitationByToken } from "@/lib/mail-store";
import { evaluateInviteAccess } from "@/lib/invite";

function tokenFrom(form: FormData) {
  const token = String(form.get("token") ?? "");
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) redirect("/invite/invalid");
  return token;
}
export async function verifyInvitePassphraseAction(form: FormData) {
  const token = tokenFrom(form);
  const record = await getInvitationByToken(token);
  const attempt = String(form.get("passphrase") ?? "");
  if (!record || attempt.length > 128 || !evaluateInviteAccess({ invitation: record.invitation, passphraseAttempt: attempt }).ok) {
    redirect(`/invite/${token}?error=bad_passphrase`);
  }
  // Store the salted verifier, never the plaintext. It is HttpOnly and token-scoped.
  const jar = await cookies();
  jar.set(`invite_${token}`, record.invitation.passphraseHash || "", { httpOnly: true, sameSite: "lax", path: `/invite/${token}`, maxAge: 3600, secure: process.env.NODE_ENV === "production" });
  redirect(`/invite/${token}`);
}
export async function claimInviteAction(form: FormData) {
  const token = tokenFrom(form);
  const rawUser = await getCurrentUser();
  if (!rawUser) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  const user = await ensurePublicId(rawUser);
  const choice = String(form.get("choice") ?? "");
  if (choice !== "accept" && choice !== "block") redirect(`/invite/${token}?error=invalid`);
  const result = await claimInvitation(token, user, String(form.get("passphrase") ?? ""), choice);
  if (!result.ok) redirect(`/invite/${token}?error=${result.reason}`);
  redirect(choice === "accept" ? `/app/letters/${result.letterId}` : `/invite/${token}`);
}
