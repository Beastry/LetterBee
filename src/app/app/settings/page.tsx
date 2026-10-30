import Link from "next/link";
import { redirect } from "next/navigation";
import { cityOptions } from "@/lib/cities";
import { ensurePublicId, getCurrentUser } from "@/lib/session";
import { saveProfileAction } from "../../actions";
import { PublicIdCard } from "./public-id-card";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [rawUser, params] = await Promise.all([getCurrentUser(), searchParams]);

  if (!rawUser) {
    redirect("/login");
  }

  const user = await ensurePublicId(rawUser);

  const selectedCity =
    cityOptions.find((city) => city.id === user.cityId) ?? cityOptions[0];
  const selectedPostOffice =
    selectedCity.postOffices.find((postOffice) => postOffice.id === user.postOfficeId) ??
    selectedCity.postOffices[0];

  return (
    <main className="min-h-screen bg-[#f5efe3] px-6 py-12 text-[#2f241b]">
      <div className="mx-auto max-w-3xl">
        <Link href="/app" className="text-sm text-[#7d5d35]">
          ← 回到工作台
        </Link>
        <div className="mt-8 rounded-[2rem] border border-[#d7c3a4] bg-[#fffaf0] p-8 shadow-xl shadow-[#8a6a45]/10">
          <p className="mb-3 text-sm tracking-[0.3em] text-[#8a6a45]">我的邮局</p>
          <h1 className="text-3xl font-semibold">设置默认收信位置</h1>
          <p className="mt-4 leading-7 text-[#6f5a43]">
            第一版只精确到城市和邮政局，不记录真实门牌地址。后续寄给你的信会默认送到这里。
          </p>

          <PublicIdCard publicId={user.publicId} />

          <form action={saveProfileAction} className="mt-8 space-y-6">
            <label className="block">
              <span className="text-sm font-medium text-[#5d4329]">常驻城市</span>
              <select
                name="cityId"
                defaultValue={selectedCity.id}
                className="mt-2 w-full rounded-2xl border border-[#d7c3a4] bg-white/80 px-4 py-3 outline-none transition focus:border-[#8a6a45]"
              >
                {cityOptions.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.country} · {city.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-[#5d4329]">默认邮政局</span>
              <select
                name="postOfficeId"
                defaultValue={selectedPostOffice.id}
                className="mt-2 w-full rounded-2xl border border-[#d7c3a4] bg-white/80 px-4 py-3 outline-none transition focus:border-[#8a6a45]"
              >
                {cityOptions.flatMap((city) =>
                  city.postOffices.map((postOffice) => (
                    <option key={postOffice.id} value={postOffice.id}>
                      {city.name} · {postOffice.name}
                    </option>
                  )),
                )}
              </select>
              <p className="mt-2 text-sm text-[#8a6a45]">
                现在先列出全部邮局；后续会做成选择城市后联动过滤。
              </p>
            </label>

            {params.error ? <p className="text-sm text-[#9f3f2f]">{params.error}</p> : null}

            <button className="rounded-full bg-[#6f432a] px-6 py-3 font-medium text-[#fff8ec] transition hover:bg-[#56331f]">
              保存并进入工作台
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
