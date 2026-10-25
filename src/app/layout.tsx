import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dai 🎀 | 너만의 AI",
  description: "Drawing 생태계의 귀엽고 친근한 AI, 다이",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
