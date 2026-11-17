import { isISODate } from "../today";
import { cleanStyle, type Appearance } from "./appearance";
/** Typed, HTML-free adaptation of the source journal/editor data model. */
export const ITEM_TYPES = [
  "photo",
  "voice",
  "video",
  "sticker",
  "tape",
  "stamp",
  "ticket",
  "timeline",
  "easter",
  "ending",
  "hero",
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];
export type Paragraph = {
  id: string;
  text: string;
  hidden?: boolean;
  hv?: "speck" | "emboss" | "ink";
  unlockAt?: string;
};
export type JournalItem = {
  id: string;
  t: ItemType;
  pi: number;
  dy: number;
  x: number;
  w: number;
  r: number;
  z: number;
  mode: "wrap" | "break" | "over";
  ar: number;
  ref?: string;
  unlockAt?: string;
  src: string;
  poster: string;
  caption: string;
  text: string;
  sub: string;
  heading: string;
  message: string;
  k: string;
  events: { date: string; title: string; text: string }[];
};
export type MusicTrack = {
  id: string;
  title: string;
  src: string;
  cs: number;
  ce: number;
  vol: number;
};
export type Music = {
  order: "seq" | "shuffle";
  fi: number;
  fo: number;
  xf: number;
  vol: number;
  dk: number;
  tracks: MusicTrack[];
};
export type RichDocument = {
  v: 1;
  unlockAt?: string;
  /** Derived server read-view marker; never accepted from a save request. */
  lockedUntil?: string;
  style?: Appearance;
  title: string;
  to: string;
  from: string;
  postmark: string;
  dateline: string;
  salutation: string;
  signoff: string;
  paper: {
    theme: "cream" | "white" | "kraft";
    font: "serif" | "sans" | "hand";
    size: number;
    lineHeight: number;
    ruled: boolean;
  };
  paragraphs: Paragraph[];
  items: JournalItem[];
  music: Music;
};
export class RichLetterError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const rec = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new RichLetterError("信笺格式不正确");
  return v as Record<string, unknown>;
};
const text = (v: unknown, max = 800): string => {
  if (
    typeof v !== "string" ||
    Array.from(v).length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)
  )
    throw new RichLetterError("文字过长或格式不正确");
  return v;
};
const num = (v: unknown, min: number, max: number): number => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    throw new RichLetterError("排版数值超出范围");
  return v;
};
const choose = <T extends string>(v: unknown, values: readonly T[]): T => {
  if (!values.includes(v as T)) throw new RichLetterError("不支持的选项");
  return v as T;
};
export const validId = (v: string) => /^[a-zA-Z0-9_-]{1,80}$/.test(v);
const id = (v: unknown) => {
  const s = text(v, 80);
  if (!validId(s)) throw new RichLetterError("编号格式不正确");
  return s;
};
const date = (v: unknown): string | undefined => {
  if (v === undefined || v === "") return undefined;
  const s = text(v, 10);
  if (!isISODate(s)) throw new RichLetterError("日期无效");
  return s;
};
export const mediaId = (src: string) =>
  /^\/api\/mail-media\/([a-f0-9-]{36})$/.exec(src)?.[1];
