import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Poker Coach",
  description: "Play 6-max NLHE vs bots and learn from plain-language coaching.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
