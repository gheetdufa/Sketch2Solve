import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sketch2Solve",
  description: "Visual reasoning coach for algorithmic problem solving",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