const media = (v: unknown) => {
  const s = text(v, 120);
  if (s && !mediaId(s)) throw new RichLetterError("只能使用本信上传的媒体");
  return s;
};
export function parseRichDocument(v: unknown): RichDocument {
  const encoded = JSON.stringify(v);
  if (!encoded || encoded.length > 150000)
    throw new RichLetterError("信笺超过大小限制");
  const d = rec(v),
    p = rec(d.paper),
    m = rec(d.music);
  if (
    d.v !== 1 ||
    !Array.isArray(d.paragraphs) ||
    d.paragraphs.length < 1 ||
    d.paragraphs.length > 60 ||
    !Array.isArray(d.items) ||
    d.items.length > 80 ||
    !Array.isArray(m.tracks) ||
    m.tracks.length > 20
  )
    throw new RichLetterError("信笺条目数量不正确");
  const seen = new Set<string>();
  const unique = (v: unknown) => {
    const s = id(v);
    if (seen.has(s)) throw new RichLetterError("编号重复");
    seen.add(s);
    return s;
  };
  const doc: RichDocument = {
    v: 1,
    unlockAt: date(d.unlockAt),
    style: cleanStyle(d.style),
    title: text(d.title, 80),
    to: text(d.to, 40),
    from: text(d.from, 40),
    postmark: text(d.postmark, 80),
    dateline: text(d.dateline, 80),
    salutation: text(d.salutation, 80),
    signoff: text(d.signoff, 80),
    paper: {
      theme: choose(p.theme, ["cream", "white", "kraft"]),
      font: choose(p.font, ["serif", "sans", "hand"]),
      size: num(p.size, 14, 26),
      lineHeight: num(p.lineHeight, 1.4, 3),
      ruled: p.ruled === true,
    },
    paragraphs: d.paragraphs.map((v) => {
      const x = rec(v);
      return {
        id: unique(x.id),
        text: text(x.text),
        hidden: x.hidden === true,
        hv: choose(x.hv ?? "speck", ["speck", "emboss", "ink"] as const),
        unlockAt: date(x.unlockAt),
      };
    }),
    items: d.items.map((v) => {
      const x = rec(v);
      if (!Array.isArray(x.events) || x.events.length > 20)
        throw new RichLetterError("邮路条目过多");
      return {
        id: unique(x.id),
        t: choose(x.t, ITEM_TYPES),
        pi: Math.trunc(num(x.pi, 0, 59)),
        dy: num(x.dy, -6, 80),
        x: num(x.x, 0, 100),
        w: num(x.w, 4, 100),
        r: num(x.r, -180, 180),
        z: Math.trunc(num(x.z, 0, 60)),
        mode: choose(x.mode, ["wrap", "break", "over"]),
        ar: num(x.ar, 0.2, 5),
        ref: x.ref ? id(x.ref) : undefined,
        unlockAt: date(x.unlockAt),
        src: media(x.src),
        poster: media(x.poster),
        caption: text(x.caption, 120),
        text: text(x.text),
        sub: text(x.sub, 200),
        heading: text(x.heading, 80),
        message: text(x.message),
        k: choose(x.k, [
          "wine",
          "gold",
          "linen",
          "grid",
          "sage",
          "✉",
          "✦",
          "☘",
          "♡",
          "❀",
          "◌",
        ]),
        events: x.events.map((e) => {
          const q = rec(e);
          return {
            date: text(q.date, 80),
            title: text(q.title, 80),
            text: text(q.text),
          };
        }),
      };
    }),
    music: {
      order: choose(m.order, ["seq", "shuffle"]),
      fi: num(m.fi, 0, 10),
      fo: num(m.fo, 0, 10),
      xf: num(m.xf, 0, 10),
      vol: num(m.vol, 0, 1),
      dk: num(m.dk, 0, 1),
      tracks: m.tracks.map((v) => {
        const t = rec(v);
        const cs = num(t.cs, 0, 7200),
          ce = num(t.ce, 0, 7200);
        if (ce && ce <= cs)
          throw new RichLetterError("音乐结束时间必须大于开始时间");
        return {
          id: unique(t.id),
          title: text(t.title, 80),
          src: media(t.src),
          cs,
          ce,
          vol: num(t.vol, 0, 1),
        };
      }),
    },
  };
  for (const it of doc.items) {
    if (it.ref && !doc.items.some((x) => x.id === it.ref && x.id !== it.id))
      throw new RichLetterError("排版锚点不存在");
    if (["photo", "voice", "video"].includes(it.t) && !it.src)
      throw new RichLetterError("请为媒体物件选择文件");
  }
  return doc;
}
export function bodyText(d: RichDocument): string {
  return [
    ...d.paragraphs.map((p) => p.text),
    ...d.items.flatMap((i) => [
      i.heading,
      i.text,
      i.message,
      i.caption,
      i.sub,
      ...i.events.flatMap((e) => [e.date, e.title, e.text]),
    ]),
  ].join("");
}
export function visibleDocument(d: RichDocument, today: string): RichDocument {
  const result = structuredClone(d);
  delete result.lockedUntil;
  if (d.unlockAt && d.unlockAt > today) {
    result.lockedUntil = d.unlockAt;
    result.dateline = "";
    result.salutation = "";
    result.signoff = "";
    result.paragraphs = [
      { id: "locked", text: `这封信将于 ${d.unlockAt}（上海时区）展开。` },
    ];
    result.items = [];
    result.music.tracks = [];
    if (result.style?.seal) result.style.seal.image = "";
    return result;
  }
  result.paragraphs = result.paragraphs.map((p) =>
    p.unlockAt && p.unlockAt > today
      ? { id: p.id, text: `这段信纸将于 ${p.unlockAt} 展开。` }
      : p,
  );
  result.items = result.items.filter((i) => !i.unlockAt || i.unlockAt <= today);
  const ids = new Set(result.items.map((i) => i.id));
  result.items.forEach((i) => {
    if (i.ref && !ids.has(i.ref)) delete i.ref;
  });
  return result;
}
export function documentMedia(d: RichDocument): string[] {
  return [
    ...new Set(
      [
        d.style?.seal?.image || "",
        ...d.items.flatMap((i) => [i.src, i.poster]),
        ...d.music.tracks.map((t) => t.src),
      ]
        .map(mediaId)
        .filter((x): x is string => !!x),
    ),
  ];
}
export function blankDocument(name: string): RichDocument {
  return {
    v: 1,
    title: "一封信",
    to: "收信人",
    from: name,
    postmark: "纸短情长邮局",
    dateline: "",
    salutation: "见字如面：",
    signoff: name,
    paper: {
      theme: "cream",
      font: "serif",
      size: 18,
      lineHeight: 2,
      ruled: false,
    },
    paragraphs: [{ id: "p1", text: "", hv: "speck" }],
    items: [],
    music: {
      order: "seq",
      fi: 2.5,
      fo: 1.5,
      xf: 2,
      vol: 0.7,
      dk: 0.2,
      tracks: [],
    },
  };
}
export function blankItem(t: ItemType, id: string): JournalItem {
  return {
    id,
    t,
    pi: 0,
    dy: 1,
    x: 50,
    w: 32,
    r: 0,
    z: 1,
    mode: "wrap",
    ar: t === "voice" ? 2.6 : 1,
    src: "",
    poster: "",
    caption: "",
    text: "",
    sub: "",
    heading: "",
    message: "",
    k: t === "sticker" ? "✉" : "wine",
    events: [],
  };
}
