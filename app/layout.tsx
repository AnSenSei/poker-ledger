import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "德扑记账",
  description: "朋友局德州扑克记账工具",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "德扑记账",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#16a34a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased bg-gray-900 text-gray-100 min-h-screen">
        <ToastProvider>
          <main className="pb-20">{children}</main>
          <BottomNav />
        </ToastProvider>
      </body>
    </html>
  );
}
