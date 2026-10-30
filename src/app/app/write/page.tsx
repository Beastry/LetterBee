import Link from "next/link";
import { redirect } from "next/navigation";
import { ensurePublicId, getCurrentUser } from "@/lib/session";
import { createInviteLetterAction, sendConnectedLetterAction } from "./actions";
import { listRelationshipsForUser } from "@/lib/mail-store";
export const dynamic = "force-dynamic";
export default async function WritePage({ searchParams }: { searchParams: Promise<{ error?: string; mode?: string; to?: string }> }) {
  const rawUser = await getCurrentUser();
  if (!rawUser) redirect("/login?next=/app/write");
  const user = await ensurePublicId(rawUser);
  const contacts = await listRelationshipsForUser(user.id);
  const { error, mode: requestedMode, to } = await searchParams;
  const mode = requestedMode || (to ? "public" : contacts.length ? "contacts" : "new");
  const field = "mt-2 block w-full rounded-xl border border-[#d7c3a4] bg-white/70 p-3";
  return <main className="min-h-screen bg-[#f5efe3] px-6 py-12 text-[#2f241b]"><div className="mx-auto max-w-2xl">
    <Link href="/app">← 回到邮局</Link><section className="mt-8 rounded-[2rem] border border-[#d7c3a4] bg-[#fffaf0] p-8">
      <nav className="mb-8 flex flex-wrap gap-4" aria-label="寄信方式">
        <Link className={mode === "contacts" ? "font-bold underline" : ""} href="/app/write?mode=contacts">写给通信簿的人</Link>
        <Link className={mode === "public" ? "font-bold underline" : ""} href="/app/write?mode=public">填公开邮寄号</Link>
        <Link className={mode === "new" ? "font-bold underline" : ""} href="/app/write?mode=new">写给一个新的人</Link>
      </nav>
      {mode !== "new" ? <>
        <h1 className="text-3xl font-semibold">给通邮的人写封信</h1>
        <p className="mt-4 text-[#6f5a43]">只向已建立通信关系的人寄信，寄往对方当前的默认收信邮局。公开邮寄号须完整填写，并区分大小写。</p>
        <form action={sendConnectedLetterAction} className="mt-8 space-y-5">
          {mode === "contacts" ? <label className="block">通信簿里的收信人<select name="contactUserId" className={field} required defaultValue="">
            <option value="" disabled>请选择收信人</option>
            {contacts.map(({ contact }) => <option key={contact.id} value={contact.id}>{contact.name} · {contact.publicId}</option>)}
          </select>{!contacts.length && <span className="text-sm text-[#8a6a45]">通信簿还是空的，先写一封邀请信吧。</span>}</label> :
            <label className="block">对方的公开邮寄号<input name="recipientPublicId" className={field} defaultValue={to || ""} required autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="完整的公开邮寄号" /></label>}
          <label className="block">信的正文<textarea className={field} name="content" required maxLength={800} rows={12} placeholder="见字如面……（最多 800 字）" /></label>
          {error && <p role="alert">{error}</p>}
          <button className="rounded-full bg-[#6f432a] px-6 py-3 text-[#fff8ec]" disabled={mode === "contacts" && !contacts.length}>封好信，寄出</button>
        </form>
      </> : <>
      <h1 className="text-3xl font-semibold">写给一个新的人</h1><p className="mt-4 text-[#6f5a43]">写好第一封信，把一次性收信链接捎给对方。认领后，你们就进入彼此的通信簿。</p>
      <form action={createInviteLetterAction} className="mt-8 space-y-5">
        <label className="block">怎么称呼对方<input className={field} name="recipientHintName" required maxLength={40} placeholder="例如：小林" /></label>
        <label className="block">信的正文<textarea className={field} name="content" required maxLength={800} rows={12} placeholder="见字如面……（最多 800 字）" /></label>
        <label className="block">收信口令（可选）<input className={field} name="passphrase" type="password" maxLength={128} autoComplete="new-password" /><span className="text-sm text-[#8a6a45]">设定后，请另外把口令告诉对方。</span></label>
        <label className="block">链接有效天数<input className={field} name="expiresInDays" type="number" min={1} max={30} defaultValue={7} required /></label>
        {error && <p role="alert">请填写称呼和正文；正文不超过 800 字，有效期为 1–30 天。</p>}
        <button className="rounded-full bg-[#6f432a] px-6 py-3 text-[#fff8ec]">封好信，生成邀请链接</button>
      </form>
      </>}
    </section><nav className="mt-6 flex gap-6"><Link href="/app/contacts">翻开通信簿</Link><Link href="/letters/sample/edit">体验信笺编辑器</Link></nav>
  </div></main>;
}
