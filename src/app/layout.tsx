import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "纸短情长",
  description: "一个模拟写信、寄信、等信、收信的 Web 端慢通讯 App。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <aside role="status" style={{ padding: "10px 20px", textAlign: "center", background: "#fff0c2", color: "#643f12", fontSize: 14, borderBottom: "1px solid #d9bc73" }}>
          功能预览版 · 数据可能延迟或丢失，请勿存放真实私信、个人资料或其他敏感内容。
        </aside>
        {children}
      </body>
    </html>
  );
}
