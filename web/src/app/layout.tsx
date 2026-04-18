import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DevOps Status Dashboard",
  description: "Monitor your servers in realtime",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <head>
        {/* Import font Fira Code từ Google Fonts để có kiểu chữ dev */}
        <link
          href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-devops-bg text-devops-text font-mono antialiased">
        {children}
      </body>
    </html>
  );
}
