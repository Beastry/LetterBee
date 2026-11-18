"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { appPath } from "@/lib/app-path";
import type { MailDraft } from "@/lib/mail-store";
import {
  blankItem,
  bodyText,
  ITEM_TYPES,
  visibleDocument,
  type ItemType,
  type JournalItem,
  type RichDocument,
} from "./model";
import { appearance, type Appearance } from "./appearance";
import { createCaptureTools } from "./capture";
import { formatISODate } from "../today";
import { RichPaper } from "./RichPaper";
import { RichReader } from "./RichReader";
import "./capture.css";
import "./rich.css";
import "../ceremony/skin.css";
const labels: Record<ItemType, string> = {
  photo: "照片",
  voice: "语音",
  video: "影像",
  sticker: "贴纸",
  tape: "胶带",
  stamp: "邮戳",
  ticket: "票根",
  timeline: "邮路时间线",
  easter: "隐藏纸条",
  ending: "落款卡",
  hero: "题头",
};
const uid = () => crypto.randomUUID();
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(appPath(path), { ...init, cache: "no-store" });
  const data = (await r.json()) as { error?: string };
  if (!r.ok) throw new Error(data.error || "操作失败");
  return data as T;
}
const json = (data: unknown) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});
type Contact = { id: string; name: string; publicId: string };
export function RichComposer({
  draft,
  contacts,
  initialTo = "",
  initialMode,
  mediaAvailable = true,
}: {
  draft: MailDraft;
  contacts: Contact[];
  initialTo?: string;
  initialMode?: string;
  mediaAvailable?: boolean;
}) {
  const [doc, setDoc] = useState(draft.document),
    [revision, setRevision] = useState(draft.revision),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState(""),
    [preview, setPreview] = useState(false),
    [focus, setFocus] = useState(false),
    [dirty, setDirty] = useState(false),
    [undoCount, setUndoCount] = useState(0),
    [redoCount, setRedoCount] = useState(0);
  const current = useRef(doc),
    past = useRef<RichDocument[]>([]),
    future = useRef<RichDocument[]>([]),
    lastHistory = useRef(0),
    rev = useRef(revision),
    saving = useRef(false);
  const [capture] = useState(createCaptureTools);
  useEffect(() => () => capture.dispose(), [capture]);
  const [mode, setMode] = useState(
      initialTo || initialMode === "public"
        ? "public"
        : initialMode === "contacts" || initialMode === "contact"
          ? "contact"
          : "new",
    ),
    [recipientPublicId, setPublicId] = useState(initialTo),
    [contactUserId, setContact] = useState(contacts[0]?.id || ""),
    [recipientHintName, setRecipient] = useState(""),
    [passphrase, setPassphrase] = useState(""),
    [expiresInDays, setDays] = useState(7);
  const change = useCallback((fn: (d: RichDocument) => void, record = true) => {
    const next = structuredClone(current.current);
    fn(next);
    if (record && Date.now() - lastHistory.current > 500) {
      past.current = [...past.current.slice(-49), current.current];
      lastHistory.current = Date.now();
    }
    future.current = [];
    current.current = next;
    setDoc(next);
    setDirty(true);
    setUndoCount(past.current.length);
    setRedoCount(0);
  }, []);
  const history = useCallback((back: boolean) => {
    const from = back ? past : future,
      to = back ? future : past;
    const next = from.current.pop();
    if (!next) return;
    to.current.push(current.current);
    current.current = next;
    setDoc(next);
    setDirty(true);
    setUndoCount(past.current.length);
    setRedoCount(future.current.length);
  }, []);
  const save = useCallback(async () => {
    if (saving.current) throw new Error("正在保存，请稍候");
    saving.current = true;
    const value = current.current;
    try {
      const saved = await request<MailDraft>(`/api/mail-drafts/${draft.id}`, {
        method: "PUT",
        ...json({ revision: rev.current, document: value }),
      });
      rev.current = saved.revision;
      setRevision(saved.revision);
      if (current.current === value) setDirty(false);
      setNotice("草稿已保存；未寄出前仍可修改。");
      return saved;
    } finally {
      saving.current = false;
    }
  }, [draft.id]);
  async function run(task: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      await task();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [dirty]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest(
        "input,textarea,[contenteditable=true]",
      );
      if (
        !typing &&
        (e.ctrlKey || e.metaKey) &&
        ["z", "y"].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
        history(e.key.toLowerCase() === "z" && !e.shiftKey);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save().catch((e) => setNotice(e.message));
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [save, history]);
  function patch(id: string, value: Partial<JournalItem>, record = true) {
    change((d) => {
      const it = d.items.find((i) => i.id === id);
      if (it) Object.assign(it, value);
    }, record);
  }
  function add(t: ItemType, src = "", ratio = 1) {
    if (doc.items.length >= 80) {
      setNotice("每封信最多80个物件");
      return;
    }
    const it = blankItem(t, uid());
    it.src = src;
    it.ar = t === "voice" ? 2.6 : t === "video" ? 16 / 9 : ratio;
    it.dy = doc.items.length * 0.5;
    if (t === "tape") {
      it.ar = 4;
      it.w = 34;
    }
    if (["timeline", "hero", "ending"].includes(t)) {
      it.w = 90;
      it.x = 0;
      it.mode = "break";
      it.dy = 0;
      it.ar = 3;
    }
    if (t === "ticket") {
      it.text = "一张票根";
      it.ar = 2;
    }
    if (t === "easter") {
      it.heading = "翻开这张小纸条";
      it.message = "";
    }
    change((d) => {
      if (d.items.length >= 80) throw new Error("每封信最多80个物件");
      d.items.push(it);
    });
    setSelected(it.id);
  }
  async function upload(file: File) {
    if (!mediaAvailable)
      throw new Error("云端附件尚未配置独立R2存储；可先用文字和装饰写信。");
    let f = file,
      ratio = 1;
    if (file.type.startsWith("image/")) {
      if (file.type === "image/svg+xml")
        throw new Error("不支持SVG，请选择PNG/JPEG/WebP");
      const ready = await capture.prepareImage(file, {
        alpha: true,
      });
      f = ready.file;
      if (ready.w && ready.h) ratio = ready.w / ready.h;
    }
    const result = await request<{ src: string; mime: string }>(
      `/api/mail-drafts/${draft.id}/media`,
      {
        method: "POST",
        headers: { "Content-Type": f.type || "application/octet-stream" },
        body: f,
      },
    );
    return { ...result, ratio: Math.max(0.2, Math.min(5, ratio)) };
  }
  async function addFiles(
    files: FileList | File[],
    kind?: ItemType | "music",
    replace?: string,
    poster = false,
  ) {
    for (const file of Array.from(files).slice(0, 20)) {
      const up = await upload(file),
        t =
          kind ||
          (up.mime.startsWith("image/")
            ? "photo"
            : up.mime.startsWith("audio/")
              ? "voice"
              : "video");
      if (t === "music")
        change((d) => {
          if (d.music.tracks.length >= 20) throw new Error("最多20首音乐");
          d.music.tracks.push({
            id: uid(),
            title: file.name.slice(0, 80),
            src: up.src,
            cs: 0,
            ce: 0,
            vol: 1,
          });
        });
      else if (replace)
        patch(
          replace,
          poster ? { poster: up.src } : { src: up.src, ar: up.ratio },
        );
      else add(t, up.src, up.ratio);
    }
    setNotice("附件已存入这份草稿的私有存储；请保存信笺。");
  }
  async function capturePhoto() {
    const file = await capture.takePhoto({});
    if (file) await addFiles([file], "photo");
  }
  async function recordVoice() {
    await capture.recorder({
      maxSec: 150,
      title: "录一段夹在信里的语音",
      onSave: async (file, progress) => {
        try {
          progress(10);
          await addFiles([file], "voice");
          progress(100);
          return true;
        } catch (e) {
          setNotice(e instanceof Error ? e.message : "上传失败");
          return false;
        }
      },
    });
  }
  async function compressAll() {
    const originals = current.current.items
      .flatMap((i) => [i.src, i.poster])
      .filter(Boolean);
    const replacements = new Map<string, string>();
    for (const src of new Set(originals)) {
      const r = await fetch(appPath(src));
      if (!r.ok) throw new Error("无法读取附件");
      const b = await r.blob();
      if (!b.type.startsWith("image/")) continue;
      const up = await upload(new File([b], "image", { type: b.type }));
      replacements.set(src, up.src);
    }
    change((d) =>
      d.items.forEach((i) => {
        i.src = replacements.get(i.src) || i.src;
        i.poster = replacements.get(i.poster) || i.poster;
      }),
    );
    setNotice("图片已重新压缩为新附件；原件未覆盖，请保存。");
  }
  async function send() {
    if (!window.confirm("信寄出后不能再修改。确定封好寄出？")) return;
    const saved = await save();
    const result = await request<{ href: string }>(
      `/api/mail-drafts/${draft.id}/send`,
      {
        method: "POST",
        ...json({
          revision: saved.revision,
          mode,
          recipientPublicId,
          contactUserId,
          recipientHintName,
          passphrase,
          expiresInDays,
        }),
      },
    );
    window.location.assign(result.href);
  }
  const chosen = doc.items.find((i) => i.id === selected),
    count = Array.from(bodyText(doc)).length;
  function stylePart<K extends keyof Appearance>(
    key: K,
    value: Partial<NonNullable<Appearance[K]>>,
  ) {
    change((d) => {
      d.style ||= {};
      const fallback =
        key === "seal"
          ? appearance.SEAL_DEFAULT
          : key === "paper"
            ? appearance.PAPER_DEFAULT
            : appearance.ENV_DEFAULT;
      Object.assign(d.style, {
        [key]: { ...fallback, ...d.style[key], ...value },
      });
    });
  }
  const field = (
    key:
      | "title"
      | "to"
      | "from"
      | "postmark"
      | "dateline"
      | "salutation"
      | "signoff",
    label: string,
  ) => (
    <label key={key}>
      {label}
      <input
        value={doc[key]}
        onChange={(e) =>
          change((d) => {
            d[key] = e.target.value;
          })
        }
        maxLength={key === "to" || key === "from" ? 40 : 80}
      />
    </label>
  );
  const fileInput = (
    kind: ItemType | "music",
    label: string,
    replace?: string,
    poster = false,
  ) => (
    <label>
      {label}
      <input
        disabled={busy || !mediaAvailable}
        type="file"
        accept={
          poster || kind === "photo" || kind === "sticker" || kind === "ending"
            ? "image/png,image/jpeg,image/webp,image/gif"
            : kind === "video"
              ? "video/mp4,video/webm"
              : "audio/*"
        }
        multiple={!replace}
        onChange={(e) => {
          const files = e.target.files;
          if (files?.length)
            void run(() => addFiles(files, kind, replace, poster));
          e.target.value = "";
        }}
      />
    </label>
  );
  return (
    <main
      className={`lb-skin rich-workspace ${focus ? "rich-focus" : ""}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDrop={(e) => {
        if (e.dataTransfer.files.length) {
          e.preventDefault();
          void run(() => addFiles(e.dataTransfer.files));
        }
      }}
    >
      <div className="top">
        <h1>写一封信</h1>
        <Link href="/app/write">草稿箱</Link>
        <button
          type="button"
          disabled={busy || !undoCount}
          onClick={() => history(true)}
        >
          撤销
        </button>
        <button
          type="button"
          disabled={busy || !redoCount}
          onClick={() => history(false)}
        >
          重做
        </button>
        <button type="button" onClick={() => setFocus((v) => !v)}>
          {focus ? "退出专注" : "专注写信"}
        </button>
        <button type="button" className="primary" disabled={busy} onClick={() => void run(save)}>
          保存草稿
        </button>
        <button type="button" onClick={() => setPreview(true)}>
          收信预览
        </button>
        <span className="auto-state">
          {dirty ? "未保存" : "已保存"} · r{revision} · {count}/800字
        </span>
      </div>
      <p className="rich-privacy-note">
        预览版 ·
        不要放真实私信或个人媒体。寄出后冻结原稿。隐藏段是阅读彩蛋，不是加密；定时文字和附件在服务端按上海时区过滤。正文及物件文字合计最多800字。
      </p>
      {!mediaAvailable && (
        <p className="rich-status">
          本预览尚未配置独立 LETTER_MEDIA
          R2：文字、排版、贴纸符号、封缄可用，上传/相机/录音不可用。
        </p>
      )}
      {notice && (
        <p role="status" className="rich-status">
          {notice}
        </p>
      )}
      <div className="rich-columns" inert={busy}>
        <aside className="rich-controls" aria-label="编辑工具">
          <details open>
            <summary>信封与信笺</summary>
            {field("title", "标题")}
            <label>
              整封信展开日期（可选，上海时区）
              <input
                type="date"
                value={doc.unlockAt || ""}
                onChange={(e) =>
                  change((d) => {
                    d.unlockAt = e.target.value || undefined;
                  })
                }
              />
            </label>
            {field("to", "信封上写给谁（不代替投递地址）")}
            {field("from", "信封寄信人（不更改账号身份）")}
            {field("postmark", "邮戳")}
            {field("dateline", "写信地点/日期")}
            {field("salutation", "称呼")}
            {field("signoff", "署名/落款")}
          </details>
          <details open>
            <summary>正文与隐藏段</summary>
            {doc.paragraphs.map((p, n) => (
              <fieldset key={p.id}>
                <legend>第{n + 1}段</legend>
                <textarea
                  aria-label={`第${n + 1}段正文`}
                  value={p.text}
                  onChange={(e) =>
                    change((d) => {
                      d.paragraphs[n].text = e.target.value;
                    })
                  }
                  onPaste={(e) => {
                    const files = e.clipboardData.files;
                    if (files.length) {
                      e.preventDefault();
                      void run(() => addFiles(files));
                    }
                  }}
                />
                <label>
                  <input
                    type="checkbox"
                    checked={!!p.hidden}
                    onChange={(e) =>
                      change((d) => {
                        d.paragraphs[n].hidden = e.target.checked;
                      })
                    }
                  />
                  藏起这一段
                </label>
                {p.hidden && (
                  <label>
                    发现方式
                    <select
                      value={p.hv || "speck"}
                      onChange={(e) =>
                        change((d) => {
                          d.paragraphs[n].hv = e.target.value as
                            "speck" | "ink" | "emboss";
                        })
                      }
                    >
                      <option value="speck">纸上微点</option>
                      <option value="emboss">浅压印</option>
                      <option value="ink">隐形墨水</option>
                    </select>
                  </label>
                )}
                <label>
                  展开日期（上海时区）
                  <input
                    type="date"
                    value={p.unlockAt || ""}
                    onChange={(e) =>
                      change((d) => {
                        d.paragraphs[n].unlockAt = e.target.value || undefined;
                      })
                    }
                  />
                </label>
                <div className="rich-toolbar">
                  <button
                    type="button"
                    disabled={!n}
                    onClick={() =>
                      change((d) => {
                        [d.paragraphs[n - 1], d.paragraphs[n]] = [
                          d.paragraphs[n],
                          d.paragraphs[n - 1],
                        ];
                        d.items.forEach((i) => {
                          if (i.pi === n) i.pi--;
                          else if (i.pi === n - 1) i.pi++;
                        });
                      })
                    }
                  >
                    上移
                  </button>
                  <button
                    type="button"
                    disabled={doc.paragraphs.length === 1}
                    onClick={() =>
                      change((d) => {
                        d.paragraphs.splice(n, 1);
                        d.items.forEach((i) => {
                          if (i.pi > n) i.pi--;
                          i.pi = Math.min(i.pi, d.paragraphs.length - 1);
                        });
                      })
                    }
                  >
                    删除段落
                  </button>
                </div>
              </fieldset>
            ))}
            <button
              type="button"
              disabled={doc.paragraphs.length >= 60}
              onClick={() =>
                change((d) =>
                  d.paragraphs.push({ id: uid(), text: "", hv: "speck" }),
                )
              }
            >
              ＋另起一段
            </button>
            <p className="rich-privacy-note">
              也可双击右侧信纸文字就地编辑。粘贴为纯文字，不执行HTML。
            </p>
          </details>
          <details open>
            <summary>纸上物件 · 拖放排版</summary>
            <div className="rich-toolbar">
              {ITEM_TYPES.filter(
                (t) => !["photo", "voice", "video"].includes(t),
              ).map((t) => (
                <button type="button" key={t} onClick={() => add(t)}>
                  {labels[t]}
                </button>
              ))}
            </div>
            {fileInput("photo", "添加照片（可多选/拖放/粘贴）")}
            {fileInput("voice", "添加音频")}
            {fileInput("video", "添加视频")}
            {fileInput("sticker", "添加自己的透明贴纸")}
            <div className="rich-toolbar">
              <button
                type="button"
                disabled={busy || !mediaAvailable}
                onClick={() => void run(capturePhoto)}
              >
                拍照
              </button>
              <button
                type="button"
                disabled={busy || !mediaAvailable}
                onClick={() => void run(recordVoice)}
              >
                录音
              </button>
              <button
                type="button"
                disabled={busy || !mediaAvailable}
                onClick={() => void run(compressAll)}
              >
                压缩本信图片
              </button>
            </div>
            <p className="rich-privacy-note">
              图片去EXIF并压缩到最长1800px；GIF保留动画。单文件8MB，每信40文件/32MB。不加载生日站素材。
            </p>
            <label>
              选择物件
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">未选中</option>
                {doc.items.map((i) => (
                  <option value={i.id} key={i.id}>
                    {labels[i.t]} ·{" "}
                    {i.heading || i.caption || i.text || i.id.slice(0, 6)}
                  </option>
                ))}
              </select>
            </label>
            {chosen && (
              <fieldset>
                <legend>{labels[chosen.t]}设置</legend>
                <div className="rich-mini">
                  {(
                    [
                      ["x", "水平位置", 0, 100],
                      ["dy", "垂直偏移(行)", -6, 80],
                      ["w", "宽度%", 4, 100],
                      ["r", "旋转角", -180, 180],
                      ["z", "层级", 0, 60],
                    ] as const
                  ).map(([k, label, min, max]) => (
                    <label key={k}>
                      {label}
                      <input
                        type="number"
                        min={min}
                        max={max}
                        step={k === "z" ? 1 : 0.1}
                        value={chosen[k]}
                        onChange={(e) =>
                          patch(chosen.id, { [k]: Number(e.target.value) })
                        }
                      />
                    </label>
                  ))}
                </div>
                <label>
                  锚定段落
                  <select
                    value={chosen.pi}
                    onChange={(e) =>
                      patch(chosen.id, { pi: Number(e.target.value) })
                    }
                  >
                    {doc.paragraphs.map((p, n) => (
                      <option key={p.id} value={n}>
                        第{n + 1}段
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  相对物件
                  <select
                    value={chosen.ref || ""}
                    onChange={(e) =>
                      patch(chosen.id, { ref: e.target.value || undefined })
                    }
                  >
                    <option value="">无</option>
                    {doc.items
                      .filter((i) => i.id !== chosen.id)
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {labels[i.t]} {i.id.slice(0, 5)}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  排版
                  <select
                    value={chosen.mode}
                    onChange={(e) =>
                      patch(chosen.id, {
                        mode: e.target.value as JournalItem["mode"],
                      })
                    }
                  >
                    <option value="wrap">文字环绕</option>
                    <option value="break">独占一行</option>
                    <option value="over">浮于文字上</option>
                  </select>
                </label>
                <label>
                  展开日期
                  <input
                    type="date"
                    value={chosen.unlockAt || ""}
                    onChange={(e) =>
                      patch(chosen.id, {
                        unlockAt: e.target.value || undefined,
                      })
                    }
                  />
                </label>
                {(["heading", "caption", "text", "sub", "message"] as const)
                  .filter((k) =>
                    k === "caption"
                      ? ["photo", "voice", "video"].includes(chosen.t)
                      : k === "message"
                        ? chosen.t === "easter"
                        : k === "heading"
                          ? ["hero", "ending", "easter"].includes(chosen.t)
                          : ["ticket", "stamp", "hero", "ending"].includes(
                              chosen.t,
                            ),
                  )
                  .map((k) => (
                    <label key={k}>
                      {
                        {
                          heading: "题头",
                          caption: "说明",
                          text: "文字",
                          sub: "副标题",
                          message: "藏着的话",
                        }[k]
                      }
                      <textarea
                        value={chosen[k]}
                        onChange={(e) =>
                          patch(chosen.id, { [k]: e.target.value })
                        }
                      />
                    </label>
                  ))}
                {chosen.t === "sticker" && !chosen.src && (
                  <label>
                    中性符号
                    <select
                      value={chosen.k}
                      onChange={(e) => patch(chosen.id, { k: e.target.value })}
                    >
                      {["✉", "✦", "☘", "♡", "❀", "◌"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                )}
                {chosen.t === "tape" && (
                  <label>
                    胶带样式
                    <select
                      value={chosen.k}
                      onChange={(e) => patch(chosen.id, { k: e.target.value })}
                    >
                      {["wine", "gold", "linen", "grid", "sage"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                )}
                {["photo", "voice", "video", "sticker"].includes(chosen.t) &&
                  fileInput(chosen.t, "更换文件", chosen.id)}
                {chosen.t === "ending" &&
                  fileInput("ending", "落款自带印章图片", chosen.id)}
                {chosen.t === "video" &&
                  fileInput("photo", "视频封面", chosen.id, true)}
                {chosen.t === "timeline" && (
                  <div>
                    {chosen.events.map((e, n) => (
                      <fieldset key={n}>
                        {(["date", "title", "text"] as const).map((k) => (
                          <label key={k}>
                            {{ date: "日期", title: "标题", text: "记录" }[k]}
                            <input
                              value={e[k]}
                              onChange={(ev) =>
                                patch(chosen.id, {
                                  events: chosen.events.map((v, i) =>
                                    i === n
                                      ? { ...v, [k]: ev.target.value }
                                      : v,
                                  ),
                                })
                              }
                            />
                          </label>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            patch(chosen.id, {
                              events: chosen.events.filter((_, i) => i !== n),
                            })
                          }
                        >
                          删除此站
                        </button>
                        {n > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const events = [...chosen.events];
                              [events[n - 1], events[n]] = [
                                events[n],
                                events[n - 1],
                              ];
                              patch(chosen.id, { events });
                            }}
                          >
                            上移此站
                          </button>
                        )}
                      </fieldset>
                    ))}
                    <button
                      type="button"
                      disabled={chosen.events.length >= 20}
                      onClick={() =>
                        patch(chosen.id, {
                          events: [
                            ...chosen.events,
                            { date: "", title: "", text: "" },
                          ],
                        })
                      }
                    >
                      ＋一站
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    change((d) => {
                      d.items = d.items
                        .filter((i) => i.id !== chosen.id)
                        .map((i) =>
                          i.ref === chosen.id ? { ...i, ref: undefined } : i,
                        );
                    });
                    setSelected("");
                  }}
                >
                  删除物件
                </button>
                <p className="rich-privacy-note">
                  拖动移动；手柄缩放/旋转，Shift旋转吸附15°；双指捏合旋转；方向键移动（Shift加速），Escape取消选择。环绕物件自动避让。
                </p>
              </fieldset>
            )}
          </details>
          <details>
            <summary>信纸、火漆与信封外观</summary>
            <label>
              信纸颜色
              <input
                type="color"
                value={doc.style?.paper?.color || "#fff9ed"}
                onChange={(e) => stylePart("paper", { color: e.target.value })}
              />
            </label>
            <label>
              信纸纹理
              <select
                value={doc.style?.paper?.tex || "linen"}
                onChange={(e) =>
                  stylePart("paper", {
                    tex: e.target.value as
                      "linen" | "handmade" | "lined" | "plain",
                  })
                }
              >
                {["linen", "handmade", "lined", "plain"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              字体
              <select
                value={doc.paper.font}
                onChange={(e) =>
                  change((d) => {
                    d.paper.font = e.target
                      .value as RichDocument["paper"]["font"];
                  })
                }
              >
                <option value="serif">宋体</option>
                <option value="hand">系统楷体</option>
                <option value="sans">黑体</option>
              </select>
            </label>
            <label>
              字号
              <input
                type="range"
                min="14"
                max="26"
                value={doc.paper.size}
                onChange={(e) =>
                  change((d) => {
                    d.paper.size = Number(e.target.value);
                  })
                }
              />
            </label>
            <label>
              行距
              <input
                type="range"
                min="1.4"
                max="3"
                step=".1"
                value={doc.paper.lineHeight}
                onChange={(e) =>
                  change((d) => {
                    d.paper.lineHeight = Number(e.target.value);
                  })
                }
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={doc.paper.ruled}
                onChange={(e) =>
                  change((d) => {
                    d.paper.ruled = e.target.checked;
                  })
                }
              />
              横线
            </label>
            <label>
              火漆色
              <select
                value={doc.style?.seal?.color || "wine"}
                onChange={(e) =>
                  stylePart("seal", { color: e.target.value as "wine" })
                }
              >
                {["wine", "green", "navy", "gold", "black"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              火漆形状
              <select
                value={doc.style?.seal?.shape || "round"}
                onChange={(e) =>
                  stylePart("seal", {
                    shape: e.target.value as "round" | "drip",
                  })
                }
              >
                <option value="round">圆形</option>
                <option value="drip">流淌</option>
              </select>
            </label>
            <label>
              火漆光泽
              <input
                type="range"
                min="0"
                max="1"
                step=".05"
                value={doc.style?.seal?.gloss ?? 0.55}
                onChange={(e) =>
                  stylePart("seal", { gloss: Number(e.target.value) })
                }
              />
            </label>
            <label>
              印面文字
              <input
                maxLength={3}
                value={doc.style?.seal?.letter || ""}
                onChange={(e) =>
                  stylePart("seal", {
                    letter: e.target.value,
                    emblem: e.target.value ? "letter" : "rings",
                  })
                }
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={doc.style?.seal?.gilt !== false}
                onChange={(e) => stylePart("seal", { gilt: e.target.checked })}
              />
              鎏金印面
            </label>
            <label>
              自己的印面图片
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={busy || !mediaAvailable}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file)
                    void run(async () => {
                      const up = await upload(file);
                      stylePart("seal", { emblem: "image", image: up.src });
                    });
                  e.target.value = "";
                }}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={!!doc.style?.seal?.invert}
                onChange={(e) =>
                  stylePart("seal", { invert: e.target.checked })
                }
              />
              反转图片印面
            </label>
            <label>
              信封色
              <input
                type="color"
                value={doc.style?.envelope?.color || "#ece0cc"}
                onChange={(e) =>
                  stylePart("envelope", { color: e.target.value })
                }
              />
            </label>
            <label>
              信封材质
              <select
                value={doc.style?.envelope?.mat || "linen"}
                onChange={(e) =>
                  stylePart("envelope", { mat: e.target.value as "linen" })
                }
              >
                {["linen", "cotton", "kraft", "laid"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              内衬
              <select
                value={doc.style?.envelope?.liner || "lozenge"}
                onChange={(e) =>
                  stylePart("envelope", { liner: e.target.value as "lozenge" })
                }
              >
                {["lozenge", "damask", "stripe", "dots", "none"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              内衬色
              <select
                value={doc.style?.envelope?.linerColor || "wine"}
                onChange={(e) =>
                  stylePart("envelope", {
                    linerColor: e.target.value as "wine",
                  })
                }
              >
                {["wine", "green", "navy", "gold", "black"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </details>
          <details>
            <summary>背景音乐 · 播放列表</summary>
            {fileInput("music", "上传自己的配乐（最多20首）")}
            <label>
              播放方式
              <select
                value={doc.music.order}
                onChange={(e) =>
                  change((d) => {
                    d.music.order = e.target.value as "seq" | "shuffle";
                  })
                }
              >
                <option value="seq">顺序</option>
                <option value="shuffle">随机不连播同一首</option>
              </select>
            </label>
            {(
              [
                ["fi", "淡入秒", 0, 10],
                ["fo", "淡出秒", 0, 10],
                ["xf", "交叉淡化秒", 0, 10],
                ["vol", "总音量", 0, 1],
                ["dk", "语音/视频时背景音量", 0, 1],
              ] as const
            ).map(([k, label, min, max]) => (
              <label key={k}>
                {label}
                <input
                  type="number"
                  step=".1"
                  min={min}
                  max={max}
                  value={doc.music[k]}
                  onChange={(e) =>
                    change((d) => {
                      d.music[k] = Number(e.target.value);
                    })
                  }
                />
              </label>
            ))}
            {doc.music.tracks.map((t, n) => (
              <fieldset key={t.id}>
                <legend>第{n + 1}首</legend>
                <label>
                  标题
                  <input
                    value={t.title}
                    onChange={(e) =>
                      change((d) => {
                        d.music.tracks[n].title = e.target.value;
                      })
                    }
                  />
                </label>
                {(
                  [
                    ["cs", "开始秒", 0, 7200],
                    ["ce", "结束秒（0为曲终）", 0, 7200],
                    ["vol", "单曲音量", 0, 1],
                  ] as const
                ).map(([k, label, min, max]) => (
                  <label key={k}>
                    {label}
                    <input
                      type="number"
                      min={min}
                      max={max}
                      step=".1"
                      value={t[k]}
                      onChange={(e) =>
                        change((d) => {
                          d.music.tracks[n][k] = Number(e.target.value);
                        })
                      }
                    />
                  </label>
                ))}
                {n > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      change((d) => {
                        [d.music.tracks[n - 1], d.music.tracks[n]] = [
                          d.music.tracks[n],
                          d.music.tracks[n - 1],
                        ];
                      })
                    }
                  >
                    上移曲目
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    change((d) => {
                      d.music.tracks.splice(n, 1);
                    })
                  }
                >
                  删除曲目
                </button>
              </fieldset>
            ))}
            <p className="rich-privacy-note">
              在收信预览中试听。配乐不会自动播放，需拆封/点击；切到后台暂停，回到前台恢复。只用自己有权使用的文件，不嵌外部播放器。
            </p>
          </details>
        </aside>
        <section className="rich-canvas" aria-label="实时信纸预览">
          <RichPaper
            doc={doc}
            edit
            selected={selected}
            onSelect={setSelected}
            onPatch={(id, p) => patch(id, p, false)}
            onGestureStart={() => {
              past.current = [...past.current.slice(-49), current.current];
              setUndoCount(past.current.length);
            }}
            onDelete={(id) => {
              change((d) => {
                d.items = d.items
                  .filter((i) => i.id !== id)
                  .map((i) => (i.ref === id ? { ...i, ref: undefined } : i));
              });
              setSelected("");
            }}
            onParagraphEdit={(id, text) =>
              change((d) => {
                const p = d.paragraphs.find((p) => p.id === id);
                if (p) p.text = text;
              })
            }
          />
        </section>
      </div>
      <section className="rich-send rich-controls" inert={busy}>
        <h2>封好寄出</h2>
        <p>
          保持现有账号/公开邮寄号/通信关系与投递规则。信封上的昵称不会改变真实收信账号。
        </p>
        <label>
          投递方式
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="new">新朋友 · 邀请认领</option>
            <option value="contact">通信簿</option>
            <option value="public">公开邮寄号（须已通邮）</option>
          </select>
        </label>
        {mode === "contact" ? (
          <label>
            通信簿
            <select
              value={contactUserId}
              onChange={(e) => setContact(e.target.value)}
            >
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.publicId}
                </option>
              ))}
            </select>
          </label>
        ) : mode === "public" ? (
          <label>
            完整公开邮寄号
            <input
              value={recipientPublicId}
              onChange={(e) => setPublicId(e.target.value)}
            />
          </label>
        ) : (
          <>
            <label>
              对方称呼
              <input
                maxLength={40}
                value={recipientHintName}
                onChange={(e) => setRecipient(e.target.value)}
              />
            </label>
            <label>
              邀请口令（可选，不与信件内容一同传递）
              <input
                type="password"
                autoComplete="new-password"
                maxLength={128}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
              />
            </label>
            <label>
              认领有效期
              <select
                value={expiresInDays}
                onChange={(e) => setDays(Number(e.target.value))}
              >
                {[1, 3, 7, 14, 30].map((n) => (
                  <option value={n} key={n}>
                    {n}天
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <button
          type="button"
          disabled={busy || count < 1 || count > 800}
          onClick={() => void run(send)}
        >
          保存并寄出 · 寄出后不可更改
        </button>
      </section>
      {preview && (
        <div className="rich-preview">
          <button type="button" onClick={() => setPreview(false)}>
            退出收信预览（未自动保存）
          </button>
          <p>当前上海日期的收信效果；未来段落/附件已过滤，隐藏段需发现。</p>
          <RichReader
            preview
            document={visibleDocument(
              doc,
              formatISODate(new Date(), "Asia/Shanghai"),
            )}
          />
        </div>
      )}
    </main>
  );
}
export function NewRichDraft({
  to = "",
  mode = "",
}: {
  to?: string;
  mode?: string;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const draft = await request<MailDraft>("/api/mail-drafts", {
              method: "POST",
            });
            window.location.assign(
              appPath(
                `/app/write?draft=${draft.id}${to ? `&to=${encodeURIComponent(to)}` : ""}${mode ? `&mode=${encodeURIComponent(mode)}` : ""}`,
              ),
            );
          } catch (e) {
            setError(e instanceof Error ? e.message : "无法创建草稿");
            setBusy(false);
          }
        }}
      >
        新建一封信
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
