"use client";

import { useState } from "react";

export function PublicIdCard({ publicId }: { publicId: string }) {
  const [message, setMessage] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(publicId);
      setMessage("已复制，捎给熟人吧。");
    } catch {
      setMessage("未能复制，请长按或选中邮寄号复制。");
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-[#d7c3a4] bg-white/50 p-5">
      <h2 className="text-sm font-medium text-[#5d4329]">你的公开邮寄号</h2>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <span className="select-all font-mono text-xl tracking-widest">{publicId}</span>
        <button
          type="button"
          onClick={copy}
          className="rounded-full border border-[#d7c3a4] px-4 py-2 text-sm text-[#6f432a] transition hover:bg-[#f5efe3]"
        >
          复制
        </button>
      </div>
      <p className="mt-3 text-sm text-[#8a6a45]">熟人可以用这个号给你写信。</p>
      {message ? (
        <p role="status" className="mt-2 text-sm text-[#8a6a45]">
          {message}
        </p>
      ) : null}
    </section>
  );
}
