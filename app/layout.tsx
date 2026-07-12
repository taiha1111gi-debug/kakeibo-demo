import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import BottomNav from "@/components/BottomNav";
import { DayBoundaryProvider } from "@/components/DayBoundaryProvider";
import OfflineBanner from "@/components/OfflineBanner";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Mellow 家計簿",
    template: "%s | Mellow",
  },
  description: "支出をそっと自動でまとめる、自分専用の家計簿",
  // 個人利用アプリのため検索エンジンに載せない。robots.txtのDisallowは
  // クローラがこのnoindexを読めなくなり逆効果なので追加しないこと。
  robots: {
    index: false,
    follow: false,
  },
  applicationName: "Mellow 家計簿",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mellow",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    // iOSはSVGのapple-touch-iconを解釈できないためPNGを使う
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#23352d",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <div className="app-shell">
          <ServiceWorkerRegistration />
          <OfflineBanner />
          <DayBoundaryProvider>{children}</DayBoundaryProvider>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
