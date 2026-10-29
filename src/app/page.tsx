import Link from "next/link";

const features = [
  "写信时文字实时落在信纸上，字数有限，表达更克制。",
  "寄信必须经过地图上的邮政局，而不是轻飘飘点一下发送。",
  "信件会根据两地距离慢慢送达，等待成为体验的一部分。",
  "打开信时能看到邮戳、路线、日期和完整的文字内容。",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f5efe3] text-[#2f241b]">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-16 md:px-10">
        <div className="grid gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div>
            <p className="mb-5 inline-flex rounded-full border border-[#b99b72]/50 bg-[#fff8ec]/80 px-4 py-2 text-sm tracking-[0.3em] text-[#7d5d35]">
              慢通讯 · 数字邮政
            </p>
            <h1 className="max-w-3xl text-5xl font-semibold tracking-tight md:text-7xl">
              纸短情长
            </h1>
            <p className="mt-6 max-w-2xl text-xl leading-9 text-[#6f5a43]">
              一个 Web 端慢通讯 App。模拟写信、寄信、等信、收信的完整邮政流程，
              让重要的话经过时间抵达。
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <a
                href="/login"
                className="rounded-full bg-[#6f432a] px-6 py-3 text-center text-base font-medium text-[#fff8ec] shadow-sm transition hover:bg-[#56331f]"
              >
                写第一封信
              </a>
              <Link
                href="/letters/sample"
                className="rounded-full border border-[#9b7a52] px-6 py-3 text-center text-base font-medium text-[#5d4329] transition hover:bg-[#fff8ec]"
              >
                拆开样例信
              </Link>
              <a
                href="/app/map"
                className="rounded-full border border-[#9b7a52] px-6 py-3 text-center text-base font-medium text-[#5d4329] transition hover:bg-[#fff8ec]"
              >
                查看邮路地图
              </a>
            </div>
          </div>

          <div className="rounded-[2rem] border border-[#d7c3a4] bg-[#fffaf0] p-6 shadow-2xl shadow-[#8a6a45]/10">
            <div className="rounded-[1.5rem] border border-dashed border-[#b99b72] bg-[#fffdf7] p-8">
              <div className="mb-8 flex items-center justify-between text-sm text-[#8a6a45]">
                <span>深圳邮政局</span>
                <span>2026.05.12</span>
              </div>
              <p className="text-2xl leading-10">
                见字如面。
                <br />
                有些话不适合秒回，它应该被写下来，被盖上邮戳，慢慢送到你手里。
              </p>
              <div className="mt-12 flex justify-end">
                <div className="flex h-24 w-24 rotate-[-8deg] items-center justify-center rounded-full border-4 border-[#9f3f2f] text-center text-sm font-semibold leading-5 text-[#9f3f2f]">
                  已投递
                  <br />
                  POSTED
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature}
              className="rounded-3xl border border-[#dec9a8] bg-[#fff8ec]/70 p-5 leading-7 text-[#6f5a43]"
            >
              {feature}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
