import {
  blankDocument,
  bodyText,
  documentMedia,
  parseRichDocument,
  RichLetterError,
  visibleDocument,
  type RichDocument,
} from "@/modules/letter-kit/rich/model";
import { mailSnapshotStorage } from "./persistence";
import { randomUUID } from "node:crypto";
import { allocatePublicId } from "./public-id";
import {
  claimInviteState,
  DEFAULT_INVITE_TTL_MS,
  generateInviteToken,
  hashPassphrase,
  type InviteState,
} from "./invite";
import { canSendLetter, createConnectedRelationship } from "./relationship";

export type MailUser = {
  id: string;
  name: string;
  publicId: string;
  cityId?: string;
  postOfficeId?: string;
  createdAt: string;
};
export type Invitation = InviteState & {
  id: string;
  token: string;
  inviterId: string;
  letterId: string;
  createdAt: string;
  claimedAt?: string;
  claimedByUserId?: string;
};
export type MailLetter = {
  id: string;
  senderId: string;
  recipientId?: string;
  invitationId?: string;
  recipientHintName: string;
  content: string;
  document?: RichDocument;
  status: "PENDING_INVITE" | "POSTED" | "DELIVERED";
  wordCount: number;
  senderPostOfficeId?: string;
  recipientPostOfficeId?: string;
  createdAt: string;
  sentAt?: string;
  deliveredAt?: string;
};
export type MailDraft = {
  id: string;
  ownerId: string;
  revision: number;
  document: RichDocument;
  createdAt: string;
  updatedAt: string;
  letterId?: string;
};
export type MailMedia = {
  id: string;
  draftId: string;
  ownerId: string;
  mime: string;
  size: number;
  createdAt: string;
};
type Store = {
  drafts: Record<string, MailDraft>;
  media: Record<string, MailMedia>;
  users: Record<string, MailUser>;
  invitations: Invitation[];
  letters: MailLetter[];
  relationships: ReturnType<typeof createConnectedRelationship>[];
};
const emptyStore = (): Store => ({
  drafts: {},
  media: {},
  users: {},
  invitations: [],
  letters: [],
  relationships: [],
});
// Local atomic file snapshot; KV snapshot is eventually consistent (preview only).
export async function loadMailStore(): Promise<Store> {
  const raw = await (await mailSnapshotStorage()).read();
  return raw === null ? emptyStore() : { ...emptyStore(), ...JSON.parse(raw) };
}
let queue: Promise<unknown> = Promise.resolve();
function update<T>(fn: (store: Store) => T | Promise<T>): Promise<T> {
  const task = queue.then(async () => {
    const store = await loadMailStore();
    const before = JSON.stringify(store);
    const result = await fn(store);
    // Reading a profile must not consume a KV write or hit its per-key write limit.
    if (JSON.stringify(store) !== before)
      await (await mailSnapshotStorage()).write(JSON.stringify(store, null, 2));
    return result;
  });
  queue = task.catch(() => {});
  return task;
}
export function registerMailUser(user: {
  id?: string;
  name: string;
  publicId?: string;
  cityId?: string;
  postOfficeId?: string;
}) {
  return update(async (store) => {
    const id = user.id || `c${randomUUID().replaceAll("-", "")}`;
    const previous = store.users[id];
    let publicId = previous?.publicId || user.publicId;
    if (
      !publicId ||
      Object.values(store.users).some(
        (u) => u.publicId === publicId && u.id !== id,
      )
    ) {
      publicId = await allocatePublicId((candidate) =>
        Object.values(store.users).some((u) => u.publicId === candidate),
      );
    }
    const registered: MailUser = {
      ...user,
      id,
      publicId,
      createdAt: previous?.createdAt || new Date().toISOString(),
    };
    store.users[id] = registered;
    return registered;
  });
}
export async function getInvitationByToken(token: string) {
  const store = await loadMailStore();
  const invitation = store.invitations.find((i) => i.token === token);
  return invitation
    ? {
        invitation,
        letter: store.letters.find((l) => l.id === invitation.letterId)!,
        inviter: store.users[invitation.inviterId],
      }
    : null;
}
export function createInvitationWithLetter(
  user: MailUser,
  input: {
    recipientHintName: string;
    content: string;
    passphrase?: string;
    expiresInDays: number;
    draft?: DraftVersion;
  },
) {
  return update((store) => {
    const rich = input.draft
      ? freezeDraft(store, user.id, input.draft)
      : undefined;
    const now = new Date();
    const invitation: Invitation = {
      id: randomUUID(),
      token: generateInviteToken(),
      inviterId: user.id,
      letterId: randomUUID(),
      recipientHintName: input.recipientHintName,
      status: "PENDING",
      createdAt: now.toISOString(),
      expiresAt: new Date(
        now.getTime() + (input.expiresInDays * DEFAULT_INVITE_TTL_MS) / 7,
      ).toISOString(),
      passphraseHash: input.passphrase
        ? hashPassphrase(input.passphrase)
        : null,
    };
    store.invitations.push(invitation);
    store.letters.push({
      id: invitation.letterId,
      senderId: user.id,
      invitationId: invitation.id,
      recipientHintName: input.recipientHintName,
      content: rich
        ? `图文信：${rich.document.title}（认领后展开完整信纸）`
        : input.content,
      document: rich?.document,
      status: "PENDING_INVITE",
      wordCount: rich
        ? Array.from(bodyText(rich.document)).length
        : Array.from(input.content).length,
      senderPostOfficeId: user.postOfficeId,
      createdAt: now.toISOString(),
    });
    if (rich) rich.letterId = invitation.letterId;
    return invitation;
  });
}
export function claimInvitation(
  token: string,
  user: MailUser,
  passphrase: string,
  choice: "accept" | "block",
) {
  return update((store) => {
    const invitation = store.invitations.find((i) => i.token === token);
    if (!invitation) return { ok: false as const, reason: "missing" };
    if (invitation.inviterId === user.id)
      return { ok: false as const, reason: "self" };
    const now = new Date();
    const result = claimInviteState(invitation, now, passphrase, choice);
    if (!result.ok) return result;
    const relationship = createConnectedRelationship(
      invitation.inviterId,
      user.id,
      invitation.id,
      now,
    );
    const existing = store.relationships.find(
      (r) =>
        r.userAId === relationship.userAId &&
        r.userBId === relationship.userBId,
    );
    if (choice === "accept" && existing?.status === "BLOCKED")
      return { ok: false as const, reason: "blocked" };
    invitation.status = result.status;
    invitation.claimedByUserId = user.id;
    invitation.claimedAt = now.toISOString();
    relationship.status = choice === "block" ? "BLOCKED" : "CONNECTED";
    if (existing)
      Object.assign(existing, {
        status: relationship.status,
        updatedAt: now.toISOString(),
      });
    else store.relationships.push(relationship);
    if (choice === "accept") {
      const letter = store.letters.find((l) => l.id === invitation.letterId)!;
      Object.assign(letter, {
        recipientId: user.id,
        recipientPostOfficeId: user.postOfficeId,
        status: "DELIVERED",
        deliveredAt: now.toISOString(),
      });
    }
    return { ok: true as const, letterId: invitation.letterId };
  });
}
export async function listRelationshipsForUser(userId: string) {
  const store = await loadMailStore();
  return store.relationships
    .filter(
      (r) =>
        r.status === "CONNECTED" &&
        (r.userAId === userId || r.userBId === userId),
    )
    .map((r) => ({
      ...r,
      contact: store.users[r.userAId === userId ? r.userBId : r.userAId],
    }));
}

