import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "OUTPUT HUNT — VIYUGAM 2K26",
  description:
    "OUTPUT HUNT technical event quiz platform for VIYUGAM 2K26. Team-based competitive output-prediction contest.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#05070d] font-sans text-slate-100 antialiased">{children}</body>
    </html>
  );
}
