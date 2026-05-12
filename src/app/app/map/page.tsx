import Link from "next/link";
import { redirect } from "next/navigation";
import { cityOptions } from "@/lib/cities";
import { getCurrentUser } from "@/lib/session";

export default async function MapPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-[#f5efe3] px-6 py-12 text-[#2f241b]">
      <div className="mx-auto max-w-5xl">
        <Link href="/app" className="text-sm text-[#7d5d35]">
          ← 回到工作台
        </Link>
        <div className="mt-8 rounded-[2rem] border border-[#d7c3a4] bg-[#fffaf0] p-8">
          <p className="mb-3 text-sm tracking-[0.3em] text-[#8a6a45]">邮路地图</p>
          <h1 className="text-3xl font-semibold">已开放邮政局</h1>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {cityOptions.map((city) => (
              <div key={city.id} className="rounded-3xl border border-[#dec9a8] bg-white/60 p-5">
                <h2 className="text-xl font-semibold">{city.name}</h2>
                <p className="mt-2 text-sm text-[#8a6a45]">
                  {city.latitude}, {city.longitude}
                </p>
                <p className="mt-3 text-[#6f5a43]">{city.postOffices[0]?.name}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
