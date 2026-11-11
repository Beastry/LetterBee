import Link from "next/link";
import { cookies } from "next/headers";
import { ensurePublicId, getCurrentUser } from "@/lib/session";
import { getInvitationByToken } from "@/lib/mail-store";
import { buildInvitePreview, evaluateInviteAccess } from "@/lib/invite";
import { claimInviteAction, verifyInvitePassphraseAction } from "../actions";

const messages: Record<string, string> = { expired: "这封信的邀请已过期，请寄信人重新捎来邀请。", claimed: "这封信已经被认领，链接不能再次使用。", rejected: "这封信已被拒收，邀请已封存。", bad_passphrase: "口令不对，请再核对一下。", self: "这是你寄出的信，请把链接捎给收信人。", blocked: "你们之间已停止通邮，不能认领这封信。", invalid: "请重新选择收信方式。" };
export default async function InvitePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const record = await getInvitationByToken(token);
  const { error } = await searchParams;
  const rawUser = await getCurrentUser();
  const user = rawUser ? await ensurePublicId(rawUser) : null;
  const jar = await cookies();
  const verified = !!record?.invitation.passphraseHash && jar.get(`invite_${token}`)?.value === record.invitation.passphraseHash;
  const access = record ? evaluateInviteAccess({ invitation: { ...record.invitation, passphraseHash: verified ? null : record.invitation.passphraseHash } }) : null;
  const preview = record ? buildInvitePreview({ invitation: record.invitation, inviterName: record.inviter.name }) : null;
  const active = access?.ok || access?.reason === "bad_passphrase";
  return <main className="min-h-screen bg-[#f5efe3] px-6 py-12 text-[#2f241b]"><section className="mx-auto max-w-2xl rounded-[2rem] border border-[#d7c3a4] bg-[#fffaf0] p-8">
    <p className="mb-4 text-sm tracking-widest text-[#8a6a45]">纸短情长 · 收信处</p><h1 className="text-3xl font-semibold">{preview?.title || "这封邀请不存在"}</h1>
    {preview && <p className="mt-4 leading-7">{preview.description}</p>}
    {error && <p role="alert" className="mt-4 text-[#9f3f2f]">{messages[error] || "未能收信，请再试一次。"}</p>}
    {access && !active && <p className="mt-6">{messages[access.reason]}</p>}
    {active && record && <>
      {access?.canRevealContent ? <article className="mt-8 whitespace-pre-wrap break-words rounded-xl border border-[#d7c3a4] p-6 leading-8">{record.letter.content}</article> : <form action={verifyInvitePassphraseAction} className="mt-6 space-y-4"><input type="hidden" name="token" value={token} /><label className="block">先对口令，再拆信<input name="passphrase" type="password" required maxLength={128} className="mt-2 block w-full rounded-xl border border-[#d7c3a4] p-3" /></label><button className="rounded-full bg-[#6f432a] px-6 py-3 text-[#fff8ec]">核对口令</button></form>}
      {!user ? <Link className="mt-8 block underline" href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}>登记 / 登录，认领这封信</Link> : user.id === record.invitation.inviterId ? <p className="mt-6">这是你寄出的信，请把链接捎给收信人。</p> : <form action={claimInviteAction} className="mt-8 space-y-4">
        <input type="hidden" name="token" value={token} />
        <p>以「{user.name}」收信。接收后，双方会进入彼此的通信簿。</p>
        {record.invitation.passphraseHash && <label className="block">认领时请确认收信口令<input name="passphrase" type="password" required maxLength={128} className="mt-2 block w-full rounded-xl border border-[#d7c3a4] p-3" /></label>}
        <div className="flex flex-wrap gap-4"><button name="choice" value="accept" className="rounded-full bg-[#6f432a] px-6 py-3 text-[#fff8ec]">接收并允许后续来信</button><button name="choice" value="block" className="rounded-full border border-[#d7c3a4] px-6 py-3">拒收并屏蔽</button></div>
      </form>}
    </>}
    <Link href="/app/contacts" className="mt-8 block text-sm text-[#7d5d35]">前往我的通信簿 →</Link>
  </section></main>;
}
