import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      jar.has(name) ? { value: jar.get(name)! } : undefined,
    set: (name: string, value: string) => jar.set(name, value),
  }),
}));
import { setCurrentUser } from "./session";
import {
  attachDraftMedia,
  claimInvitation,
  createInvitationWithLetter,
  createMailDraft,
  getMailDraft,
  getReadableMailLetter,
  loadMailStore,
  readableDraftMedia,
  registerMailUser,
  saveMailDraft,
  sendLetterToConnected,
} from "./mail-store";
import { mailMediaStorage } from "./mail-media-storage";
import { POST as create } from "@/app/api/mail-drafts/route";
import { GET as get, PUT as put } from "@/app/api/mail-drafts/[id]/route";
import { POST as send } from "@/app/api/mail-drafts/[id]/send/route";
import { POST as upload } from "@/app/api/mail-drafts/[id]/media/route";
import { GET as media } from "@/app/api/mail-media/[id]/route";
import {
  blankDocument,
  blankItem,
  ITEM_TYPES,
  visibleDocument,
  type RichDocument,
} from "@/modules/letter-kit/rich/model";
const origin = "https://local.test";
const req = (
  url: string,
  method = "GET",
  body?: unknown,
  headers: Record<string, string> = {},
) =>
  new Request(origin + "/letterbee" + url, {
    method,
    headers: {
      ...(method !== "GET" ? { origin } : {}),
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
const context = (id: string) => ({ params: Promise.resolve({ id }) });
let root: string;
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "letterbee-rich-flow-"));
  vi.stubEnv("MAIL_DATA_DIR", root);
  vi.stubEnv("MAIL_MEDIA_DIR", path.join(root, "media"));
  vi.stubEnv("MAIL_STORAGE_DRIVER", "fs");
  jar.clear();
});
afterEach(async () => {
  jar.clear();
  vi.unstubAllEnvs();
  await rm(root, { recursive: true, force: true });
});
const png = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  ),
);
async function image(draftId: string) {
  const response = await upload(
    new Request(origin + `/letterbee/api/mail-drafts/${draftId}/media`, {
      method: "POST",
      headers: { origin, "content-type": "image/png" },
      body: png,
    }),
    context(draftId),
  );
  expect(response.status).toBe(201);
  return ((await response.json()) as { src: string }).src;
}
it("真实API闭环：新建→私有上传→版本保存→邀请寄出→口令认领→授权读信及range附件；寄出后不可改", async () => {
  const a = await registerMailUser({
      name: "寄信人",
      postOfficeId: "a-office",
    }),
    b = await registerMailUser({ name: "收信人", postOfficeId: "b-office" }),
    stranger = await registerMailUser({ name: "访客" });
  expect((await create(req("/api/mail-drafts", "POST"))).status).toBe(401);
  await setCurrentUser(a);
  expect(
    (
      await create(
        new Request(origin + "/api/mail-drafts", {
          method: "POST",
          headers: { origin: "https://outside.test" },
        }),
      )
    ).status,
  ).toBe(403);
  const made = await create(req("/api/mail-drafts", "POST"));
  expect(made.status).toBe(201);
  const draft = (await made.json()) as {
    id: string;
    revision: number;
    document: RichDocument;
  };
  const src = await image(draft.id),
    futureSrc = await image(draft.id);
  const mediaId = src.split("/").pop()!,
    futureId = futureSrc.split("/").pop()!;
  const document = draft.document;
  document.title = "中性回归信";
  document.paragraphs = [
    { id: "p1", text: "见字如面，愿一切顺利。" },
    { id: "p2", text: "找到的小纸条", hidden: true, hv: "ink" },
    { id: "p3", text: "未来段落内容", unlockAt: "2099-01-01" },
  ];
  document.items = [
    { ...blankItem("photo", "photo1"), src, caption: "中性单像素图" },
    {
      ...blankItem("photo", "photo2"),
      src: futureSrc,
      caption: "未来图片说明",
      unlockAt: "2099-01-01",
    },
    { ...blankItem("ticket", "ticket1"), text: "一次出发" },
    { ...blankItem("easter", "easter1"), message: "一份祝好" },
  ];
  await setCurrentUser(stranger);
  expect(
    (await get(req("/api/mail-drafts/" + draft.id), context(draft.id))).status,
  ).toBe(404);
  expect(
    (
      await put(
        req("/api/mail-drafts/" + draft.id, "PUT", { revision: 0, document }),
        context(draft.id),
      )
    ).status,
  ).toBe(404);
  expect(
    (await media(req("/api/mail-media/" + mediaId), context(mediaId))).status,
  ).toBe(404);
  await setCurrentUser(a);
  const saved = await put(
    req("/api/mail-drafts/" + draft.id, "PUT", { revision: 0, document }),
    context(draft.id),
  );
  expect(saved.status).toBe(200);
  expect(((await saved.json()) as { revision: number }).revision).toBe(1);
  expect(
    (
      await put(
        req("/api/mail-drafts/" + draft.id, "PUT", { revision: 0, document }),
        context(draft.id),
      )
    ).status,
  ).toBe(409);
  const sent = await send(
    req("/api/mail-drafts/" + draft.id + "/send", "POST", {
      revision: 1,
      mode: "new",
      recipientHintName: "收信人",
      passphrase: "neutral-fixture",
      expiresInDays: 7,
    }),
    context(draft.id),
  );
  expect(sent.status).toBe(200);
  expect(((await sent.json()) as { href: string }).href).toMatch(
    /\/app\/write\/invite-created\?token=/,
  );
  const store = await loadMailStore(),
    letter = store.letters[0],
    invite = store.invitations[0];
  expect(letter.document?.items).toHaveLength(4);
  expect(letter.content).not.toContain("找到的小纸条");
  expect(
    (
      await put(
        req("/api/mail-drafts/" + draft.id, "PUT", { revision: 1, document }),
        context(draft.id),
      )
    ).status,
  ).toBe(409);
  expect(
    (
      await upload(
        new Request(origin + "/media", {
          method: "POST",
          headers: { origin, "content-type": "image/png" },
          body: png,
        }),
        context(draft.id),
      )
    ).status,
  ).toBe(409);
  expect(
    (
      await send(
        req("/send", "POST", {
          revision: 1,
          mode: "new",
          recipientHintName: "收信人",
          expiresInDays: 7,
        }),
        context(draft.id),
      )
    ).status,
  ).toBe(409);
  await setCurrentUser(b);
  expect(await getReadableMailLetter(b.id, letter.id, "2026-11-17")).toBeNull();
  expect((await media(req("/media"), context(mediaId))).status).toBe(404);
  expect((await claimInvitation(invite.token, b, "wrong", "accept")).ok).toBe(
    false,
  );
  expect(
    (await claimInvitation(invite.token, b, "neutral-fixture", "accept")).ok,
  ).toBe(true);
  const read = await getReadableMailLetter(b.id, letter.id, "2026-11-17");
  expect(read?.letter.document?.paragraphs[1].hidden).toBe(true);
  expect(JSON.stringify(read)).not.toContain("未来段落内容");
  expect(JSON.stringify(read)).not.toContain("未来图片说明");
  expect(read?.letter.recipientPostOfficeId).toBe("b-office");
  expect(
    await getReadableMailLetter(stranger.id, letter.id, "2026-11-17"),
  ).toBeNull();
  const downloaded = await media(req("/media"), context(mediaId));
  expect(downloaded.status).toBe(200);
  expect(downloaded.headers.get("cache-control")).toContain("no-store");
  expect(new Uint8Array(await downloaded.arrayBuffer())).toEqual(png);
  const part = await media(
    req("/media", "GET", undefined, { range: "bytes=0-3" }),
    context(mediaId),
  );
  expect(part.status).toBe(206);
  expect(part.headers.get("content-range")).toBe(`bytes 0-3/${png.length}`);
  expect(new Uint8Array(await part.arrayBuffer())).toEqual(png.slice(0, 4));
  const suffix = await media(
    req("/media", "GET", undefined, { range: "bytes=-4" }),
    context(mediaId),
  );
  expect(suffix.status).toBe(206);
  expect(new Uint8Array(await suffix.arrayBuffer())).toEqual(png.slice(-4));
  expect(
    (
      await media(
        req("/media", "GET", undefined, { range: "bytes=99999-" }),
        context(mediaId),
      )
    ).status,
  ).toBe(416);
  expect(await readableDraftMedia(b.id, futureId, "2026-11-17")).toBeNull();
  expect(await readableDraftMedia(b.id, futureId, "2099-01-01")).not.toBeNull();
  expect((await loadMailStore()).letters).toHaveLength(1);
});
it("通信簿和精确publicId沿用通邮/拒收规则；原稿冻结且800字上限包含隐藏段", async () => {
  const a = await registerMailUser({ name: "甲" }),
    b = await registerMailUser({
      name: "乙",
      publicId: "FixtureAbC1",
      postOfficeId: "old",
    });
  const invitation = await createInvitationWithLetter(a, {
    recipientHintName: "乙",
    content: "中性初信",
    expiresInDays: 7,
  });
  await claimInvitation(invitation.token, b, "", "accept");
  await registerMailUser({ ...b, postOfficeId: "new" });
  const draft = await createMailDraft(a);
  draft.document.paragraphs[0].text = "中性回信";
  await saveMailDraft(a.id, draft.id, 0, draft.document);
  await expect(
    sendLetterToConnected(a, {
      recipientPublicId: b.publicId.toLowerCase(),
      content: "",
      draft: { id: draft.id, revision: 1 },
    }),
  ).rejects.toThrow("没有找到");
  expect((await getMailDraft(a.id, draft.id)).letterId).toBeUndefined();
  const id = await sendLetterToConnected(a, {
    recipientPublicId: b.publicId,
    content: "",
    draft: { id: draft.id, revision: 1 },
  });
  draft.document.paragraphs[0].text = "客户端后续修改";
  expect(
    (await getReadableMailLetter(b.id, id, "2026-11-17"))?.letter,
  ).toMatchObject({
    recipientPostOfficeId: "new",
    document: { paragraphs: [{ text: "中性回信" }] },
  });
  await expect(
    saveMailDraft(a.id, draft.id, 1, draft.document),
  ).rejects.toThrow("信已寄出");
  const over = await createMailDraft(a);
  over.document.paragraphs = [
    { id: "a", text: "字".repeat(800) },
    { id: "b", text: "多", hidden: true },
  ];
  await saveMailDraft(a.id, over.id, 0, over.document);
  await expect(
    sendLetterToConnected(a, {
      contactUserId: b.id,
      content: "",
      draft: { id: over.id, revision: 1 },
    }),
  ).rejects.toThrow("800");
  const block = await createInvitationWithLetter(a, {
    recipientHintName: "乙",
    content: "中性邀请",
    expiresInDays: 7,
  });
  await claimInvitation(block.token, b, "", "block");
  const blocked = await createMailDraft(a);
  blocked.document.paragraphs[0].text = "中性文本";
  await saveMailDraft(a.id, blocked.id, 0, blocked.document);
  await expect(
    sendLetterToConnected(a, {
      contactUserId: b.id,
      content: "",
      draft: { id: blocked.id, revision: 1 },
    }),
  ).rejects.toThrow("拒收");
  expect(
    (await getReadableMailLetter(b.id, invitation.letterId, "2026-11-17"))
      ?.letter.content,
  ).toBe("中性初信");
});
it("跨草稿媒体、伪造URL、HTML文件和无权限上传都被拒绝，旧快照可无损读取", async () => {
  const a = await registerMailUser({ name: "甲" });
  await setCurrentUser(a);
  const draft = await createMailDraft(a),
    other = await createMailDraft(a);
  const src = await image(other.id);
  draft.document.paragraphs[0].text = "中性";
  draft.document.items = [{ ...blankItem("photo", "photo1"), src }];
  await expect(
    saveMailDraft(a.id, draft.id, 0, draft.document),
  ).rejects.toThrow("不属于");
  draft.document.items[0].src = "https://private-source.example/personal.jpg";
  await expect(
    saveMailDraft(a.id, draft.id, 0, draft.document),
  ).rejects.toThrow("只能使用");
  const fake = await upload(
    new Request(origin + "/media", {
      method: "POST",
      headers: { origin, "content-type": "audio/wav" },
      body: "<html>not audio</html>",
    }),
    context(draft.id),
  );
  expect(fake.status).toBe(400);
  jar.clear();
  expect((await get(req("/draft"), context(draft.id))).status).toBe(401);
  expect(
    (await media(req("/media"), context(src.split("/").pop()!))).status,
  ).toBe(401);
  const old = await loadMailStore();
  const legacy = {
    users: old.users,
    letters: old.letters,
    invitations: old.invitations,
    relationships: old.relationships,
  };
  await writeFile(path.join(root, "mail.json"), JSON.stringify(legacy));
  const loaded = await loadMailStore();
  expect(loaded.drafts).toEqual({});
  expect(loaded.users).toEqual(old.users);
  expect(
    JSON.parse(await readFile(path.join(root, "mail.json"), "utf8")),
  ).toEqual(legacy);
});
it("fs附件私有持久化且限额不会写入多余文件；未来解锁不改变原稿", async () => {
  const a = await registerMailUser({ name: "甲" }),
    draft = await createMailDraft(a),
    storage = await mailMediaStorage();
  const key = crypto.randomUUID();
  await attachDraftMedia(
    a.id,
    draft.id,
    { id: key, mime: "image/png", size: 32 * 1024 * 1024 },
    () => storage.put(key, png, "image/png"),
  );
  expect(await storage.get(key)).toEqual(png);
  const noWrite = vi.fn();
  await expect(
    attachDraftMedia(
      a.id,
      draft.id,
      { id: crypto.randomUUID(), mime: "image/png", size: 1 },
      noWrite,
    ),
  ).rejects.toThrow("32MB");
  expect(noWrite).not.toHaveBeenCalled();
  const d = blankDocument("甲");
  d.paragraphs = [{ id: "p1", text: "未来内容", unlockAt: "2099-01-01" }];
  expect(visibleDocument(d, "2026-11-17").paragraphs[0].text).not.toBe(
    "未来内容",
  );
  expect(d.paragraphs[0].text).toBe("未来内容");
});
it("11种中性物件可经过草稿到寄出快照，并保持源布局字段", async () => {
  const a = await registerMailUser({ name: "甲" }),
    d = await createMailDraft(a);
  const mimeMap = {
    photo: "image/png",
    voice: "audio/wav",
    video: "video/mp4",
  };
  d.document.paragraphs[0].text = "中性物件回归";
  for (const t of ITEM_TYPES) {
    const item = blankItem(t, "item_" + t);
    if (t in mimeMap) {
      const id = crypto.randomUUID();
      await attachDraftMedia(
        a.id,
        d.id,
        { id, mime: mimeMap[t as keyof typeof mimeMap], size: 10 },
        async () => {},
      );
      item.src = "/api/mail-media/" + id;
    }
    item.x = 20;
    item.w = 36;
    item.r = -5;
    item.mode = "wrap";
    d.document.items.push(item);
  }
  await saveMailDraft(a.id, d.id, 0, d.document);
  const invite = await createInvitationWithLetter(a, {
    recipientHintName: "乙",
    content: "",
    expiresInDays: 7,
    draft: { id: d.id, revision: 1 },
  });
  const result = await getReadableMailLetter(
    a.id,
    invite.letterId,
    "2026-11-17",
  );
  expect(result?.letter.document?.items.map((i) => i.t)).toEqual([
    ...ITEM_TYPES,
  ]);
  expect(result?.letter.document?.items[0]).toMatchObject({
    x: 20,
    w: 36,
    r: -5,
    mode: "wrap",
  });
});
