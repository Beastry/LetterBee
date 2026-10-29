"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BLOCK_TYPES, BLOCK_TYPE_LABEL, type Block, type LetterDocument } from "../types";
import { createBlock, createEvent, createId, createParagraph, createPhoto, moveItem } from "../templates";
import { toLetterView } from "../unlock";
import { LetterExperience } from "./LetterExperience";

async function uploadMedia(slug: string, file: File): Promise<string> {
  const body = new FormData();
  body.set("file", file);
  const response = await fetch(`/api/letters/${slug}/media`, { method: "POST", body });
  const payload = (await response.json()) as { url?: string; error?: string };

  if (!response.ok || !payload.url) {
    throw new Error(payload.error || "上传失败");
  }

  return payload.url;
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <label>
      {label}
      {multiline ? (
        <textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

export function LetterEditor({ initial, today }: { initial: LetterDocument; today: string }) {
  const [draft, setDraft] = useState(initial);
  const [previewDate, setPreviewDate] = useState(today);
  const [newPassphrase, setNewPassphrase] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const view = useMemo(() => toLetterView(draft, previewDate), [draft, previewDate]);

  function updateBlock(id: string, updater: (block: Block) => Block) {
    setDraft((current) => ({
      ...current,
      blocks: current.blocks.map((block) => (block.id === id ? updater(block) : block)),
    }));
  }

  async function onSave() {
    setPending(true);
    setError("");
    setStatus("");

    try {
      const response = await fetch(`/api/letters/${draft.slug}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          document: draft,
          newPassphrase: newPassphrase || undefined,
        }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error || "没有保存");
        return;
      }

      setNewPassphrase("");
      setStatus("已写入本地底稿。收信页刷新后会看到这次修改。");
    } catch (saveError) {
      console.error(saveError);
      setError("保存时没有连上本地服务。");
    } finally {
      setPending(false);
    }
  }

  async function attachFile(blockId: string, file: File) {
    const block = draft.blocks.find((item) => item.id === blockId);
    if (!block) {
      return;
    }

    const image = file.type.startsWith("image/");
    const audio = file.type.startsWith("audio/");
    const video = file.type.startsWith("video/");
    const accepted =
      (block.type === "photos" && image) ||
      (block.type === "voice" && audio) ||
      (block.type === "video" && (video || image));

    if (!accepted) {
      setError("这个区块不收这种文件");
      return;
    }

    setError("");
    try {
      const url = await uploadMedia(draft.slug, file);
      updateBlock(blockId, (current) => {
        if (current.type === "photos" && image) {
          return {
            ...current,
            items: [...current.items, { id: createId("photo"), src: url, alt: file.name, caption: "" }],
          };
        }
        if (current.type === "voice" && audio) {
          return { ...current, src: url };
        }
        if (current.type === "video" && video) {
          return { ...current, src: url };
        }
        if (current.type === "video" && image) {
          return { ...current, poster: url };
        }
        return current;
      });
    } catch (uploadError) {
      console.error(uploadError);
      setError(uploadError instanceof Error ? uploadError.message : "上传失败");
    }
  }

  async function attachTrack(file: File) {
    setError("");
    try {
      const url = await uploadMedia(draft.slug, file);
      setDraft((current) => ({
        ...current,
        bgm: {
          ...current.bgm,
          tracks: [...current.bgm.tracks, { id: createId("track"), title: file.name, src: url }],
        },
      }));
    } catch (uploadError) {
      console.error(uploadError);
      setError(uploadError instanceof Error ? uploadError.message : "上传失败");
    }
  }

  return (
    <div className="lk-editor">
      <div className="lk-editor-main">
        <div className="lk-topbar">
          <div>
            <p className="lk-kicker">写信台</p>
            <h1>编辑这封样例</h1>
          </div>
          <div className="lk-row">
            <Link href={`/letters/${draft.slug}`}>打开收信页</Link>
            <button type="button" className="primary" disabled={pending} onClick={() => void onSave()}>
              {pending ? "正在保存" : "保存到底稿"}
            </button>
          </div>
        </div>
        {error ? <p className="lk-error">{error}</p> : null}
        {status ? <p>{status}</p> : null}

        <section className="lk-card">
          <h2>信封与门禁</h2>
          <div className="lk-fields">
            <Field label="标题" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} />
            <Field
              label="收信人"
              value={draft.envelope.to}
              onChange={(to) => setDraft({ ...draft, envelope: { ...draft.envelope, to } })}
            />
            <Field
              label="寄信人"
              value={draft.envelope.from}
              onChange={(from) => setDraft({ ...draft, envelope: { ...draft.envelope, from } })}
            />
            <Field
              label="邮戳"
              value={draft.envelope.postmark}
              onChange={(postmark) => setDraft({ ...draft, envelope: { ...draft.envelope, postmark } })}
            />
            <Field
              label="口令提示"
              value={draft.gate.hint}
              multiline
              onChange={(hint) => setDraft({ ...draft, gate: { ...draft.gate, hint } })}
            />
            <label>
              口令盘位数
              <input
                type="number"
                min={1}
                max={8}
                value={draft.gate.dials}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    gate: { ...draft.gate, dials: Number(event.target.value) },
                  })
                }
              />
            </label>
            <Field
              label="口令字符表"
              value={draft.gate.charset}
              onChange={(charset) => setDraft({ ...draft, gate: { ...draft.gate, charset } })}
            />
            <label>
              新口令（留空则不修改，只保存哈希）
              <input
                value={newPassphrase}
                autoComplete="off"
                onChange={(event) => setNewPassphrase(event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="lk-card">
          <h2>背景声</h2>
          <div className="lk-fields">
            <label>
              播放
              <select
                value={draft.bgm.mode}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    bgm: { ...draft.bgm, mode: event.target.value === "shuffle" ? "shuffle" : "sequence" },
                  })
                }
              >
                <option value="sequence">顺序</option>
                <option value="shuffle">随机</option>
              </select>
            </label>
            <label>
              交叉淡化（毫秒）
              <input
                type="number"
                min={200}
                max={5000}
                value={draft.bgm.crossfadeMs}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    bgm: { ...draft.bgm, crossfadeMs: Number(event.target.value) },
                  })
                }
              />
            </label>
            {draft.bgm.tracks.map((track, index) => (
              <div className="lk-row" key={track.id}>
                <input
                  value={track.title}
                  aria-label="曲名"
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      bgm: {
                        ...draft.bgm,
                        tracks: draft.bgm.tracks.map((item) =>
                          item.id === track.id ? { ...item, title: event.target.value } : item,
                        ),
                      },
                    })
                  }
                />
                <button
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      bgm: { ...draft.bgm, tracks: draft.bgm.tracks.filter((item) => item.id !== track.id) },
                    })
                  }
                >
                  移除第 {index + 1} 首
                </button>
              </div>
            ))}
            <div
              className="lk-drop"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files[0];
                if (file) {
                  void attachTrack(file);
                }
              }}
            >
              把音频拖到这里加入歌单
            </div>
          </div>
        </section>

        <div className="lk-row">
          {BLOCK_TYPES.map((type) => (
            <button
              type="button"
              key={type}
              onClick={() => setDraft({ ...draft, blocks: [...draft.blocks, createBlock(type)] })}
            >
              加{BLOCK_TYPE_LABEL[type]}
            </button>
          ))}
        </div>

        {draft.blocks.map((block, index) => (
          <article
            key={block.id}
            className="lk-card"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              const file = event.dataTransfer.files[0];
              if (file) {
                event.preventDefault();
                void attachFile(block.id, file);
                return;
              }
              event.preventDefault();
              if (dragIndex !== null) {
                setDraft({ ...draft, blocks: moveItem(draft.blocks, dragIndex, index) });
                setDragIndex(null);
              }
            }}
          >
            <div className="lk-row">
              <h3>
                {index + 1}. {BLOCK_TYPE_LABEL[block.type]}
              </h3>
              <span
                draggable
                onDragStart={() => setDragIndex(index)}
                className="lk-button"
              >
                拖动排序
              </span>
              <button
                type="button"
                onClick={() =>
                  setDraft({ ...draft, blocks: moveItem(draft.blocks, index, index - 1) })
                }
              >
                上移
              </button>
              <button
                type="button"
                onClick={() =>
                  setDraft({ ...draft, blocks: moveItem(draft.blocks, index, index + 1) })
                }
              >
                下移
              </button>
              <button
                type="button"
                disabled={draft.blocks.length === 1}
                onClick={() =>
                  setDraft({ ...draft, blocks: draft.blocks.filter((item) => item.id !== block.id) })
                }
              >
                删除
              </button>
            </div>
            <div className="lk-fields">
              <label>
                启封日
                <input
                  type="date"
                  value={block.unlockAt ?? ""}
                  onChange={(event) =>
                    updateBlock(block.id, (current) => ({
                      ...current,
                      unlockAt: event.target.value || undefined,
                    }))
                  }
                />
              </label>
              <BlockFields block={block} update={(updater) => updateBlock(block.id, updater)} />
              <div
                className="lk-drop"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const file = event.dataTransfer.files[0];
                  if (file) {
                    void attachFile(block.id, file);
                  }
                }}
              >
                拖拽图片、声音或影像到这个区块
              </div>
            </div>
          </article>
        ))}
      </div>

      <aside className="lk-preview">
        <div className="lk-inline">
          <label>
            按这一天预览解锁
            <input
              type="date"
              value={previewDate}
              onChange={(event) => setPreviewDate(event.target.value)}
            />
          </label>
        </div>
        <LetterExperience view={view} preview />
      </aside>
    </div>
  );
}

function BlockFields({
  block,
  update,
}: {
  block: Block;
  update: (updater: (block: Block) => Block) => void;
}) {
  if (block.type === "hero") {
    return (
      <>
        <Field label="眉题" value={block.kicker} onChange={(kicker) => update(() => ({ ...block, kicker }))} />
        <Field label="标题" value={block.title} onChange={(title) => update(() => ({ ...block, title }))} />
        <Field
          label="副题"
          value={block.subtitle}
          onChange={(subtitle) => update(() => ({ ...block, subtitle }))}
        />
      </>
    );
  }

  if (block.type === "letter") {
    return (
      <>
        <Field label="信头" value={block.dateline} onChange={(dateline) => update(() => ({ ...block, dateline }))} />
        <Field
          label="称呼"
          value={block.salutation}
          onChange={(salutation) => update(() => ({ ...block, salutation }))}
        />
        {block.paragraphs.map((paragraph, index) => (
          <div key={paragraph.id} className="lk-fields">
            <Field
              label={`第 ${index + 1} 段`}
              value={paragraph.text}
              multiline
              onChange={(text) =>
                update(() => ({
                  ...block,
                  paragraphs: block.paragraphs.map((item) =>
                    item.id === paragraph.id ? { ...item, text } : item,
                  ),
                }))
              }
            />
            <label className="lk-row">
              <input
                type="checkbox"
                checked={paragraph.hidden === true}
                onChange={(event) =>
                  update(() => ({
                    ...block,
                    paragraphs: block.paragraphs.map((item) =>
                      item.id === paragraph.id ? { ...item, hidden: event.target.checked || undefined } : item,
                    ),
                  }))
                }
              />
              折进纸背
            </label>
            <button
              type="button"
              disabled={block.paragraphs.length === 1}
              onClick={() =>
                update(() => ({
                  ...block,
                  paragraphs: block.paragraphs.filter((item) => item.id !== paragraph.id),
                }))
              }
            >
              删除这段
            </button>
          </div>
        ))}
        <button type="button" onClick={() => update(() => ({ ...block, paragraphs: [...block.paragraphs, createParagraph()] }))}>
          加一段
        </button>
        <Field label="署名" value={block.signoff} onChange={(signoff) => update(() => ({ ...block, signoff }))} />
      </>
    );
  }

  if (block.type === "photos") {
    return (
      <>
        <Field label="标题" value={block.title} onChange={(title) => update(() => ({ ...block, title }))} />
        {block.items.map((item) => (
          <div key={item.id} className="lk-fields">
            <Field
              label="说明"
              value={item.caption}
              onChange={(caption) =>
                update(() => ({
                  ...block,
                  items: block.items.map((photo) => (photo.id === item.id ? { ...photo, caption } : photo)),
                }))
              }
            />
            <Field
              label="替代文字"
              value={item.alt}
              onChange={(alt) =>
                update(() => ({
                  ...block,
                  items: block.items.map((photo) => (photo.id === item.id ? { ...photo, alt } : photo)),
                }))
              }
            />
            <button
              type="button"
              onClick={() => update(() => ({ ...block, items: block.items.filter((photo) => photo.id !== item.id) }))}
            >
              移除照片
            </button>
          </div>
        ))}
        <button type="button" onClick={() => update(() => ({ ...block, items: [...block.items, createPhoto()] }))}>
          加一张空位
        </button>
      </>
    );
  }

  if (block.type === "voice") {
    return (
      <>
        <Field label="标题" value={block.title} onChange={(title) => update(() => ({ ...block, title }))} />
        <Field label="说明" value={block.caption} onChange={(caption) => update(() => ({ ...block, caption }))} />
      </>
    );
  }

  if (block.type === "video") {
    return (
      <>
        <Field label="标题" value={block.title} onChange={(title) => update(() => ({ ...block, title }))} />
        <Field label="说明" value={block.caption} onChange={(caption) => update(() => ({ ...block, caption }))} />
      </>
    );
  }

  if (block.type === "timeline") {
    return (
      <>
        <Field label="标题" value={block.title} onChange={(title) => update(() => ({ ...block, title }))} />
        {block.events.map((event) => (
          <div key={event.id} className="lk-fields">
            <Field
              label="日期"
              value={event.dateLabel}
              onChange={(dateLabel) =>
                update(() => ({
                  ...block,
                  events: block.events.map((item) => (item.id === event.id ? { ...item, dateLabel } : item)),
                }))
              }
            />
            <Field
              label="站名"
              value={event.title}
              onChange={(title) =>
                update(() => ({
                  ...block,
                  events: block.events.map((item) => (item.id === event.id ? { ...item, title } : item)),
                }))
              }
            />
            <Field
              label="正文"
              value={event.body}
              multiline
              onChange={(body) =>
                update(() => ({
                  ...block,
                  events: block.events.map((item) => (item.id === event.id ? { ...item, body } : item)),
                }))
              }
            />
            <label>
              这一站的启封日
              <input
                type="date"
                value={event.unlockAt ?? ""}
                onChange={(input) =>
                  update(() => ({
                    ...block,
                    events: block.events.map((item) =>
                      item.id === event.id ? { ...item, unlockAt: input.target.value || undefined } : item,
                    ),
                  }))
                }
              />
            </label>
            <button
              type="button"
              onClick={() => update(() => ({ ...block, events: block.events.filter((item) => item.id !== event.id) }))}
            >
              删除这一站
            </button>
          </div>
        ))}
        <button type="button" onClick={() => update(() => ({ ...block, events: [...block.events, createEvent()] }))}>
          加一站
        </button>
      </>
    );
  }

  if (block.type === "ending") {
    return (
      <>
        <Field label="标题" value={block.title} onChange={(title) => update(() => ({ ...block, title }))} />
        <Field label="正文" value={block.text} multiline onChange={(text) => update(() => ({ ...block, text }))} />
      </>
    );
  }

  return (
    <>
      <Field label="提示" value={block.hint} onChange={(hint) => update(() => ({ ...block, hint }))} />
      <Field label="暗记" value={block.text} multiline onChange={(text) => update(() => ({ ...block, text }))} />
    </>
  );
}
