import { BLOCK_TYPES, type Block, type BlockType, type LetterDocument } from "./types";

export const MEDIA_BASE_PATH = "/letter-media";
export const MAX_MEDIA_BYTES = 8 * 1024 * 1024;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MIME_EXTENSION: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/mpeg": ".mp3",
  "audio/mp4": ".m4a",
  "audio/webm": ".weba",
  "audio/ogg": ".ogg",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
};

export class LetterValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LetterValidationError";
  }
}

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && slug.length <= 64;
}

export function isSafeMediaSrc(src: string, mediaBase = MEDIA_BASE_PATH): boolean {
  if (!src) {
    return true;
  }

  if (!src.startsWith(`${mediaBase}/`) || src.includes("..") || src.includes("\\")) {
    return false;
  }

  return true;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new LetterValidationError(`${label}格式不对`);
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown, label: string, max: number, required = true): string {
  if (typeof value !== "string") {
    throw new LetterValidationError(`${label}需要是文字`);
  }

  const trimmed = value.trim();

  if (required && !trimmed) {
    throw new LetterValidationError(`${label}不能为空`);
  }

  if (trimmed.length > max) {
    throw new LetterValidationError(`${label}太长`);
  }

  return trimmed;
}

function optionalDate(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const date = asString(value, label, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new LetterValidationError(`${label}要写成 YYYY-MM-DD`);
  }

  return date;
}

function asId(value: unknown, label: string): string {
  const id = asString(value, label, 80);
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new LetterValidationError(`${label}含有不能使用的字符`);
  }
  return id;
}

function mediaSrc(value: unknown, label: string, required = true): string {
  const src = asString(value, label, 240, required);
  if (!isSafeMediaSrc(src)) {
    throw new LetterValidationError(`${label}必须放在本地媒体目录里`);
  }
  return src;
}

function parseBlock(value: unknown, index: number): Block {
  const record = asRecord(value, `第 ${index + 1} 个区块`);
  const type = asString(record.type, "区块类型", 20);

  if (!BLOCK_TYPES.includes(type as BlockType)) {
    throw new LetterValidationError(`不认识的区块类型：${type}`);
  }

  const id = asId(record.id, "区块编号");
  const unlockAt = optionalDate(record.unlockAt, "启封日");
  const base = { id, unlockAt };

  switch (type) {
    case "hero":
      return {
        ...base,
        type,
        kicker: asString(record.kicker, "扉页眉题", 40),
        title: asString(record.title, "扉页标题", 80),
        subtitle: asString(record.subtitle, "扉页副题", 200),
      };
    case "letter": {
      const paragraphs = Array.isArray(record.paragraphs) ? record.paragraphs : null;
      if (!paragraphs || paragraphs.length === 0 || paragraphs.length > 40) {
        throw new LetterValidationError("信纸至少要有一段，且不能超过 40 段");
      }

      return {
        ...base,
        type,
        dateline: asString(record.dateline, "信头日期", 80),
        salutation: asString(record.salutation, "称呼", 80),
        signoff: asString(record.signoff, "署名", 80),
        paragraphs: paragraphs.map((paragraph, paragraphIndex) => {
          const item = asRecord(paragraph, `第 ${paragraphIndex + 1} 段`);
          return {
            id: asId(item.id, "段落编号"),
            text: asString(item.text, "段落", 2000),
            hidden: item.hidden === true ? true : undefined,
            unlockAt: optionalDate(item.unlockAt, "段落启封日"),
          };
        }),
      };
    }
    case "photos": {
      const items = Array.isArray(record.items) ? record.items : null;
      if (!items || items.length > 24) {
        throw new LetterValidationError("照片区块不能超过 24 张");
      }

      return {
        ...base,
        type,
        title: asString(record.title, "照片标题", 80),
        items: items.map((item, itemIndex) => {
          const photo = asRecord(item, `第 ${itemIndex + 1} 张照片`);
          return {
            id: asId(photo.id, "照片编号"),
            src: mediaSrc(photo.src, "照片", false),
            alt: asString(photo.alt, "照片替代文字", 120),
            caption: asString(photo.caption, "照片说明", 160, false),
            unlockAt: optionalDate(photo.unlockAt, "照片启封日"),
          };
        }),
      };
    }
    case "voice":
      return {
        ...base,
        type,
        title: asString(record.title, "声音标题", 80),
        caption: asString(record.caption, "声音说明", 200, false),
        src: mediaSrc(record.src, "声音", false),
      };
    case "video":
      return {
        ...base,
        type,
        title: asString(record.title, "影像标题", 80),
        caption: asString(record.caption, "影像说明", 200, false),
        src: mediaSrc(record.src, "影像", false),
        poster: mediaSrc(record.poster, "影像封面", false),
      };
    case "timeline": {
      const events = Array.isArray(record.events) ? record.events : null;
      if (!events || events.length === 0 || events.length > 40) {
        throw new LetterValidationError("邮路至少要有一站，且不能超过 40 站");
      }

      return {
        ...base,
        type,
        title: asString(record.title, "邮路标题", 80),
        events: events.map((event, eventIndex) => {
          const item = asRecord(event, `第 ${eventIndex + 1} 站`);
          return {
            id: asId(item.id, "邮路编号"),
            dateLabel: asString(item.dateLabel, "邮路日期", 40),
            title: asString(item.title, "邮路标题", 80),
            body: asString(item.body, "邮路正文", 500),
            unlockAt: optionalDate(item.unlockAt, "邮路启封日"),
          };
        }),
      };
    }
    case "ending":
      return {
        ...base,
        type,
        title: asString(record.title, "结尾标题", 80),
        text: asString(record.text, "结尾", 1000),
      };
    case "easter":
      return {
        ...base,
        type,
        hint: asString(record.hint, "暗记提示", 80),
        text: asString(record.text, "暗记", 500),
      };
    default:
      throw new LetterValidationError(`不认识的区块类型：${type}`);
  }
}

