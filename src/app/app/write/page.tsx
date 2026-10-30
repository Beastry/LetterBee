import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { createInviteLetterAction } from "./actions";
export const dynamic = "force-dynamic";
export default async function WritePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!await getCurrentUser()) redirect("/login?next=/app/write");
  const { error } = await searchParams;
  const field = "mt-2 block w-full rounded-xl border border-[#d7c3a4] bg-white/70 p-3";
  return <main className="min-h-screen bg-[#f5efe3] px-6 py-12 text-[#2f241b]"><div className="mx-auto max-w-2xl">
    <Link href="/app">← 回到邮局</Link><section className="mt-8 rounded-[2rem] border border-[#d7c3a4] bg-[#fffaf0] p-8">
      <h1 className="text-3xl font-semibold">写给一个新的人</h1><p className="mt-4 text-[#6f5a43]">写好第一封信，把一次性收信链接捎给对方。认领后，你们就进入彼此的通信簿。</p>
      <form action={createInviteLetterAction} className="mt-8 space-y-5">
        <label className="block">怎么称呼对方<input className={field} name="recipientHintName" required maxLength={40} placeholder="例如：小林" /></label>
        <label className="block">信的正文<textarea className={field} name="content" required maxLength={800} rows={12} placeholder="见字如面……（最多 800 字）" /></label>
        <label className="block">收信口令（可选）<input className={field} name="passphrase" type="password" maxLength={128} autoComplete="new-password" /><span className="text-sm text-[#8a6a45]">设定后，请另外把口令告诉对方。</span></label>
        <label className="block">链接有效天数<input className={field} name="expiresInDays" type="number" min={1} max={30} defaultValue={7} required /></label>
        {error && <p role="alert">请填写称呼和正文；正文不超过 800 字，有效期为 1–30 天。</p>}
        <button className="rounded-full bg-[#6f432a] px-6 py-3 text-[#fff8ec]">封好信，生成邀请链接</button>
      </form>
    </section><nav className="mt-6 flex gap-6"><Link href="/app/contacts">翻开通信簿</Link><Link href="/letters/sample/edit">体验信笺编辑器</Link></nav>
  </div></main>;
}
