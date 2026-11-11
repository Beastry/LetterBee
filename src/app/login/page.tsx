import Link from "next/link";
import { loginAction } from "../actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-[#f5efe3] px-6 py-12 text-[#2f241b]">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-md flex-col justify-center">
        <Link href="/" className="mb-8 text-sm text-[#7d5d35]">
          ← 回到首页
        </Link>
        <div className="rounded-[2rem] border border-[#d7c3a4] bg-[#fffaf0] p-8 shadow-xl shadow-[#8a6a45]/10">
          <p className="mb-3 text-sm tracking-[0.3em] text-[#8a6a45]">登录 / 内测入口</p>
          <h1 className="text-3xl font-semibold">先给自己取一个名字</h1>
          <p className="mt-4 leading-7 text-[#6f5a43]">
            Phase 1 先用轻量开发登录跑通流程。后续会替换成邮箱、微信等正式登录方式。
          </p>

          <form action={loginAction} className="mt-8 space-y-5">
            <input type="hidden" name="next" value={params.next ?? ""} />
            <label className="block">
              <span className="text-sm font-medium text-[#5d4329]">昵称</span>
              <input
                name="name"
                required
                maxLength={24}
                placeholder="例如：新草"
                className="mt-2 w-full rounded-2xl border border-[#d7c3a4] bg-white/80 px-4 py-3 outline-none transition focus:border-[#8a6a45]"
              />
            </label>
            {params.error === "missing-name" ? (
              <p className="text-sm text-[#9f3f2f]">昵称不能为空。</p>
            ) : null}
            <button className="w-full rounded-full bg-[#6f432a] px-6 py-3 font-medium text-[#fff8ec] transition hover:bg-[#56331f]">
              进入邮局
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