export async function findUserByPublicId(publicId: string) {
  return Object.values((await loadMailStore()).users).find(
    (user) => user.publicId === publicId,
  );
}
export async function getRelationshipBetween(userAId: string, userBId: string) {
  return (await loadMailStore()).relationships.find(
    (r) =>
      (r.userAId === userAId && r.userBId === userBId) ||
      (r.userAId === userBId && r.userBId === userAId),
  );
}
export class SendLetterError extends Error {}
export function sendLetterToConnected(
  sender: MailUser,
  input: {
    recipientPublicId?: string;
    contactUserId?: string;
    content: string;
    draft?: DraftVersion;
  },
) {
  return update((store) => {
    const rich = input.draft
      ? freezeDraft(store, sender.id, input.draft)
      : undefined;
    const hasPublicId = Boolean(input.recipientPublicId?.trim());
    const hasContact = Boolean(input.contactUserId?.trim());
    if (hasPublicId === hasContact)
      throw new SendLetterError(
        "请从通信簿选一位收信人，或填写完整的公开邮寄号。",
      );
    const content = rich
      ? `图文信：${rich.document.title}`
      : input.content.trim();
    if (!content || Array.from(content).length > 800)
      throw new SendLetterError("请写下正文，最多 800 字。");
    const recipientPublicId = input.recipientPublicId?.trim();
    const recipient = input.contactUserId
      ? store.users[input.contactUserId]
      : Object.values(store.users).find(
          (user) => user.publicId === recipientPublicId,
        );
    if (!recipient)
      throw new SendLetterError(
        "没有找到这位收信人，请核对完整的公开邮寄号（区分大小写）。",
      );
    const relationship = store.relationships.find(
      (r) =>
        (r.userAId === sender.id && r.userBId === recipient.id) ||
        (r.userBId === sender.id && r.userAId === recipient.id),
    );
    if (!relationship || !canSendLetter(relationship.status))
      throw new SendLetterError(
        relationship?.status === "BLOCKED"
          ? "你们之间已设置拒收，暂时不能寄信。"
          : "你们尚未建立通信关系，请先通过邀请信认领通邮。",
      );
    const now = new Date().toISOString();
    const id = randomUUID();
    store.letters.push({
      id,
      senderId: sender.id,
      recipientId: recipient.id,
      recipientHintName: recipient.name,
      content,
      document: rich?.document,
      status: "DELIVERED",
      wordCount: rich
        ? Array.from(bodyText(rich.document)).length
        : Array.from(content).length,
      senderPostOfficeId: sender.postOfficeId,
      recipientPostOfficeId: recipient.postOfficeId,
      createdAt: now,
      sentAt: now,
      deliveredAt: now,
    });
    if (rich) rich.letterId = id;
    return id;
  });
}

