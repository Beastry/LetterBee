"use client";

import { useEffect, useRef, useState } from "react";
import { BLOCK_TYPE_LABEL, isLockedStub, type FilteredBlock, type FilteredParagraph } from "../types";

function TypewriterText({ text, onDone }: { text: string; onDone: () => void }) {
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = reduce ? 0 : Math.max(text.length, 1) * 28;
    const timer = window.setTimeout(() => onDoneRef.current(), delay);
    return () => window.clearTimeout(timer);
  }, [text]);

  return (
    <p className="lk-paragraph">
      {Array.from(text).map((character, index) => (
        <span key={`${character}-${index}`} className="lk-char" style={{ animationDelay: `${index * 28}ms` }}>
          {character}
        </span>
      ))}
    </p>
  );
}

function isSkippableParagraph(paragraph: FilteredParagraph): boolean {
  return isLockedStub(paragraph) || paragraph.hidden === true;
}

function LetterParagraphs({ paragraphs }: { paragraphs: FilteredParagraph[] }) {
  const [doneCount, setDoneCount] = useState(0);
  let cursor = doneCount;

  while (cursor < paragraphs.length && isSkippableParagraph(paragraphs[cursor]!)) {
    cursor += 1;
  }

  return (
    <>
      {paragraphs.map((paragraph, index) => {
        if (index > cursor) {
          return null;
        }

        if (isLockedStub(paragraph)) {
          return (
            <p key={paragraph.id} className="lk-locked" data-testid="locked-inline">
              这一行要到 {paragraph.unlockAt} 才写得完。
            </p>
          );
        }

        if (paragraph.hidden) {
          return <HiddenLine key={paragraph.id} text={paragraph.text} />;
        }

        if (index < cursor) {
          return (
            <p key={paragraph.id} className="lk-paragraph">
              {paragraph.text}
            </p>
          );
        }

        return (
          <TypewriterText
            key={paragraph.id}
            text={paragraph.text}
            onDone={() => setDoneCount((value) => Math.max(value, index + 1))}
          />
        );
      })}
    </>
  );
}

function HiddenLine({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" className="lk-hidden" data-testid="hidden-line" onClick={() => setOpen(true)}>
        纸背还有一行
      </button>
    );
  }

  return <p className="lk-paragraph">{text}</p>;
}

function blockMediaHandlers(
  id: string,
  setDucked: (id: string, on: boolean) => void,
) {
  return {
    onPlay: () => setDucked(id, true),
    onPause: () => setDucked(id, false),
    onEnded: () => setDucked(id, false),
  };
}

function LockedCard({ type, unlockAt }: { type: FilteredBlock["type"]; unlockAt: string }) {
  return (
    <section className="lk-locked" data-testid="locked-block">
      <p className="lk-kicker">未到启封日</p>
      <h2>{BLOCK_TYPE_LABEL[type]}</h2>
      <p>这页要到 {unlockAt} 才展开。</p>
    </section>
  );
}

export function LetterBlocks({
  blocks,
  setDucked,
}: {
  blocks: FilteredBlock[];
  setDucked: (id: string, on: boolean) => void;
}) {
  return (
    <div data-testid="letter-sheet">
      {blocks.map((block) => {
        if (isLockedStub(block)) {
          return <LockedCard key={block.id} type={block.type} unlockAt={block.unlockAt} />;
        }

        switch (block.type) {
          case "hero":
            return (
              <header key={block.id} className="lk-hero">
                <p className="lk-kicker">{block.kicker}</p>
                <h1>{block.title}</h1>
                <p>{block.subtitle}</p>
              </header>
            );
          case "letter":
            return (
              <article key={block.id} className="lk-paper">
                <p className="lk-dateline">{block.dateline}</p>
                <p>{block.salutation}</p>
                <LetterParagraphs paragraphs={block.paragraphs} />
                <p className="lk-signoff">{block.signoff}</p>
              </article>
            );
          case "photos":
            return (
              <section key={block.id} className="lk-block">
                <h2>{block.title}</h2>
                <div className="lk-photos">
                  {block.items.map((item) =>
                    isLockedStub(item) ? (
                      <div key={item.id} className="lk-placeholder" data-testid="locked-inline">
                        {item.unlockAt} 再看这张
                      </div>
                    ) : item.src ? (
                      <figure key={item.id}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- letter media is chosen at runtime */}
                        <img src={item.src} alt={item.alt} />
                        {item.caption ? <figcaption>{item.caption}</figcaption> : null}
                      </figure>
                    ) : (
                      <div key={item.id} className="lk-placeholder">
                        这里还没有照片
                      </div>
                    ),
                  )}
                </div>
              </section>
            );
          case "voice":
            return (
              <section key={block.id} className="lk-block">
                <h2>{block.title}</h2>
                {block.caption ? <p className="lk-caption">{block.caption}</p> : null}
                {block.src ? (
                  <div className="lk-player">
                    <audio className="lk-audio" controls preload="none" {...blockMediaHandlers(block.id, setDucked)}>
                      <source src={block.src} />
                    </audio>
                  </div>
                ) : (
                  <div className="lk-placeholder">这里还没有声音</div>
                )}
              </section>
            );
          case "video":
            return (
              <section key={block.id} className="lk-block">
                <h2>{block.title}</h2>
                {block.caption ? <p className="lk-caption">{block.caption}</p> : null}
                {block.src ? (
                  <figure className="lk-video">
                    <video
                      controls
                      playsInline
                      preload="metadata"
                      poster={block.poster || undefined}
                      {...blockMediaHandlers(block.id, setDucked)}
                    >
                      <source src={block.src} />
                    </video>
                  </figure>
                ) : (
                  <div className="lk-placeholder">这里还没有影像</div>
                )}
              </section>
            );
          case "timeline":
            return (
              <section key={block.id} className="lk-block">
                <h2>{block.title}</h2>
                <ol className="lk-timeline">
                  {block.events.map((event) =>
                    isLockedStub(event) ? (
                      <li key={event.id} data-testid="locked-inline">
                        <strong>未到日子</strong>
                        <p className="lk-caption">{event.unlockAt}</p>
                      </li>
                    ) : (
                      <li key={event.id}>
                        <span className="lk-caption">{event.dateLabel}</span>
                        <strong> {event.title}</strong>
                        <p>{event.body}</p>
                      </li>
                    ),
                  )}
                </ol>
              </section>
            );
          case "ending":
            return (
              <section key={block.id} className="lk-ending lk-block">
                <h2>{block.title}</h2>
                <p>{block.text}</p>
              </section>
            );
          case "easter":
            return (
              <details key={block.id} className="lk-easter">
                <summary>{block.hint}</summary>
                <p>{block.text}</p>
              </details>
            );
          default: {
            const unreachable: never = block;
            return unreachable;
          }
        }
      })}
    </div>
  );
}
