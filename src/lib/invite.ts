import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const DEFAULT_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export type InviteState = {
  status: "PENDING" | "CLAIMED" | "EXPIRED" | "REJECTED";
  expiresAt?: string | null;
  passphraseHash?: string | null;
  recipientHintName: string;
};
export function generateInviteToken() { return randomBytes(32).toString("base64url"); }
export function hashPassphrase(passphrase: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(passphrase, salt, 32).toString("hex")}`;
}
export function verifyPassphrase(attempt: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash || !/^[a-f0-9]{64}$/.test(hash)) return false;
  return timingSafeEqual(scryptSync(attempt, salt, 32), Buffer.from(hash, "hex"));
}
export function evaluateInviteAccess({ invitation, now = new Date(), passphraseAttempt = "" }: {
  invitation: InviteState; now?: Date; passphraseAttempt?: string;
}) {
  let reason: "expired" | "claimed" | "rejected" | "bad_passphrase" | "ok" = "ok";
  if (invitation.status === "CLAIMED") reason = "claimed";
  else if (invitation.status === "REJECTED") reason = "rejected";
  else if (invitation.status === "EXPIRED" || (invitation.expiresAt && new Date(invitation.expiresAt).getTime() <= now.getTime())) reason = "expired";
  else if (invitation.passphraseHash && !verifyPassphrase(passphraseAttempt, invitation.passphraseHash)) reason = "bad_passphrase";
  return { ok: reason === "ok", reason, canRevealContent: reason === "ok" };
}
export function buildInvitePreview({ invitation, inviterName }: { invitation: InviteState; inviterName: string }) {
  return { title: "有人给你写了一封信", description: `${inviterName} 写给 ${invitation.recipientHintName}，等你来邮局认领。` };
}
export function claimInviteState(invitation: InviteState, now: Date, passphraseAttempt: string, choice: "accept" | "block") {
  const access = evaluateInviteAccess({ invitation, now, passphraseAttempt });
  if (!access.ok) return { ok: false as const, reason: access.reason };
  return { ok: true as const, status: choice === "accept" ? "CLAIMED" as const : "REJECTED" as const };
}
