import type { Metadata } from "next";
import "./globals.css";
import "./drawing-id.css";
import DrawingIdAuth from "@/components/DrawingIdAuth";

export const metadata: Metadata = {
  title: "Dai | Drawing AI",
  description: "Drawing Music과 Drawing Verse를 위한 AI 어시스턴트, 다이",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}<DrawingIdAuth /></body>
    </html>
  );
}
