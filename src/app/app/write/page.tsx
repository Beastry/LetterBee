import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ensurePublicId, getCurrentUser } from "@/lib/session";
import {
  getMailDraft,
  listRelationshipsForUser,
  loadMailStore,
} from "@/lib/mail-store";
import { mailMediaAvailable } from "@/lib/mail-media-storage";
import { RichLetterError } from "@/modules/letter-kit/rich/model";
import {
  RichComposer,
  NewRichDraft,
} from "@/modules/letter-kit/rich/RichComposer";
import "@/modules/letter-kit/rich/rich.css";
export const dynamic = "force-dynamic";
export default async function WritePage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string; to?: string; mode?: string }>;
}) {
  const raw = await getCurrentUser();
  if (!raw) redirect("/login?next=/app/write");
  const user = await ensurePublicId(raw),
    q = await searchParams;
  if (q.draft) {
    let draft;
    try {
      draft = await getMailDraft(user.id, q.draft);
    } catch (e) {
      if (e instanceof RichLetterError && e.status === 404) notFound();
      throw e;
    }
    if (draft.letterId) redirect(`/app/letters/${draft.letterId}`);
    const contacts = (await listRelationshipsForUser(user.id)).map((r) => ({
      id: r.contact.id,
      name: r.contact.name,
      publicId: r.contact.publicId,
    }));
    return (
      <RichComposer
        draft={draft}
        contacts={contacts}
        initialTo={q.to}
        initialMode={q.mode}
        mediaAvailable={await mailMediaAvailable()}
      />
    );
  }
  const store = await loadMailStore(),
    drafts = Object.values(store.drafts)
      .filter((d) => d.ownerId === user.id && !d.letterId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <main className="rich-workspace">
      <section className="rich-drafts">
        <Link href="/app">← 回到邮局</Link>
        <h1 className="text-3xl my-6">草稿箱 · 写一封信</h1>
        <p>
          用真实草稿写信、保存、寄给通信簿/公开邮寄号，或生成邀请认领。寄出后保留不可修改的信纸快照。
        </p>
        <div className="rich-toolbar">
          <NewRichDraft to={q.to} mode={q.mode} />
          <Link href="/app/contacts">通信簿</Link>
        </div>
        <ul>
          {drafts.map((d) => (
            <li key={d.id}>
              <Link
                href={`/app/write?draft=${d.id}${q.to ? `&to=${encodeURIComponent(q.to)}` : ""}${q.mode ? `&mode=${encodeURIComponent(q.mode)}` : ""}`}
              >
                {d.document.title || "无题信"}
              </Link>{" "}
              ·{" "}
              {new Date(d.updatedAt).toLocaleString("zh-CN", {
                timeZone: "Asia/Shanghai",
              })}
              （上海时区）
            </li>
          ))}
        </ul>
        {!drafts.length && <p>还没有未寄出的信，点击「新建一封信」。</p>}
      </section>
    </main>
  );
}
