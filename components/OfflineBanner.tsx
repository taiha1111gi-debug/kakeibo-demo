"use client";

import { useEffect, useState } from "react";

// SPA遷移中にオフラインになった場合の案内。初回ナビゲーションが失敗した場合はsw.jsがoffline.htmlを出す。
export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div role="status" aria-live="polite" className="fixed top-0 left-1/2 z-[70] w-full max-w-[480px] -translate-x-1/2 bg-[#8a5a26] px-4 py-2 text-center text-xs font-bold text-white">
      オフラインです。支出の閲覧・登録には通信が必要です。
    </div>
  );
}
