import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getInvitationByToken } from "@/lib/mail-store";
import { CopyInvite } from "./copy-invite";
export default async function InviteCreatedPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { token } = await searchParams;
  const record = token ? await getInvitationByToken(token) : null;
  if (!record || record.invitation.inviterId !== user.id) notFound();
  return <main className="min-h-screen bg-[#f5efe3] px-6 py-12 text-[#2f241b]"><section className="mx-auto max-w-2xl rounded-[2rem] border border-[#d7c3a4] bg-[#fffaf0] p-8"><h1 className="text-3xl">信已封好，等你捎出</h1><p className="mt-4">链接仅能认领一次，有效至 {new Date(record.invitation.expiresAt!).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}。若设了口令，记得另外告知对方。</p><CopyInvite path={`/invite/${token}`} /><Link className="mt-6 block" href="/app">回到邮局</Link></section></main>;
}
