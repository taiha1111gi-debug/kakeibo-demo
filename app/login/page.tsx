"use client";

import { useState } from "react";
import Link from "next/link";
import { resetDemoData } from "@/lib/data";

// 本番版ではこの画面がGoogleログイン（OAuth PKCE）になる。
// 公開デモは認証を持たないため、デモの説明とリセット導線に置き換えている。
export default function DemoStartPage() {
  const [isResetting, setIsResetting] = useState(false);

  const handleRestart = async () => {
    setIsResetting(true);
    await resetDemoData();
    window.location.assign("/");
  };

  return (
    <main className="page-content flex min-h-[70vh] items-center">
      <section className="surface-card auth-card w-full space-y-3 p-4 text-center">
        <h1 className="text-2xl font-black">デモ環境について</h1>
        <p className="text-xs leading-5 text-[var(--muted)]">
          これはポートフォリオ用の公開デモです。表示されるデータはすべて架空で、
          変更内容はこのブラウザ内（localStorage）にのみ保存されます。
          外部サービスへの通信はありません。
        </p>
        <div className="rounded-xl bg-[var(--brand-soft)] p-3 text-left text-[10px] leading-4 font-bold text-[var(--brand)]">
          実運用版ではGoogleログイン・Gmail API連携・Supabase（PostgreSQL + RLS）を使用しています。
          このデモではデータ保存をブラウザ内に、メール取得をサンプル通知に置き換えています。
        </div>
        <Link href="/" className="primary-button w-full">デモを開始</Link>
        <button type="button" disabled={isResetting} onClick={() => void handleRestart()} className="secondary-button w-full disabled:opacity-60">
          {isResetting ? "リセット中…" : "デモデータを初期状態に戻す"}
        </button>
      </section>
    </main>
  );
}
