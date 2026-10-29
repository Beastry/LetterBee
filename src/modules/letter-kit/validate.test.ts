import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { hashPassphrase } from "./gate";
import { readLetter, saveLetterMedia, writeLetter } from "./storage";
import type { LetterDocument } from "./types";
import {
  LetterValidationError,
  assertPassphraseMatchesDial,
  isSafeMediaSrc,
  parseLetterDocument,
  sniffMedia,
} from "./validate";

const originalDataDir = process.env.LETTER_DATA_DIR;
const originalMediaDir = process.env.LETTER_MEDIA_DIR;
const originalMediaBase = process.env.LETTER_MEDIA_BASE;

afterEach(() => {
  if (originalDataDir === undefined) {
    delete process.env.LETTER_DATA_DIR;
  } else {
    process.env.LETTER_DATA_DIR = originalDataDir;
  }

  if (originalMediaDir === undefined) {
    delete process.env.LETTER_MEDIA_DIR;
  } else {
    process.env.LETTER_MEDIA_DIR = originalMediaDir;
  }

  if (originalMediaBase === undefined) {
    delete process.env.LETTER_MEDIA_BASE;
  } else {
    process.env.LETTER_MEDIA_BASE = originalMediaBase;
  }
});

function document(overrides: Partial<LetterDocument> = {}): LetterDocument {
  return {
    slug: "sample",
    title: "南窗来信",
    timezone: "Asia/Shanghai",
    envelope: { to: "收信人", from: "南窗", postmark: "本地邮局" },
    gate: {
      hint: "看文档",
      dials: 4,
      charset: "0123456789",
      passphraseHash: "scrypt$abc$def",
    },
    bgm: {
      mode: "sequence",
      crossfadeMs: 1200,
      tracks: [{ id: "track", title: "窗边", src: "/letter-media/sample/window.wav" }],
    },
    blocks: [
      {
        id: "hero",
        type: "hero",
        kicker: "慢递",
        title: "南窗来信",
        subtitle: "样例",
      },
    ],
    ...overrides,
  };
}

describe("parseLetterDocument", () => {
  it("drops unknown fields and rejects a plaintext passphrase", () => {
    const parsed = parseLetterDocument({
      ...document(),
      extra: "nope",
      envelope: { ...document().envelope, street: "不该留下" },
    });

    expect(parsed.envelope).toEqual(document().envelope);
    expect("extra" in parsed).toBe(false);
    expect(() =>
      parseLetterDocument({ ...document(), passphrase: "7041" }),
    ).toThrow(LetterValidationError);
  });

  it("rejects media paths outside the local media directory", () => {
    expect(isSafeMediaSrc("/letter-media/sample/a.png")).toBe(true);
    expect(isSafeMediaSrc("../secret.json")).toBe(false);
    expect(isSafeMediaSrc("https://example.com/a.png")).toBe(false);

    expect(() =>
      parseLetterDocument(
        document({
          bgm: {
            mode: "sequence",
            crossfadeMs: 1200,
            tracks: [{ id: "track", title: "外链", src: "https://example.com/a.mp3" }],
          },
        }),
      ),
    ).toThrow(/本地媒体目录/);
  });

  it("checks a replacement passphrase against the dial", () => {
    expect(assertPassphraseMatchesDial("7041", 4, "0123456789")).toBe("7041");
    expect(() => assertPassphraseMatchesDial("704", 4, "0123456789")).toThrow(
      LetterValidationError,
    );
    expect(() => assertPassphraseMatchesDial("70ab", 4, "0123456789")).toThrow(
      LetterValidationError,
    );
  });
});

describe("sniffMedia", () => {
  it("recognises a wav header and rejects html renamed as audio", () => {
    const wav = Buffer.from("RIFF....WAVEfmt ");
    const html = Buffer.from("<html></html>");

    expect(sniffMedia(wav, "audio/wav")).toBe(true);
    expect(sniffMedia(html, "audio/wav")).toBe(false);
    expect(sniffMedia(wav, "image/svg+xml")).toBe(false);
  });
});

describe("letter storage", () => {
  it("round-trips a document without writing the passphrase", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "zqc-letter-"));
    process.env.LETTER_DATA_DIR = path.join(root, "letters");
    process.env.LETTER_MEDIA_DIR = path.join(root, "media");
    process.env.LETTER_MEDIA_BASE = "/letter-media";

    const passphraseHash = hashPassphrase("7041");
    await writeLetter(document({ gate: { ...document().gate, passphraseHash } }));

    const raw = await readFile(path.join(root, "letters", "sample.json"), "utf8");
    const loaded = await readLetter("sample");

    expect(raw).not.toContain("7041");
    expect(loaded?.gate.passphraseHash).toBe(passphraseHash);
    expect(loaded?.title).toBe("南窗来信");
  });

  it("stores an uploaded wav under the slug uploads directory", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "zqc-media-"));
    process.env.LETTER_MEDIA_DIR = root;
    process.env.LETTER_MEDIA_BASE = "/letter-media";

    const bytes = Buffer.concat([
      Buffer.from("RIFF"),
      Buffer.alloc(4),
      Buffer.from("WAVEfmt "),
      Buffer.alloc(8),
    ]);
    const saved = await saveLetterMedia({
      slug: "sample",
      bytes,
      mime: "audio/wav",
    });

    expect(saved.url).toMatch(/^\/letter-media\/sample\/uploads\/[0-9a-f-]+\.wav$/);
    await expect(saveLetterMedia({ slug: "sample", bytes: Buffer.from("<html>"), mime: "audio/wav" })).rejects.toThrow(
      LetterValidationError,
    );
  });
});
