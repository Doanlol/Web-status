/**
 * =============================================================
 * Root Layout - Next.js App Router
 * =============================================================
 * Layout này bao bọc toàn bộ ứng dụng.
 * Thiết lập font chữ và màu nền chủ đạo.
 * =============================================================
 */

import type { Metadata } from "next";
import "./globals.css";

// Metadata cho trang web (hiển thị trên tab trình duyệt và SEO)
export const metadata: Metadata = {
  title: "DevOps Status Dashboard",
  description: "Monitor server metrics in real-time - CPU, RAM, Disk",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      {/*
        Màu nền #0D1117 = DevOps dark theme
        Font mono cho phong cách developer/terminal
      */}
      <body className="bg-devops-bg text-devops-text font-mono antialiased">
        {children}
      </body>
    </html>
  );
}
