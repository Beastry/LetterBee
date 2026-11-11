import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ensurePublicId, getCurrentUser } from "@/lib/session";
import { loadMailStore } from "@/lib/mail-store";

export default async function SentPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const rawUser = await getCurrentUser();
  if (!rawUser) redirect(`/login?next=${encodeURIComponent(`/app/write/sent?id=${id || ""}`)}`);
  const user = await ensurePublicId(rawUser);
  const store = await loadMailStore();
  const letter = store.letters.find(item => item.id === id && item.senderId === user.id && item.recipientId && item.status === "DELIVERED");
  if (!letter) notFound();
  const recipient = store.users[letter.recipientId!];
  return <main className="min-h-screen bg-[#f5efe3] px-6 py-12 text-[#2f241b]">
    <section className="mx-auto max-w-2xl rounded-[2rem] border border-[#d7c3a4] bg-[#fffaf0] p-8">
      <h1 className="text-3xl font-semibold">信已寄出，见字如面</h1>
      <p className="mt-6">写给 {recipient.name} 的信已送达，等候对方拆阅。</p>
      <p className="mt-4">公开邮寄号：<span className="select-all font-mono">{recipient.publicId}</span></p>
      <Link className="mt-8 block underline" href="/app/contacts">翻开通信簿 →</Link>
      <Link className="mt-4 block underline" href="/app/write">再写一封信 →</Link>
    </section>
  </main>;
}
