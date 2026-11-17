"use client";
import "../ui/letter-kit.css";
import type { RichDocument } from "./model";
import { LetterExperience } from "../ui/LetterExperience";
import { RichPaper } from "./RichPaper";
import type { LetterView } from "../types";
export function RichReader({
  document,
  preview = false,
}: {
  document: RichDocument;
  preview?: boolean;
}) {
  const view: LetterView = {
    slug: "mail",
    title: document.title,
    timezone: "Asia/Shanghai",
    envelope: {
      to: document.to,
      from: document.from,
      postmark: document.postmark,
    },
    bgm: {
      mode: document.music.order === "shuffle" ? "shuffle" : "sequence",
      crossfadeMs: document.music.xf * 1000,
      tracks: [],
    },
    blocks: [],
  };
  return (
    <LetterExperience
      view={view}
      preview={preview}
      music={document.music}
      style={document.style}
      lockedUntil={document.lockedUntil}
      reading={(duck) => <RichPaper doc={document} duck={duck} />}
    />
  );
}
