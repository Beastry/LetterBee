import type { Block, BlockType, LetterParagraph, PhotoItem, TimelineEvent } from "./types";

export function createId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${prefix}-${random.slice(0, 8)}`;
}

export function createParagraph(): LetterParagraph {
  return { id: createId("p"), text: "待写的一段。" };
}

export function createPhoto(): PhotoItem {
  return { id: createId("photo"), src: "", alt: "照片", caption: "" };
}

export function createEvent(): TimelineEvent {
  return { id: createId("stop"), dateLabel: "某日", title: "新的一站", body: "待写。" };
}

export function createBlock(type: BlockType): Block {
  const id = createId(type);

  switch (type) {
    case "hero":
      return { id, type, kicker: "慢递", title: "新的一页", subtitle: "待写" };
    case "letter":
      return {
        id,
        type,
        dateline: "本地邮局",
        salutation: "你见字：",
        signoff: "寄信人",
        paragraphs: [createParagraph()],
      };
    case "photos":
      return { id, type, title: "附上的照片", items: [createPhoto()] };
    case "voice":
      return { id, type, title: "夹带的声音", caption: "", src: "" };
    case "video":
      return { id, type, title: "一段影像", caption: "", src: "", poster: "" };
    case "timeline":
      return { id, type, title: "邮路", events: [createEvent()] };
    case "ending":
      return { id, type, title: "写到这里", text: "待写。" };
    case "easter":
      return { id, type, hint: "这里有一处浅印", text: "待写。" };
    default: {
      const unreachable: never = type;
      return unreachable;
    }
  }
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items;
  }

  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}
