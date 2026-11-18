import { RichReader } from "@/modules/letter-kit/rich/RichReader";
import "@/modules/letter-kit/ceremony/skin.css";
import { formatISODate } from "@/modules/letter-kit/today";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ensurePublicId, getCurrentUser } from "@/lib/session";
import { getReadableMailLetter } from "@/lib/mail-store";

export default async function MailLetterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const rawUser = await getCurrentUser();
  if (!rawUser)
    redirect(`/login?next=${encodeURIComponent(`/app/letters/${id}`)}`);
  const user = await ensurePublicId(rawUser);
  const record = await getReadableMailLetter(
    user.id,
    id,
    formatISODate(new Date(), "Asia/Shanghai"),
  );
  if (!record) notFound();
  const { letter, sender } = record;

  if (letter.document)
    return (
      <main className="lb-skin rich-reader-shell">
        <nav className="dock glass">
          <Link href="/app">邮局</Link>
          <span>
            {letter.senderId === user.id ? "已寄出 · 不可修改" : "已送达"} · {sender.name}
          </span>
          <Link href="/app/write">再写一封</Link>
        </nav>
        <RichReader document={letter.document} />
      </main>
    );
  return (
    <main className="min-h-screen bg-[#f5efe3] px-6 py-12 text-[#2f241b]">
      <section className="mx-auto max-w-2xl rounded-[2rem] border border-[#d7c3a4] bg-[#fffaf0] p-8">
        <p className="text-sm text-[#8a6a45]">已送达 · 来自 {sender.name}</p>
        <h1 className="mt-4 text-3xl">见字如面，{user.name}</h1>
        <article className="mt-8 whitespace-pre-wrap break-words leading-8">
          {letter.content}
        </article>
        <p className="mt-8">
          你的公开邮寄号：
          <span className="select-all font-mono">{user.publicId}</span>
        </p>
        <Link className="mt-6 block underline" href="/app/contacts">
          翻开通信簿 →
        </Link>
        <Link className="mt-4 block" href="/app/settings">
          设置收信邮局 →
        </Link>
      </section>
    </main>
  );
}