export type DraftVersion = { id: string; revision: number };
function ownedDraft(
  store: Store,
  userId: string,
  draftId: string,
  editable = true,
): MailDraft {
  const draft = store.drafts[draftId];
  if (!draft || draft.ownerId !== userId)
    throw new RichLetterError("找不到这份草稿", 404);
  if (editable && draft.letterId)
    throw new RichLetterError("信已寄出，不能修改", 409);
  return draft;
}
function assertMedia(store: Store, draft: MailDraft, document: RichDocument) {
  for (const id of documentMedia(document))
    if (
      store.media[id]?.ownerId !== draft.ownerId ||
      store.media[id]?.draftId !== draft.id
    )
      throw new RichLetterError("媒体不属于这份草稿");
  for (const item of document.items) {
    const src = item.src.split("/").pop()!,
      mime = store.media[src]?.mime || "";
    if (
      ((item.t === "photo" ||
        ((item.t === "sticker" || item.t === "ending") && item.src)) &&
        !mime.startsWith("image/")) ||
      (item.t === "voice" && !mime.startsWith("audio/")) ||
      (item.t === "video" && !mime.startsWith("video/"))
    )
      throw new RichLetterError("媒体类型不匹配");
    if (
      item.poster &&
      !store.media[item.poster.split("/").pop()!]?.mime.startsWith("image/")
    )
      throw new RichLetterError("封面必须是图片");
  }
  const sealImage = document.style?.seal?.image;
  if (
    sealImage &&
    !store.media[sealImage.split("/").pop()!]?.mime.startsWith("image/")
  )
    throw new RichLetterError("印面必须是图片");
  for (const track of document.music.tracks)
    if (!store.media[track.src.split("/").pop()!]?.mime.startsWith("audio/"))
      throw new RichLetterError("背景音乐必须是音频");
}
function freezeDraft(
  store: Store,
  userId: string,
  version: DraftVersion,
): MailDraft {
  const draft = ownedDraft(store, userId, version.id);
  if (draft.revision !== version.revision)
    throw new RichLetterError("草稿已更新，请刷新再寄出", 409);
  const document = parseRichDocument(draft.document),
    count = Array.from(bodyText(document).trim()).length;
  if (!count || count > 800)
    throw new RichLetterError("请写下正文，正文及物件文字合计最多800字");
  assertMedia(store, draft, document);
  draft.document = structuredClone(document);
  return draft;
}
export function createMailDraft(user: MailUser) {
  return update((store) => {
    if (
      Object.values(store.drafts).filter(
        (d) => d.ownerId === user.id && !d.letterId,
      ).length >= 30
    )
      throw new RichLetterError("预览版最多保存30份草稿");
    const now = new Date().toISOString();
    const draft: MailDraft = {
      id: randomUUID(),
      ownerId: user.id,
      revision: 0,
      document: blankDocument(user.name),
      createdAt: now,
      updatedAt: now,
    };
    store.drafts[draft.id] = draft;
    return draft;
  });
}
export async function getMailDraft(userId: string, id: string) {
  return ownedDraft(await loadMailStore(), userId, id, false);
}
export function saveMailDraft(
  userId: string,
  id: string,
  revision: number,
  value: unknown,
) {
  return update((store) => {
    const draft = ownedDraft(store, userId, id);
    if (draft.revision !== revision)
      throw new RichLetterError("另一处已保存，请刷新避免覆盖", 409);
    const document = parseRichDocument(value);
    assertMedia(store, draft, document);
    Object.assign(draft, {
      document,
      revision: revision + 1,
      updatedAt: new Date().toISOString(),
    });
    return draft;
  });
}
/** Storage is injected: tests never access actual files or cloud resources. Writes stay serialized with send locally. */
export function attachDraftMedia(
  userId: string,
  draftId: string,
  media: Pick<MailMedia, "id" | "mime" | "size">,
  write: () => Promise<void>,
) {
  return update(async (store) => {
    const draft = ownedDraft(store, userId, draftId);
    const all = Object.values(store.media).filter((m) => m.draftId === draftId);
    if (
      all.length >= 40 ||
      all.reduce((n, m) => n + m.size, 0) + media.size > 32 * 1024 * 1024
    )
      throw new RichLetterError("每封信最多40个文件、总计32MB", 413);
    await write();
    const item: MailMedia = {
      ...media,
      draftId: draft.id,
      ownerId: userId,
      createdAt: new Date().toISOString(),
    };
    store.media[item.id] = item;
    return item;
  });
}
export async function readableDraftMedia(
  userId: string,
  mediaId: string,
  today: string,
) {
  const store = await loadMailStore(),
    media = store.media[mediaId];
  if (!media) return null;
  const draft = store.drafts[media.draftId];
  if (draft?.ownerId === userId && !draft.letterId) return media;
  const letter = store.letters.find((l) => l.id === draft?.letterId);
  if (
    !letter?.document ||
    !(
      letter.senderId === userId ||
      (letter.recipientId === userId && letter.status === "DELIVERED")
    )
  )
    return null;
  return documentMedia(visibleDocument(letter.document, today)).includes(
    mediaId,
  )
    ? media
    : null;
}

/** Same authorization/filtering boundary used by the actual received/sent page. */
export async function getReadableMailLetter(
  userId: string,
  id: string,
  today: string,
) {
  const store = await loadMailStore();
  const original = store.letters.find(
    (l) =>
      l.id === id &&
      (l.senderId === userId ||
        (l.recipientId === userId && l.status === "DELIVERED")),
  );
  if (!original) return null;
  return {
    letter: {
      ...original,
      document: original.document
        ? visibleDocument(original.document, today)
        : undefined,
    },
    sender: store.users[original.senderId],
  };
}
