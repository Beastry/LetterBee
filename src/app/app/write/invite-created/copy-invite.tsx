"use client";
import { useState } from "react";
export function CopyInvite({ path }: { path: string }) {
  const [message, setMessage] = useState("");
  const [url, setUrl] = useState(path);
  async function copy() {
    const full = new URL(path, window.location.origin).href;
    setUrl(full);
    try { await navigator.clipboard.writeText(full); setMessage("已复制，把信捎给对方吧。"); }
    catch { setMessage("请选中链接手动复制。"); }
  }
  return <div className="mt-6 space-y-4"><p className="break-all select-all">{url}</p><button onClick={copy} className="rounded-full bg-[#6f432a] px-6 py-3 text-[#fff8ec]">复制收信链接</button><p role="status">{message}</p></div>;
}
