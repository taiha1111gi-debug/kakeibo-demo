import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import BottomNav from "@/components/BottomNav";
import { DayBoundaryProvider } from "@/components/DayBoundaryProvider";
import OfflineBanner from "@/components/OfflineBanner";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Mellow 家計簿（デモ）",
    template: "%s | Mellow",
  },
  description: "支出をそっと自動でまとめる家計簿の公開デモ。データはすべて架空で、ブラウザ内にのみ保存されます。",
  // 公開デモは見つけてもらうためのものなので、本番と違いnoindexは付けない
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
          <p className="mx-auto mt-2 w-fit max-w-full rounded-full bg-[var(--brand-soft)] px-3 py-1 text-center text-[10px] font-bold text-[var(--brand)]">
            公開デモ：データはすべて架空・保存はこのブラウザ内のみ
          </p>
          <DayBoundaryProvider>{children}</DayBoundaryProvider>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
