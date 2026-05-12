import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export default async function WritePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-[#f5efe3] px-6 py-12 text-[#2f241b]">
      <div className="mx-auto max-w-4xl">
        <Link href="/app" className="text-sm text-[#7d5d35]">
          ← 回到工作台
        </Link>
        <div className="mt-8 rounded-[2rem] border border-[#d7c3a4] bg-[#fffaf0] p-8">
          <p className="mb-3 text-sm tracking-[0.3em] text-[#8a6a45]">写信台</p>
          <h1 className="text-3xl font-semibold">写第一封信</h1>
          <p className="mt-4 leading-7 text-[#6f5a43]">
            Phase 2 会在这里实现字数限制、实时信纸预览和邀请收件人。
          </p>
        </div>
      </div>
    </main>
  );
}
