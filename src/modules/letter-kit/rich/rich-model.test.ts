import { expect, it } from "vitest";
import {
  blankDocument,
  blankItem,
  parseRichDocument,
  visibleDocument,
} from "./model";
import { createJournalLayout } from "./layout";
import { cleanStyle, appearance } from "./appearance";
const jl = createJournalLayout();
it("富信笺只保留白名单纯文本，拒绝路径穿越/外站媒体/无效日期和音乐区间", () => {
  const d = blankDocument("寄信人");
  expect(parseRichDocument({ ...d, unknown: "not copied" })).not.toHaveProperty(
    "unknown",
  );
  d.paragraphs[0].unlockAt = "2026-02-30";
  expect(() => parseRichDocument(d)).toThrow("日期");
  delete d.paragraphs[0].unlockAt;
  d.items = [
    { ...blankItem("photo", "photo1"), src: "/api/mail-media/../../private" },
  ];
  expect(() => parseRichDocument(d)).toThrow("只能使用");
  d.items = [];
  d.music.tracks = [
    {
      id: "track1",
      title: "中性",
      src: "/api/mail-media/00000000-0000-4000-8000-000000000000",
      cs: 10,
      ce: 5,
      vol: 1,
    },
  ];
  expect(() => parseRichDocument(d)).toThrow("结束时间");
  d.music.tracks = [];
  d.paragraphs[0].text = "<b>保持纯文字</b>";
  expect(parseRichDocument(d).paragraphs[0].text).toContain("<b>");
});
it("定时物件在服务端删去而不是仅CSS隐藏，并去掉对锁定物件的引用", () => {
  const d = blankDocument("甲");
  d.items = [
    {
      ...blankItem("easter", "hidden1"),
      unlockAt: "2099-01-01",
      message: "未来小纸条",
    },
    { ...blankItem("ticket", "visible1"), ref: "hidden1", text: "当下" },
  ];
  const view = visibleDocument(d, "2026-11-17");
  expect(JSON.stringify(view)).not.toContain("未来小纸条");
  expect(view.items).toHaveLength(1);
  expect(view.items[0].ref).toBeUndefined();
});
it("源引擎：CJK标点禁则、环绕/独占/覆盖、旋转碰撞和前向锚点循环都能终止", () => {
  const measure = (s: string) => Array.from(s).length * 18;
  expect(jl.breakText("你好，世界", 36, measure).text).not.toBe("你好");
  for (const mode of ["wrap", "break", "over"] as const) {
    const item = {
      ...blankItem("photo", "one"),
      src: "",
      x: 20,
      w: 30,
      dy: 0,
      r: 12,
      mode,
    };
    const result = jl.layout(
      [{ text: "一段中性的书信文字。".repeat(5) }],
      [item],
      { W: 360, L: 36 },
      measure,
    );
    expect(Number.isFinite(result.height)).toBe(true);
    expect(result.items).toHaveLength(1);
    if (mode !== "over")
      for (const line of result.lines)
        for (const seg of line.segs) {
          const box = result.items[0];
          if (line.y + 36 > box.by && line.y < box.by + box.bh)
            expect(
              seg.x + measure(seg.text) <= box.bx || seg.x >= box.bx + box.bw,
            ).toBe(true);
        }
  }
  const a = { ...blankItem("ticket", "a"), ref: "b", x: 0, w: 30 },
    b = { ...blankItem("ticket", "b"), ref: "a", x: 0, w: 30 };
  expect(
    jl.layout([{ text: "中性正文" }], [a, b], { W: 360, L: 36 }, measure).items,
  ).toHaveLength(2);
  const box = {
    id: "a",
    x: 0,
    y: 0,
    w: 100,
    h: 60,
    r: 0,
    bx: 0,
    by: 0,
    bw: 100,
    bh: 60,
  };
  expect(jl.rotatedIntersects(box, { ...box, x: 20 })).toBe(true);
  expect(jl.rotatedIntersects(box, { ...box, x: 150 })).toBe(false);
});
it("迁移封缄只用程序纹理；外站印面和任意CSS值会清洗掉", () => {
  const style = cleanStyle({
    seal: {
      emblem: "image",
      image: "https://private-source.example/image.png",
    },
    paper: { color: "url(javascript:bad)", tex: "handmade" },
    envelope: { liner: "damask", color: "#334455" },
  })!;
  expect(style.seal?.image).toBe("");
  const vars = appearance.styleVars(style);
  expect(vars["--lp-tex"]).toContain("data:image/svg+xml");
  expect(JSON.stringify(vars)).not.toContain("undefined");
  expect(JSON.stringify(vars)).not.toContain("private-source");
  expect(vars["--env-c"]).toBe("#334455");
});
it("整封信定时开启会删除所有正文、音轨、内嵌附件及自定义印面，不能用客户端改日期绕过", () => {
  const d = blankDocument("甲");
  d.unlockAt = "2099-01-01";
  d.paragraphs[0].text = "整信未来正文";
  d.items = [{ ...blankItem("ticket", "ticket1"), text: "未来票根" }];
  d.music.tracks = [
    {
      id: "track1",
      title: "未来曲目",
      src: "/api/mail-media/00000000-0000-4000-8000-000000000000",
      cs: 0,
      ce: 0,
      vol: 1,
    },
  ];
  const view = visibleDocument(d, "2026-11-17");
  expect(view.lockedUntil).toBe("2099-01-01");
  expect(JSON.stringify(view)).not.toContain("整信未来正文");
  expect(JSON.stringify(view)).not.toContain("未来曲目");
  expect(view.items).toEqual([]);
  expect(visibleDocument(d, "2099-01-01").paragraphs[0].text).toBe(
    "整信未来正文",
  );
  expect(
    parseRichDocument({ ...d, lockedUntil: "1900-01-01" }),
  ).not.toHaveProperty("lockedUntil");
});
