import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { LetterDocument } from "./types";
import {
  LetterValidationError,
  MAX_MEDIA_BYTES,
  MEDIA_BASE_PATH,
  extensionForMime,
  isValidSlug,
  parseLetterDocument,
  sniffMedia,
} from "./validate";

export function letterDataDir(): string {
  return process.env.LETTER_DATA_DIR || path.join(process.cwd(), "data", "letters");
}

export function letterMediaDir(): string {
  return process.env.LETTER_MEDIA_DIR || path.join(process.cwd(), "public", "letter-media");
}

export function letterMediaBase(): string {
  return process.env.LETTER_MEDIA_BASE || MEDIA_BASE_PATH;
}

function assertInside(root: string, target: string): void {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  if (
    resolvedTarget !== resolvedRoot &&
    !resolvedTarget.startsWith(resolvedRoot + path.sep)
  ) {
    throw new LetterValidationError("路径越界");
  }
}

export function letterFilePath(slug: string): string {
  if (!isValidSlug(slug)) {
    throw new LetterValidationError("信笺编号无效");
  }

  const file = path.join(letterDataDir(), `${slug}.json`);
  assertInside(letterDataDir(), file);
  return file;
}

export async function readLetter(slug: string): Promise<LetterDocument | null> {
  let raw: string;

  try {
    raw = await readFile(letterFilePath(slug), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }

  return parseLetterDocument(JSON.parse(raw) as unknown, slug);
}

export async function writeLetter(document: LetterDocument): Promise<void> {
  const parsed = parseLetterDocument(document, document.slug);
  const file = letterFilePath(parsed.slug);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
}

export async function saveLetterMedia({
  slug,
  bytes,
  mime,
}: {
  slug: string;
  bytes: Uint8Array;
  mime: string;
}): Promise<{ url: string }> {
  if (!isValidSlug(slug)) {
    throw new LetterValidationError("信笺编号无效");
  }

  if (bytes.byteLength === 0 || bytes.byteLength > MAX_MEDIA_BYTES) {
    throw new LetterValidationError("文件为空或超过 8MB");
  }

  const extension = extensionForMime(mime);

  if (!extension || !sniffMedia(bytes, mime)) {
    throw new LetterValidationError("只接受图片、音频或视频原件");
  }

  const filename = `${randomUUID()}${extension}`;
  const directory = path.join(letterMediaDir(), slug, "uploads");
  const file = path.join(directory, filename);
  assertInside(letterMediaDir(), file);
  await mkdir(directory, { recursive: true });
  await writeFile(file, bytes);

  return { url: `${letterMediaBase()}/${slug}/uploads/${filename}` };
}
