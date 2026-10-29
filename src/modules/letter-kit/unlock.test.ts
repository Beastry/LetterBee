import { describe, expect, it } from "vitest";
import type { LetterDocument } from "./types";
import { formatISODate, isUnlockReached } from "./today";
import { toLetterView, viewContainsText } from "./unlock";

const CANARY = "后记正文不应出现在未到期的页面里";
const NESTED_CANARY = "未到期的邮路节点不应出现在页面里";
const VISIBLE = "这封信故意走得慢";

function sampleDocument(): LetterDocument {
  return {
    slug: "sample",
    title: "南窗来信",
    timezone: "Asia/Shanghai",
    envelope: { to: "收信人", from: "南窗", postmark: "本地邮局" },
    gate: {
      hint: "提示",
      dials: 4,
      charset: "0123456789",
      passphraseHash: "scrypt$salt$key",
    },
    bgm: { mode: "sequence", crossfadeMs: 1200, tracks: [] },
    blocks: [
      {
        id: "hero",
        type: "hero",
        kicker: "慢递",
        title: "南窗来信",
        subtitle: "样例",
      },
      {
        id: "letter",
        type: "letter",
        unlockAt: "2020-01-01",
        dateline: "样例",
        salutation: "你见字：",
        signoff: "南窗",
        paragraphs: [
          { id: "p1", text: VISIBLE },
          { id: "p-hidden", text: "折在纸背", hidden: true },
          { id: "p-future", text: "这段还没到", unlockAt: "2027-03-01" },
        ],
      },
      {
        id: "later",
        type: "letter",
        unlockAt: "2027-03-01",
        dateline: "后记",
        salutation: "又及：",
        signoff: "南窗",
        paragraphs: [{ id: "later-p", text: CANARY }],
      },
      {
        id: "road",
        type: "timeline",
        title: "邮路",
        events: [
          { id: "e1", dateLabel: "2026-10-29", title: "可以拆", body: "今天能读" },
          {
            id: "e2",
            dateLabel: "2027-03-01",
            title: "后记",
            body: NESTED_CANARY,
            unlockAt: "2027-03-01",
          },
        ],
      },
      {
        id: "voice",
        type: "voice",
        title: "折纸",
        caption: "样例",
        src: "/letter-media/sample/paper.wav",
        unlockAt: "2026-10-29",
      },
    ],
  };
}

describe("isUnlockReached", () => {
  it("treats the unlock date itself as open", () => {
    expect(isUnlockReached("2026-10-29", "2026-10-29")).toBe(true);
    expect(isUnlockReached("2026-10-30", "2026-10-29")).toBe(false);
    expect(isUnlockReached(undefined, "2026-10-29")).toBe(true);
  });

  it("keeps malformed dates closed", () => {
    expect(isUnlockReached("2026-02-31", "2026-10-29")).toBe(false);
    expect(isUnlockReached("tomorrow", "2026-10-29")).toBe(false);
  });
});

describe("formatISODate", () => {
  it("uses the letter timezone rather than UTC", () => {
    expect(formatISODate(new Date("2026-10-29T16:30:00Z"), "Asia/Shanghai")).toBe("2026-10-30");
    expect(formatISODate(new Date("2026-10-29T02:00:00Z"), "Asia/Shanghai")).toBe("2026-10-29");
  });
});

describe("toLetterView", () => {
  const today = "2026-10-29";

  it("strips future block bodies and nested copy", () => {
    const view = toLetterView(sampleDocument(), today);
    const serialized = JSON.stringify(view);

    expect(serialized).not.toContain(CANARY);
    expect(serialized).not.toContain(NESTED_CANARY);
    expect(serialized).not.toContain("这段还没到");
    expect(serialized).not.toContain("passphraseHash");
    expect(viewContainsText(view, VISIBLE)).toBe(true);
    expect(viewContainsText(view, "折在纸背")).toBe(true);
  });

  it("keeps a locked stub with a date and no prose", () => {
    const view = toLetterView(sampleDocument(), today);
    const later = view.blocks.find((block) => block.id === "later");

    expect(later).toEqual({
      id: "later",
      type: "letter",
      locked: true,
      unlockAt: "2027-03-01",
    });
  });

  it("opens the same block once the date arrives", () => {
    const view = toLetterView(sampleDocument(), "2027-03-01");

    expect(viewContainsText(view, CANARY)).toBe(true);
    expect(viewContainsText(view, NESTED_CANARY)).toBe(true);
  });

  it("does not mutate the source document", () => {
    const document = sampleDocument();
    toLetterView(document, today);

    expect(document.blocks[2]).toMatchObject({
      type: "letter",
      paragraphs: [{ text: CANARY }],
    });
  });
});