export function parseLetterDocument(value: unknown, expectedSlug?: string): LetterDocument {
  const record = asRecord(value, "信笺");
  const timezone = asString(record.timezone, "时区", 64);

  try {
    Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    throw new LetterValidationError("时区不存在");
  }

  const slug = asString(record.slug, "信笺编号", 64);

  if (!isValidSlug(slug)) {
    throw new LetterValidationError("信笺编号只能用小写字母、数字和短横线");
  }

  if (expectedSlug && slug !== expectedSlug) {
    throw new LetterValidationError("信笺编号与地址不一致");
  }

  if ("passphrase" in record || "password" in record) {
    throw new LetterValidationError("不要把口令明文写进信笺");
  }

  const envelope = asRecord(record.envelope, "信封");
  const gate = asRecord(record.gate, "门禁");

  if ("passphrase" in gate || "password" in gate) {
    throw new LetterValidationError("不要把口令明文写进信笺");
  }
  const bgm = asRecord(record.bgm, "歌单");
  const blocks = Array.isArray(record.blocks) ? record.blocks : null;

  if (!blocks || blocks.length === 0 || blocks.length > 30) {
    throw new LetterValidationError("一封信需要 1 到 30 个区块");
  }

  const dials = gate.dials;
  const charset = asString(gate.charset, "口令字符表", 36);

  if (typeof dials !== "number" || !Number.isInteger(dials) || dials < 1 || dials > 8) {
    throw new LetterValidationError("口令盘位数需要在 1 到 8 之间");
  }

  if (new Set(charset).size !== charset.length || /\s/.test(charset)) {
    throw new LetterValidationError("口令字符表不能有空格或重复字符");
  }

  const mode = bgm.mode === "shuffle" ? "shuffle" : bgm.mode === "sequence" ? "sequence" : null;
  const crossfadeMs = bgm.crossfadeMs;

  if (!mode) {
    throw new LetterValidationError("歌单只能顺序或随机");
  }

  if (
    typeof crossfadeMs !== "number" ||
    !Number.isInteger(crossfadeMs) ||
    crossfadeMs < 200 ||
    crossfadeMs > 5000
  ) {
    throw new LetterValidationError("交叉淡化需要在 200 到 5000 毫秒之间");
  }

  const tracks = Array.isArray(bgm.tracks) ? bgm.tracks : null;

  if (!tracks || tracks.length > 10) {
    throw new LetterValidationError("歌单最多 10 首");
  }

  return {
    slug,
    title: asString(record.title, "标题", 80),
    timezone,
    envelope: {
      to: asString(envelope.to, "收信人", 40),
      from: asString(envelope.from, "寄信人", 40),
      postmark: asString(envelope.postmark, "邮戳", 40),
    },
    gate: {
      hint: asString(gate.hint, "口令提示", 200),
      dials,
      charset,
      passphraseHash: asString(gate.passphraseHash, "口令哈希", 240),
    },
    bgm: {
      mode,
      crossfadeMs,
      tracks: tracks.map((track, index) => {
        const item = asRecord(track, `第 ${index + 1} 首`);
        return {
          id: asId(item.id, "曲目编号"),
          title: asString(item.title, "曲名", 80),
          src: mediaSrc(item.src, "曲目", false),
        };
      }),
    },
    blocks: blocks.map(parseBlock),
  };
}

export function assertPassphraseMatchesDial(
  passphrase: string,
  dials: number,
  charset: string,
): string {
  const normalized = passphrase.normalize("NFKC").trim();

  if (normalized.length !== dials) {
    throw new LetterValidationError("新口令的长度要和口令盘位数一致");
  }

  if ([...normalized].some((character) => !charset.includes(character))) {
    throw new LetterValidationError("新口令含有口令盘里没有的字符");
  }

  return normalized;
}

export function extensionForMime(mime: string): string | null {
  return MIME_EXTENSION[mime] ?? null;
}

export function sniffMedia(bytes: Uint8Array, mime: string): boolean {
  const starts = (...codes: number[]) => codes.every((code, index) => bytes[index] === code);
  const ascii = (start: number, text: string) =>
    Buffer.from(bytes.subarray(start, start + text.length)).toString("ascii") === text;

  switch (mime) {
    case "image/png":
      return starts(0x89, 0x50, 0x4e, 0x47);
    case "image/jpeg":
      return starts(0xff, 0xd8, 0xff);
    case "image/gif":
      return ascii(0, "GIF8");
    case "image/webp":
      return ascii(0, "RIFF") && ascii(8, "WEBP");
    case "audio/wav":
    case "audio/x-wav":
      return ascii(0, "RIFF") && ascii(8, "WAVE");
    case "audio/mpeg":
      return ascii(0, "ID3") || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
    case "audio/ogg":
      return ascii(0, "OggS");
    case "audio/webm":
    case "video/webm":
      return starts(0x1a, 0x45, 0xdf, 0xa3);
    case "audio/mp4":
    case "video/mp4":
      return ascii(4, "ftyp");
    default:
      return false;
  }
}
