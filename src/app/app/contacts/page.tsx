import Link from "next/link";
import { redirect } from "next/navigation";
import { ensurePublicId, getCurrentUser } from "@/lib/session";
import { listRelationshipsForUser } from "@/lib/mail-store";

export default async function ContactsPage() {
  const rawUser = await getCurrentUser();
  if (!rawUser) redirect("/login?next=/app/contacts");
  const user = await ensurePublicId(rawUser);
  const relationships = await listRelationshipsForUser(user.id);

  return (
    <main className="min-h-screen bg-[#f5efe3] px-6 py-12 text-[#2f241b]">
      <div className="mx-auto max-w-2xl">
        <Link href="/app">← 回到邮局</Link>
        <section className="mt-8 rounded-[2rem] border border-[#d7c3a4] bg-[#fffaf0] p-8">
          <h1 className="text-3xl font-semibold">通信簿</h1>
          <p className="mt-4">每一次认领，都是一段通信的开始。</p>
          {relationships.length ? (
            <ul className="mt-6 space-y-4">
              {relationships.map(({ id, contact }) => (
                <li key={id} className="rounded-xl border border-[#d7c3a4] p-4">
                  <p>{contact.name}</p>
                  <p className="mt-2 select-all font-mono">公开邮寄号：{contact.publicId}</p>
                  <Link className="mt-3 inline-block underline" href={`/app/write?to=${encodeURIComponent(contact.publicId)}`}>写信 →</Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-[#8a6a45]">还没有通邮的人。先给一个新的人写封信吧。</p>
          )}
          <Link href="/app/write?mode=new" className="mt-8 block underline">
            写给一个新的人 →
          </Link>
        </section>
      </div>
    </main>
  );
}
