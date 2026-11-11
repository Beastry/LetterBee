import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { claimInvitation, createInvitationWithLetter, getInvitationByToken, listRelationshipsForUser, loadMailStore, registerMailUser, sendLetterToConnected, findUserByPublicId, getRelationshipBetween } from "./mail-store";
let directory: string;
beforeEach(async () => { directory = await mkdtemp(path.join(tmpdir(), "zqc-mail-test-")); vi.stubEnv("MAIL_DATA_DIR", directory); });
afterEach(async () => { vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });
it("口令校验、并发认领、双方通信簿与送达持久化", async () => {
  const a = await registerMailUser({ name: "寄信人" });
  const b = await registerMailUser({ name: "收信人", postOfficeId: "office" });
  const c = await registerMailUser({ name: "其他人" });
  expect((await registerMailUser(b)).publicId).toBe(b.publicId);
  const invitation = await createInvitationWithLetter(a, { recipientHintName: "小林", content: "见字如面", passphrase: "秋天", expiresInDays: 7 });
  expect((await claimInvitation(invitation.token, b, "错了", "accept")).ok).toBe(false);
  expect((await getInvitationByToken(invitation.token))?.invitation.status).toBe("PENDING");
  const results = await Promise.all([claimInvitation(invitation.token, b, "秋天", "accept"), claimInvitation(invitation.token, c, "秋天", "accept")]);
  expect(results.map(r => r.ok)).toEqual([true, false]);
  expect((await listRelationshipsForUser(a.id))[0].contact.id).toBe(b.id);
  expect((await listRelationshipsForUser(b.id))[0].contact.id).toBe(a.id);
  expect((await loadMailStore()).letters[0]).toMatchObject({ recipientId: b.id, recipientPostOfficeId: "office", status: "DELIVERED" });
});
it("拒收不交付信件，后续邀请无法越过屏蔽", async () => {
  const a = await registerMailUser({ name: "甲" }); const b = await registerMailUser({ name: "乙" });
  const input = { recipientHintName: "乙", content: "你好", expiresInDays: 7 };
  const first = await createInvitationWithLetter(a, input);
  expect((await claimInvitation(first.token, a, "", "accept")).ok).toBe(false);
  expect((await claimInvitation(first.token, b, "", "block")).ok).toBe(true);
  expect((await loadMailStore()).letters[0].recipientId).toBeUndefined();
  expect(await listRelationshipsForUser(a.id)).toEqual([]);
  const second = await createInvitationWithLetter(a, input);
  expect(await claimInvitation(second.token, b, "", "accept")).toMatchObject({ ok: false, reason: "blocked" });
});

it("已通邮双方可用精确邮寄号或通信簿寄信，并锁定当前邮局", async () => {
  const a = await registerMailUser({ name: "甲", postOfficeId: "a-office" });
  const b = await registerMailUser({ name: "乙", publicId: "ZqcAbC123", postOfficeId: "old-office" });
  const invite = await createInvitationWithLetter(a, { recipientHintName: "乙", content: "初次见面", expiresInDays: 7 });
  await claimInvitation(invite.token, b, "", "accept");
  await registerMailUser({ ...b, postOfficeId: "new-office" });
  const id = await sendLetterToConnected(a, { recipientPublicId: b.publicId, content: "再次见字如面" });
  expect((await loadMailStore()).letters.find(l => l.id === id)).toMatchObject({ senderId: a.id, recipientId: b.id, senderPostOfficeId: "a-office", recipientPostOfficeId: "new-office", status: "DELIVERED", content: "再次见字如面" });
  const reply = await sendLetterToConnected(b, { contactUserId: a.id, content: "回信" });
  expect((await loadMailStore()).letters.find(l => l.id === reply)?.recipientId).toBe(a.id);
  expect((await getRelationshipBetween(b.id, a.id))?.status).toBe("CONNECTED");
  expect((await findUserByPublicId(b.publicId))?.id).toBe(b.id);
  const count = (await loadMailStore()).letters.length;
  for (const publicId of ["unknown", b.publicId.toLowerCase(), b.publicId.slice(0, -1)]) {
    expect(await findUserByPublicId(publicId)).toBeUndefined();
    await expect(sendLetterToConnected(a, { recipientPublicId: publicId, content: "你好" })).rejects.toThrow("没有找到这位收信人");
  }
  await expect(sendLetterToConnected(a, { recipientPublicId: b.publicId, contactUserId: b.id, content: "你好" })).rejects.toThrow("请从通信簿");
  await expect(sendLetterToConnected(a, { contactUserId: b.id, content: " ".repeat(2) })).rejects.toThrow("正文");
  await expect(sendLetterToConnected(a, { contactUserId: b.id, content: "字".repeat(801) })).rejects.toThrow("800");
  expect((await loadMailStore()).letters).toHaveLength(count);
});
it("未通邮或屏蔽关系不能通过任一入口寄信", async () => {
  const a = await registerMailUser({ name: "甲" });
  const b = await registerMailUser({ name: "乙" });
  await expect(sendLetterToConnected(a, { recipientPublicId: b.publicId, content: "你好" })).rejects.toThrow("尚未建立通信关系");
  const invite = await createInvitationWithLetter(a, { recipientHintName: "乙", content: "邀请", expiresInDays: 7 });
  await claimInvitation(invite.token, b, "", "block");
  for (const [sender, recipient] of [[a, b], [b, a]]) {
    await expect(sendLetterToConnected(sender, { recipientPublicId: recipient.publicId, content: "你好" })).rejects.toThrow("拒收");
    await expect(sendLetterToConnected(sender, { contactUserId: recipient.id, content: "你好" })).rejects.toThrow("拒收");
  }
  expect((await loadMailStore()).letters).toHaveLength(1);
});
