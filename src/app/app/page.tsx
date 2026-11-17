import Link from "next/link";
import { redirect } from "next/navigation";
import { loadMailStore } from "@/lib/mail-store";
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
  const postOffice = city?.postOffices.find(
    (item) => item.id === user.postOfficeId,
  );

  const letters = (await loadMailStore()).letters
    .filter(
      (l) =>
        l.senderId === user.id ||
        (l.recipientId === user.id && l.status === "DELIVERED"),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <main className="min-h-screen bg-[#f5efe3] px-6 py-10 text-[#2f241b]">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-4 rounded-[2rem] border border-[#d7c3a4] bg-[#fffaf0] p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm tracking-[0.3em] text-[#8a6a45]">
              纸短情长邮政系统
            </p>
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
              写给一个新的人，让邀请链接捎去第一封信。
            </p>
          </Link>
          <Link
            href="/app/settings"
            className="rounded-[2rem] border border-[#d7c3a4] bg-[#fffaf0] p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-[#8a6a45]/10"
          >
            <h2 className="text-2xl font-semibold">我的邮局</h2>
            <p className="mt-3 leading-7 text-[#6f5a43]">
              调整常驻城市和默认收信邮局。
            </p>
          </Link>
          <Link
            href="/app/contacts"
            className="rounded-[2rem] border border-[#d7c3a4] bg-[#fffaf0] p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-[#8a6a45]/10"
          >
            <h2 className="text-2xl font-semibold">通信簿</h2>
            <p className="mt-3 leading-7 text-[#6f5a43]">
              看看已经通邮的人，记下彼此的公开邮寄号。
            </p>
          </Link>
          <Link
            href="/app/map"
            className="rounded-[2rem] border border-[#d7c3a4] bg-[#fffaf0] p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-[#8a6a45]/10"
          >
            <h2 className="text-2xl font-semibold">邮路地图</h2>
            <p className="mt-3 leading-7 text-[#6f5a43]">
              查看城市邮局和未来的信件路线。
            </p>
          </Link>
        </section>
        <section className="mt-8 rounded-3xl bg-[#fffaf0] p-6">
          <h2 className="text-2xl">我的来往信件</h2>
          <ul>
            {letters.map((l) => (
              <li key={l.id} className="py-3 border-b border-[#d7c3a4]">
                <Link href={`/app/letters/${l.id}`}>
                  {l.senderId === user.id ? "寄出" : "收到"} ·{" "}
                  {l.document?.title || "一封信"}
                </Link>{" "}
                ·{" "}
                {new Date(l.createdAt).toLocaleString("zh-CN", {
                  timeZone: "Asia/Shanghai",
                })}
                （上海时区）
              </li>
            ))}
          </ul>
          {!letters.length && <p className="mt-3">还没有来往信件。</p>}
        </section>
      </div>
    </main>
  );
}
