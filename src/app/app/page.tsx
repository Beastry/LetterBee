import Link from "next/link";
import { redirect } from "next/navigation";
import { cityOptions } from "@/lib/cities";
import { getCurrentUser } from "@/lib/session";
import { logoutAction } from "../actions";

export default async function AppHomePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!user.cityId || !user.postOfficeId) {
    redirect("/app/settings");
  }

  const city = cityOptions.find((item) => item.id === user.cityId);
  const postOffice = city?.postOffices.find((item) => item.id === user.postOfficeId);

  return (
    <main className="min-h-screen bg-[#f5efe3] px-6 py-10 text-[#2f241b]">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-4 rounded-[2rem] border border-[#d7c3a4] bg-[#fffaf0] p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm tracking-[0.3em] text-[#8a6a45]">纸短情长邮政系统</p>
            <h1 className="mt-2 text-3xl font-semibold">晚上好，{user.name}</h1>
            <p className="mt-2 text-[#6f5a43]">
              默认收信地：{city?.name} · {postOffice?.name}
            </p>
          </div>
          <form action={logoutAction}>
            <button className="rounded-full border border-[#9b7a52] px-5 py-2 text-sm text-[#5d4329] transition hover:bg-[#fff8ec]">
              退出
            </button>
          </form>
        </header>

        <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <Link
            href="/app/write"
            className="rounded-[2rem] border border-[#d7c3a4] bg-[#fffaf0] p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-[#8a6a45]/10"
          >
            <h2 className="text-2xl font-semibold">写一封信</h2>
            <p className="mt-3 leading-7 text-[#6f5a43]">
              编辑样例信的信纸、附件和配乐。寄出和邀请仍是后面的邮政流程。
            </p>
          </Link>
          <Link
            href="/app/settings"
            className="rounded-[2rem] border border-[#d7c3a4] bg-[#fffaf0] p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-[#8a6a45]/10"
          >
            <h2 className="text-2xl font-semibold">我的邮局</h2>
            <p className="mt-3 leading-7 text-[#6f5a43]">调整常驻城市和默认收信邮局。</p>
          </Link>
          <Link
            href="/letters/sample"
            className="rounded-[2rem] border border-[#d7c3a4] bg-[#fffaf0] p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-[#8a6a45]/10"
          >
            <h2 className="text-2xl font-semibold">拆开样例信</h2>
            <p className="mt-3 leading-7 text-[#6f5a43]">先对口令，再拆开火漆，看信纸、附件和背景声。</p>
          </Link>
          <Link
            href="/app/map"
            className="rounded-[2rem] border border-[#d7c3a4] bg-[#fffaf0] p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-[#8a6a45]/10"
          >
            <h2 className="text-2xl font-semibold">邮路地图</h2>
            <p className="mt-3 leading-7 text-[#6f5a43]">查看城市邮局和未来的信件路线。</p>
          </Link>
        </section>
      </div>
    </main>
  );
}
