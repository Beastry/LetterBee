import type {
  Block,
  FilteredBlock,
  FilteredLetterBlock,
  FilteredPhotosBlock,
  FilteredTimelineBlock,
  LetterDocument,
  LetterView,
} from "./types";
import { isUnlockReached } from "./today";

function lockBlock(block: Block): FilteredBlock {
  return {
    id: block.id,
    type: block.type,
    locked: true,
    unlockAt: block.unlockAt ?? "",
  };
}

function filterLetter(block: Extract<Block, { type: "letter" }>, today: string): FilteredLetterBlock {
  return {
    id: block.id,
    type: "letter",
    dateline: block.dateline,
    salutation: block.salutation,
    signoff: block.signoff,
    unlockAt: block.unlockAt,
    paragraphs: block.paragraphs.map((paragraph) => {
      if (!isUnlockReached(paragraph.unlockAt, today)) {
        return { id: paragraph.id, locked: true, unlockAt: paragraph.unlockAt ?? "" };
      }

      return {
        id: paragraph.id,
        text: paragraph.text,
        hidden: paragraph.hidden || undefined,
      };
    }),
  };
}

function filterPhotos(block: Extract<Block, { type: "photos" }>, today: string): FilteredPhotosBlock {
  return {
    id: block.id,
    type: "photos",
    title: block.title,
    unlockAt: block.unlockAt,
    items: block.items.map((item) => {
      if (!isUnlockReached(item.unlockAt, today)) {
        return { id: item.id, locked: true, unlockAt: item.unlockAt ?? "" };
      }

      return {
        id: item.id,
        src: item.src,
        alt: item.alt,
        caption: item.caption,
      };
    }),
  };
}

function filterTimeline(
  block: Extract<Block, { type: "timeline" }>,
  today: string,
): FilteredTimelineBlock {
  return {
    id: block.id,
    type: "timeline",
    title: block.title,
    unlockAt: block.unlockAt,
    events: block.events.map((event) => {
      if (!isUnlockReached(event.unlockAt, today)) {
        return { id: event.id, locked: true, unlockAt: event.unlockAt ?? "" };
      }

      return {
        id: event.id,
        dateLabel: event.dateLabel,
        title: event.title,
        body: event.body,
      };
    }),
  };
}

export function filterBlock(block: Block, today: string): FilteredBlock {
  if (!isUnlockReached(block.unlockAt, today)) {
    return lockBlock(block);
  }

  switch (block.type) {
    case "letter":
      return filterLetter(block, today);
    case "photos":
      return filterPhotos(block, today);
    case "timeline":
      return filterTimeline(block, today);
    case "hero":
    case "voice":
    case "video":
    case "ending":
    case "easter":
      return { ...block };
    default: {
      const unreachable: never = block;
      return unreachable;
    }
  }
}

export function toLetterView(document: LetterDocument, today: string): LetterView {
  return {
    slug: document.slug,
    title: document.title,
    timezone: document.timezone,
    envelope: { ...document.envelope },
    bgm: {
      mode: document.bgm.mode,
      crossfadeMs: document.bgm.crossfadeMs,
      tracks: document.bgm.tracks.map((track) => ({ ...track })),
    },
    blocks: document.blocks.map((block) => filterBlock(block, today)),
  };
}

export function viewContainsText(view: LetterView, needle: string): boolean {
  return JSON.stringify(view).includes(needle);
}
