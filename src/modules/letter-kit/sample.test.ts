import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { verifyPassphrase } from "./gate";
import { toLetterView, viewContainsText } from "./unlock";
import { parseLetterDocument } from "./validate";

const SAMPLE_PASSPHRASE = "7041";
const FORBIDDEN = ["戒指", "天蝎", "蜡烛", "蛋糕", "生日快乐", "scorpio"];

describe("sample letter fixture", () => {
  const file = path.join(process.cwd(), "data", "letters", "sample.json");
  const raw = readFileSync(file, "utf8");
  const document = parseLetterDocument(JSON.parse(raw), "sample");

  it("keeps the demo passphrase out of the file and stores only a hash", () => {
    expect(raw).not.toContain(SAMPLE_PASSPHRASE);
    expect(raw).not.toContain("\"passphrase\"");
    expect(verifyPassphrase(SAMPLE_PASSPHRASE, document.gate.passphraseHash)).toBe(true);
    expect(verifyPassphrase("0000", document.gate.passphraseHash)).toBe(false);
  });

  it("does not carry private-letter wording", () => {
    for (const word of FORBIDDEN) {
      expect(raw.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });

  it("filters unopened copy for a day before the postscript", () => {
    const view = toLetterView(document, "2026-10-29");

    expect(viewContainsText(view, "这封信故意走得慢")).toBe(true);
    expect(viewContainsText(view, "折在纸背的那句是：重要的话值得等一等。")).toBe(true);
    expect(JSON.stringify(view)).not.toContain("后记正文不应出现在未到期的页面里");
    expect(JSON.stringify(view)).not.toContain("未到期的邮路节点不应出现在页面里");
    expect(JSON.stringify(view)).not.toContain("嵌在未到期信纸里的句子");
    expect(view.blocks.some((block) => "locked" in block && block.locked)).toBe(true);
  });

  it("releases the postscript on its unlock date", () => {
    const view = toLetterView(document, "2099-01-01");

    expect(viewContainsText(view, "后记正文不应出现在未到期的页面里")).toBe(true);
    expect(viewContainsText(view, "未到期的邮路节点不应出现在页面里")).toBe(true);
    expect(viewContainsText(view, "嵌在未到期信纸里的句子")).toBe(true);
  });
});
