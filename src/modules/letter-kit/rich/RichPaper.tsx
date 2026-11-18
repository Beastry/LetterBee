"use client";
/* eslint-disable @next/next/no-img-element */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { appearance } from "./appearance";
import { appPath } from "@/lib/app-path";
import { createJournalLayout, type Box } from "./layout";
import type { JournalItem, RichDocument } from "./model";
import "./rich.css";
const JL = createJournalLayout();
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
type Props = {
  doc: RichDocument;
  edit?: boolean;
  selected?: string;
  onSelect?: (id: string) => void;
  onPatch?: (id: string, patch: Partial<JournalItem>) => void;
  onGestureStart?: () => void;
  onDelete?: (id: string) => void;
  onParagraphEdit?: (id: string, text: string) => void;
  duck?: (id: string, on: boolean) => void;
};
export function RichPaper({
  doc,
  edit = false,
  selected,
  onSelect,
  onPatch,
  onGestureStart,
  onParagraphEdit,
  onDelete,
  duck,
}: Props) {
  const inner = useRef<HTMLDivElement>(null),
    [width, setWidth] = useState(640),
    [fonts, setFonts] = useState(0),
    [revealed, setRevealed] = useState<string[]>([]),
    [lightbox, setLightbox] = useState<string | null>(null),
    [easter, setEaster] = useState<string[]>([]),
    [typed, setTyped] = useState(0),
    [editingParagraph, setEditingParagraph] = useState<string | null>(null);
  const gesture = useRef<{
    id: string;
    mode: string;
    item: JournalItem;
    box: Box;
    points: Map<number, { x: number; y: number }>;
    start: { x: number; y: number };
    distance?: number;
    angle?: number;
  } | null>(null);
  const L = doc.paper.size * doc.paper.lineHeight,
    bodyLength = doc.paragraphs
      .filter((p) => !p.hidden)
      .reduce((n, p) => n + Array.from(p.text).length, 0);
  useEffect(() => {
    const node = inner.current;
    if (!node) return;
    const resize = new ResizeObserver((entries) =>
      setWidth(Math.max(220, entries[0].contentRect.width)),
    );
    resize.observe(node);
    void document.fonts.ready.then(() => setFonts((v) => v + 1));
    return () => resize.disconnect();
  }, []);
  useEffect(() => {
    if (edit || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(
      () => setTyped((v) => Math.min(bodyLength, v + 3)),
      30,
    );
    return () => clearInterval(timer);
  }, [edit, bodyLength]);
  const photos = doc.items.filter((i) => i.t === "photo");
  useEffect(() => {
    if (!lightbox) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (["ArrowRight", "ArrowLeft"].includes(e.key)) {
        e.preventDefault();
        const at = photos.findIndex((p) => p.id === lightbox);
        setLightbox(
          photos[
            (at + (e.key === "ArrowRight" ? 1 : photos.length - 1)) %
              photos.length
          ]?.id || null,
        );
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [lightbox, photos]);
  const layout = useMemo(() => {
    void fonts;
    let measure = (s: string) =>
      Array.from(s).reduce(
        (n, c) => n + doc.paper.size * (/[\u0000-\u00ff]/.test(c) ? 0.57 : 1),
        0,
      );
    if (typeof document !== "undefined") {
      const ctx = document.createElement("canvas").getContext("2d");
      if (ctx) {
        ctx.font = `${doc.paper.size}px ${doc.paper.font === "sans" ? "system-ui,sans-serif" : doc.paper.font === "hand" ? "KaiTi,cursive" : "SimSun,serif"}`;
        measure = (s) => ctx.measureText(s).width;
      }
    }
    const items = doc.items.map((it) => {
      if (["hero", "ending", "timeline", "easter", "ticket"].includes(it.t)) {
        const text = [
            it.heading,
            it.text,
            it.sub,
            it.message,
            ...it.events.flatMap((e) => [e.date, e.title, e.text]),
          ].join(" "),
          w = (it.w / 100) * width;
        const h = Math.max(
          L * 2,
          Math.ceil(measure(text) / Math.max(40, w - 24)) * L +
            L * 2 +
            (it.t === "timeline" ? it.events.length * L : 0),
        );
        return { ...it, ar: Math.max(0.2, Math.min(5, w / h)) };
      }
      return it;
    });
    return JL.layout(
      doc.paragraphs.map((p) => ({
        text: p.text,
        hidden: !edit && !!p.hidden && !revealed.includes(p.id),
        collapsed: true,
      })),
      items,
      {
        W: width,
        L,
        gap: L * 0.3,
        minW: Math.min(126, width * 0.35),
        indent: doc.paper.size * 2,
        edit,
        lastId: selected,
      },
      measure,
    );
  }, [doc, width, L, fonts, edit, revealed, selected]);
  function pointerDown(
    e: PointerEvent<HTMLElement>,
    item: JournalItem,
    box: Box,
    mode = "move",
  ) {
    if (!edit) return;
    if ((e.target as HTMLElement).closest("audio,video,input,a")) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect?.(item.id);
    onGestureStart?.();
    e.currentTarget.setPointerCapture(e.pointerId);
    const g = gesture.current;
    if (g?.id === item.id) {
      g.points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [a, b] = [...g.points.values()];
      if (b) {
        g.distance = Math.hypot(a.x - b.x, a.y - b.y);
        g.angle = Math.atan2(b.y - a.y, b.x - a.x);
        g.item = { ...item };
      }
      return;
    }
    gesture.current = {
      id: item.id,
      mode,
      item: { ...item },
      box,
      points: new Map([[e.pointerId, { x: e.clientX, y: e.clientY }]]),
      start: { x: e.clientX, y: e.clientY },
    };
  }
  function pointerMove(e: PointerEvent<HTMLElement>) {
    const g = gesture.current;
    if (!g || !g.points.has(e.pointerId)) return;
    g.points.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.points.size === 2 && g.distance) {
      const [a, b] = [...g.points.values()];
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      onPatch?.(g.id, {
        w: clamp(
          (g.item.w * Math.hypot(a.x - b.x, a.y - b.y)) / g.distance,
          4,
          100,
        ),
        r: clamp(
          g.item.r + ((angle - (g.angle || 0)) * 180) / Math.PI,
          -180,
          180,
        ),
      });
      return;
    }
    const dx = e.clientX - g.start.x,
      dy = e.clientY - g.start.y;
    if (g.mode === "resize")
      onPatch?.(g.id, { w: clamp(g.item.w + (dx / width) * 100, 4, 100) });
    else if (g.mode === "rotate") {
      const r = g.item.r + dx * 0.5;
      onPatch?.(g.id, {
        r: clamp(e.shiftKey ? Math.round(r / 15) * 15 : r, -180, 180),
      });
    } else
      onPatch?.(g.id, {
        x: clamp(g.item.x + (dx / width) * 100, 0, 100),
        dy: clamp(g.item.dy + dy / L, -6, 80),
      });
  }
  function pointerUp(e: PointerEvent<HTMLElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    gesture.current = null;
  }
  function renderItem(it: JournalItem) {
    switch (it.t) {
      case "photo":
        return (
          <figure className="ji-pola">
            <button
              type="button"
              className="ph"
              aria-label={`放大照片：${it.caption || "照片"}`}
              onClick={() => !edit && setLightbox(it.id)}
            >
              <img
                src={appPath(it.src)}
                alt={it.caption || "信中照片"}
                loading="lazy"
              />
            </button>
            <figcaption>{it.caption}</figcaption>
          </figure>
        );
      case "voice":
        return (
          <div className="ji-voice">
            <p>{it.caption || "一段语音"}</p>
            <audio
              controls
              preload="none"
              src={appPath(it.src)}
              onPlay={() => duck?.(it.id, true)}
              onPause={() => duck?.(it.id, false)}
              onEnded={() => duck?.(it.id, false)}
            />
          </div>
        );
      case "video":
        return (
          <figure className="ji-video">
            <button type="button" className="ji-film" aria-label="播放短片" onClick={(e) => (e.currentTarget.nextElementSibling as HTMLVideoElement | null)?.play()}>
              {it.poster ? <img src={appPath(it.poster)} alt="" /> : <span>▶</span>}
            </button>
            <video
              controls
              playsInline
              preload="none"
              src={appPath(it.src)}
              poster={it.poster ? appPath(it.poster) : undefined}
              onPlay={() => duck?.(it.id, true)}
              onPause={() => duck?.(it.id, false)}
              onEnded={() => duck?.(it.id, false)}
            />
            <figcaption>{it.caption}</figcaption>
          </figure>
        );
      case "sticker":
        if (it.src)
          return <img src={appPath(it.src)} alt="自带贴纸" loading="lazy" />;
        return (
          <span className="rich-sticker" aria-label="装饰贴纸">
            {it.k}
          </span>
        );
      case "tape":
        return (
          <span className={`rich-tape ji-tape ji-tape-${it.k || "linen"}`} aria-label="装饰胶带" />
        );
      case "stamp":
        return (
          <span className={`rich-stamp ji-stamp ji-stamp-${it.k || "post"}`}>
            <strong>{it.text || "邮"}</strong>
          </span>
        );
      case "ticket":
        return (
          <div className="rich-ticket ji-ticket">
            <strong>{it.text || "一张票根"}</strong>
            <small>{it.sub}</small>
          </div>
        );
      case "timeline":
        return (
          <div className="ji-timeline">
            <h3>{it.heading || "时间线"}</h3>
            <ol>
              {it.events.map((e, i) => (
                <li key={i}>
                  <time>{e.date}</time>
                  <strong>{e.title}</strong>
                  <p>{e.text}</p>
                </li>
              ))}
            </ol>
          </div>
        );
      case "hero":
      case "ending":
        return (
          <div className={`ji-${it.t}`}>
            <h3>{it.heading}</h3>
            <p>{it.text || it.sub}</p>
            {it.t === "ending" &&
              (it.src ? (
                <img className="ji-wax" src={appPath(it.src)} alt="落款印章" />
              ) : (
                <i className="ji-wax" aria-hidden="true" />
              ))}
          </div>
        );
      case "easter":
        return (
          <button
            type="button"
            className="ji-fold"
            aria-expanded={edit || easter.includes(it.id)}
            onClick={() =>
              setEaster((v) =>
                v.includes(it.id) ? v.filter((x) => x !== it.id) : [...v, it.id],
              )
            }
          >
            <span>{edit || easter.includes(it.id) ? it.message : it.heading || ""}</span>
          </button>
        );
    }
  }
  const style = {
    ...(doc.style ? appearance.styleVars(doc.style) : {}),
    "--rich-size": `${doc.paper.size}px`,
    "--rich-line": `${L}px`,
    fontFamily:
      doc.paper.font === "sans"
        ? "system-ui,sans-serif"
        : doc.paper.font === "hand"
          ? '"Kaiti SC",KaiTi,cursive'
          : '"Noto Serif SC",SimSun,serif',
  } as CSSProperties;
  const segments = layout.lines.flatMap((line) =>
    line.segs.map((seg) => ({ line, seg })),
  );
  const immediate =
    edit ||
    (typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const picture = photos.find((p) => p.id === lightbox);
  return (
    <article
      className={`ypaper rich-paper paper-${doc.paper.theme} ${doc.paper.ruled || doc.style?.paper?.tex === "lined" ? "paper-ruled" : ""}`}
      style={style}
      data-testid="rich-letter-paper"
    >
      <section className="sec letter" data-journal="1">
      <div className="eyebrow lhead">
        <h2 className="ltitle">{doc.title}</h2>
      </div>
      {!edit && typed < bodyLength && !immediate && (
        <button type="button" className="wbtn" onClick={() => setTyped(bodyLength)}>
          一次展开文字
        </button>
      )}
      <div className="paper has-so">
      <div className="lsheet">
      {doc.salutation ? <p className="salute">{doc.salutation}</p> : null}
      <div
        ref={inner}
        className="lbody rich-body"
        style={{ height: layout.height + L }}
      >
        {segments.map(({ line, seg }, n) => {
          const offset = segments
            .slice(0, n)
            .filter((s) => !doc.paragraphs[s.line.pi]?.hidden)
            .reduce((total, s) => total + Array.from(s.seg.text).length, 0);
          const isHidden = doc.paragraphs[line.pi]?.hidden;
          const chars = Array.from(seg.text);
          const shown =
            immediate || isHidden ? chars.length : Math.max(0, typed - offset);
          return (
            <span
              className={`rich-line ${isHidden ? `revealed hv-${doc.paragraphs[line.pi].hv}` : ""}`}
              key={n}
              onDoubleClick={() =>
                edit && setEditingParagraph(doc.paragraphs[line.pi].id)
              }
              title={edit ? "双击就地编辑这一段" : undefined}
              style={{ top: line.y, left: seg.x, width: seg.w }}
            >
              {isHidden
                ? chars.slice(0, shown).map((c, i) => (
                    <span
                      key={i}
                      className="rich-ink-char"
                      style={{
                        animationDelay: `${Math.round(i * Math.max(14, Math.min(42, 2400 / Math.max(1, chars.length))))}ms`,
                      }}
                    >
                      {c}
                    </span>
                  ))
                : chars.slice(0, shown).join("")}
            </span>
          );
        })}
        {!edit &&
          layout.paras.map((b) => {
            const p = doc.paragraphs[b.pi];
            return p.hidden && !revealed.includes(p.id) ? (
              <button
                type="button"
                key={p.id}
                className={`rich-hidden hp-speck hv-${p.hv}`}
                style={{ top: Math.max(0, b.y - 12), left: (b.pi * 23) % 120 }}
                aria-label="这里有一段隐藏文字，轻触展开"
                onClick={() => setRevealed((v) => [...v, p.id])}
              >
                {p.hv === "speck" ? "·" : "纸上有一行浅印…"}
              </button>
            ) : null;
          })}
        {edit &&
          editingParagraph &&
          layout.paras
            .filter((b) => doc.paragraphs[b.pi]?.id === editingParagraph)
            .map((b) => (
              <textarea
                autoFocus
                key={editingParagraph}
                aria-label="信纸内段落编辑"
                className="rich-inline-editor"
                style={{
                  top: b.y,
                  width: "100%",
                  height: Math.max(L * 3, b.h),
                }}
                value={doc.paragraphs[b.pi].text}
                onChange={(e) =>
                  onParagraphEdit?.(editingParagraph, e.target.value)
                }
                onBlur={() => setEditingParagraph(null)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setEditingParagraph(null);
                }}
              />
            ))}
        {layout.items.map((box, n) => {
          const it = doc.items[n];
          if (!box || !it) return null;
          return (
            <div
              key={it.id}
              role={edit ? "button" : undefined}
              tabIndex={edit ? 0 : undefined}
              aria-label={
                edit
                  ? `${it.t}物件，方向键移动，Shift加速；Delete删除`
                  : undefined
              }
              className={`rich-item ji ji-${it.t} item-${it.t} ${selected === it.id ? "selected" : ""}`}
              style={{
                left: box.x,
                top: box.y,
                width: box.w,
                height: box.h,
                transform: `rotate(${box.r}deg)`,
                zIndex: it.z + 1,
                touchAction: edit ? "none" : "auto",
              }}
              onPointerDown={(e) => pointerDown(e, it, box)}
              onPointerMove={pointerMove}
              onPointerUp={pointerUp}
              onPointerCancel={pointerUp}
              onKeyDown={(e) => {
                if (!edit || e.target !== e.currentTarget) return;
                if (e.key === "Delete" || e.key === "Backspace") {
                  e.preventDefault();
                  onDelete?.(it.id);
                  return;
                }
                if (e.key === "Escape") {
                  onSelect?.("");
                  return;
                }
                if (e.key.startsWith("Arrow")) {
                  e.preventDefault();
                  onGestureStart?.();
                  const v = e.shiftKey ? 5 : 1;
                  onPatch?.(it.id, {
                    x: clamp(
                      it.x +
                        (e.key === "ArrowRight"
                          ? v
                          : e.key === "ArrowLeft"
                            ? -v
                            : 0),
                      0,
                      100,
                    ),
                    dy: clamp(
                      it.dy +
                        (e.key === "ArrowDown"
                          ? v / 4
                          : e.key === "ArrowUp"
                            ? -v / 4
                            : 0),
                      -6,
                      80,
                    ),
                  });
                }
              }}
              onFocus={() => edit && onSelect?.(it.id)}
            >
              {renderItem(it)}
              {edit && selected === it.id && (
                <>
                  <button
                    type="button"
                    className="rich-handle resize"
                    aria-label="拖动缩放"
                    onPointerDown={(e) => pointerDown(e, it, box, "resize")}
                  >
                    ↔
                  </button>
                  <button
                    type="button"
                    className="rich-handle rotate"
                    aria-label="拖动旋转，Shift吸附15度"
                    onPointerDown={(e) => pointerDown(e, it, box, "rotate")}
                  >
                    ↻
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="signoff">
        <p className="so-name">{doc.signoff}</p>
        <p className="so-date">{doc.dateline}</p>
      </div>
      </div>
      </div>
      </section>
      {picture && (
        <div
          className="rich-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="信中照片"
          onClick={() => setLightbox(null)}
        >
          <button
            autoFocus
            type="button"
            aria-label="关闭照片"
            onClick={() => setLightbox(null)}
          >
            关闭 ×
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const at = photos.indexOf(picture);
              setLightbox(photos[(at + photos.length - 1) % photos.length].id);
            }}
          >
            上一张
          </button>
          <figure onClick={(e) => e.stopPropagation()}>
            <img
              src={appPath(picture.src)}
              alt={picture.caption || "信中照片"}
            />
            <figcaption>{picture.caption}</figcaption>
          </figure>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const at = photos.indexOf(picture);
              setLightbox(photos[(at + 1) % photos.length].id);
            }}
          >
            下一张
          </button>
        </div>
      )}
    </article>
  );
}
