import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { allocatePublicId } from "./public-id";
import { claimInviteState, DEFAULT_INVITE_TTL_MS, generateInviteToken, hashPassphrase, type InviteState } from "./invite";
import { canSendLetter, createConnectedRelationship } from "./relationship";

export type MailUser = { id: string; name: string; publicId: string; cityId?: string; postOfficeId?: string; createdAt: string };
export type Invitation = InviteState & { id: string; token: string; inviterId: string; letterId: string; createdAt: string; claimedAt?: string; claimedByUserId?: string };
export type MailLetter = { id: string; senderId: string; recipientId?: string; invitationId?: string; recipientHintName: string; content: string; status: "PENDING_INVITE" | "POSTED" | "DELIVERED"; wordCount: number; senderPostOfficeId?: string; recipientPostOfficeId?: string; createdAt: string; sentAt?: string; deliveredAt?: string };
type Store = { users: Record<string, MailUser>; invitations: Invitation[]; letters: MailLetter[]; relationships: ReturnType<typeof createConnectedRelationship>[] };
const emptyStore = (): Store => ({ users: {}, invitations: [], letters: [], relationships: [] });
function directory() { return process.env.MAIL_DATA_DIR || path.join(process.cwd(), "data/mail"); }
// A single snapshot makes invitation, letter and relationship changes atomic. Single-process MVP.
export async function loadMailStore(): Promise<Store> {
  try { return JSON.parse(await readFile(path.join(directory(), "mail.json"), "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyStore(); throw error; }
}
let queue: Promise<unknown> = Promise.resolve();
function update<T>(fn: (store: Store) => T | Promise<T>): Promise<T> {
  const task = queue.then(async () => {
    const store = await loadMailStore();
    const result = await fn(store);
    await mkdir(directory(), { recursive: true });
    const temporary = path.join(directory(), `${randomUUID()}.tmp`);
    await writeFile(temporary, JSON.stringify(store, null, 2), { mode: 0o600 });
    await rename(temporary, path.join(directory(), "mail.json"));
    return result;
  });
  queue = task.catch(() => { });
  return task;
}
export function registerMailUser(user: { id?: string; name: string; publicId?: string; cityId?: string; postOfficeId?: string }) {
  return update(async (store) => {
    const id = user.id || `c${randomUUID().replaceAll("-", "")}`;
    const previous = store.users[id];
    let publicId = previous?.publicId || user.publicId;
    if (!publicId || Object.values(store.users).some(u => u.publicId === publicId && u.id !== id)) {
      publicId = await allocatePublicId(candidate => Object.values(store.users).some(u => u.publicId === candidate));
    }
    const registered: MailUser = { ...user, id, publicId, createdAt: previous?.createdAt || new Date().toISOString() };
    store.users[id] = registered;
    return registered;
  });
}
export async function getInvitationByToken(token: string) {
  const store = await loadMailStore();
  const invitation = store.invitations.find(i => i.token === token);
  return invitation ? { invitation, letter: store.letters.find(l => l.id === invitation.letterId)!, inviter: store.users[invitation.inviterId] } : null;
}
export function createInvitationWithLetter(user: MailUser, input: { recipientHintName: string; content: string; passphrase?: string; expiresInDays: number }) {
  return update(store => {
    const now = new Date();
    const invitation: Invitation = { id: randomUUID(), token: generateInviteToken(), inviterId: user.id, letterId: randomUUID(), recipientHintName: input.recipientHintName, status: "PENDING", createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + input.expiresInDays * DEFAULT_INVITE_TTL_MS / 7).toISOString(), passphraseHash: input.passphrase ? hashPassphrase(input.passphrase) : null };
    store.invitations.push(invitation);
    store.letters.push({ id: invitation.letterId, senderId: user.id, invitationId: invitation.id, recipientHintName: input.recipientHintName, content: input.content, status: "PENDING_INVITE", wordCount: Array.from(input.content).length, senderPostOfficeId: user.postOfficeId, createdAt: now.toISOString() });
    return invitation;
  });
}
export function claimInvitation(token: string, user: MailUser, passphrase: string, choice: "accept" | "block") {
  return update(store => {
    const invitation = store.invitations.find(i => i.token === token);
    if (!invitation) return { ok: false as const, reason: "missing" };
    if (invitation.inviterId === user.id) return { ok: false as const, reason: "self" };
    const now = new Date();
    const result = claimInviteState(invitation, now, passphrase, choice);
    if (!result.ok) return result;
    const relationship = createConnectedRelationship(invitation.inviterId, user.id, invitation.id, now);
    const existing = store.relationships.find(r => r.userAId === relationship.userAId && r.userBId === relationship.userBId);
    if (choice === "accept" && existing?.status === "BLOCKED") return { ok: false as const, reason: "blocked" };
    invitation.status = result.status;
    invitation.claimedByUserId = user.id;
    invitation.claimedAt = now.toISOString();
    relationship.status = choice === "block" ? "BLOCKED" : "CONNECTED";
    if (existing) Object.assign(existing, { status: relationship.status, updatedAt: now.toISOString() });
    else store.relationships.push(relationship);
    if (choice === "accept") {
      const letter = store.letters.find(l => l.id === invitation.letterId)!;
      Object.assign(letter, { recipientId: user.id, recipientPostOfficeId: user.postOfficeId, status: "DELIVERED", deliveredAt: now.toISOString() });
    }
    return { ok: true as const, letterId: invitation.letterId };
  });
}
export async function listRelationshipsForUser(userId: string) {
  const store = await loadMailStore();
  return store.relationships.filter(r => r.status === "CONNECTED" && (r.userAId === userId || r.userBId === userId)).map(r => ({ ...r, contact: store.users[r.userAId === userId ? r.userBId : r.userAId] }));
}

export async function findUserByPublicId(publicId: string) {
  return Object.values((await loadMailStore()).users).find(user => user.publicId === publicId);
}
export async function getRelationshipBetween(userAId: string, userBId: string) {
  return (await loadMailStore()).relationships.find(r =>
    (r.userAId === userAId && r.userBId === userBId) || (r.userAId === userBId && r.userBId === userAId));
}
export class SendLetterError extends Error {}
export function sendLetterToConnected(sender: MailUser, input: { recipientPublicId?: string; contactUserId?: string; content: string }) {
  return update(store => {
    const hasPublicId = Boolean(input.recipientPublicId?.trim());
    const hasContact = Boolean(input.contactUserId?.trim());
    if (hasPublicId === hasContact) throw new SendLetterError("请从通信簿选一位收信人，或填写完整的公开邮寄号。");
    const content = input.content.trim();
    if (!content || Array.from(content).length > 800) throw new SendLetterError("请写下正文，最多 800 字。");
    const recipientPublicId = input.recipientPublicId?.trim();
    const recipient = input.contactUserId ? store.users[input.contactUserId] : Object.values(store.users).find(user => user.publicId === recipientPublicId);
    if (!recipient) throw new SendLetterError("没有找到这位收信人，请核对完整的公开邮寄号（区分大小写）。");
    const relationship = store.relationships.find(r =>
      (r.userAId === sender.id && r.userBId === recipient.id) || (r.userBId === sender.id && r.userAId === recipient.id));
    if (!relationship || !canSendLetter(relationship.status)) throw new SendLetterError(relationship?.status === "BLOCKED" ? "你们之间已设置拒收，暂时不能寄信。" : "你们尚未建立通信关系，请先通过邀请信认领通邮。");
    const now = new Date().toISOString();
    const id = randomUUID();
    store.letters.push({ id, senderId: sender.id, recipientId: recipient.id, recipientHintName: recipient.name, content, status: "DELIVERED", wordCount: Array.from(content).length, senderPostOfficeId: sender.postOfficeId, recipientPostOfficeId: recipient.postOfficeId, createdAt: now, sentAt: now, deliveredAt: now });
    return id;
  });
}
