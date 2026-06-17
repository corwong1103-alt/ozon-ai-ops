import type { Metadata } from "next";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ozon AI Ops",
  description: "Private Ozon cross-border AI operations SaaS."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
