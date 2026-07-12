"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DataState from "@/components/DataState";
import { DAY_BOUNDARY_OPTIONS, useDayBoundary } from "@/components/DayBoundaryProvider";
import Header from "@/components/Header";
import Icon from "@/components/Icon";
import { AccountSkeleton } from "@/components/PageSkeletons";
import ExpenseTypeManager from "@/components/settings/ExpenseTypeManager";
import { CategoryManager, PaymentMethodManager } from "@/components/settings/MasterDataManager";
import { fetchTransactionCount, resetDemoData } from "@/lib/data";
import { useMasterData } from "@/lib/useKakeiboData";

export default function AccountPage() {
  const { categories, paymentMethods, isLoading, error, reload: reloadMaster } = useMasterData();
  const { hour: dayBoundaryHour, saveStatus, saveError, updateHour } = useDayBoundary();
  const [transactionCount, setTransactionCount] = useState<number | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (isLoading || error) return;
    void fetchTransactionCount().then(setTransactionCount).catch(() => setTransactionCount(null));
  }, [error, isLoading]);

  const handleReset = async () => {
    setIsResetting(true);
    await resetDemoData();
    // 全画面の状態（キャッシュ・設定）を作り直すため、リロードで再シードから始める
    window.location.assign("/");
  };

  return (
    <main className="page-content">
      <Header title="アカウント" backHref="/" />
      <DataState loading={isLoading} error={error} skeleton={<AccountSkeleton />} />

      {!isLoading && !error ? (
        <div className="space-y-2">
        <details className="group surface-card breakdown-card overflow-hidden">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-3.5 font-black [&::-webkit-details-marker]:hidden">
            <span className="flex min-w-0 items-center gap-2 text-sm">
              デモ環境
              <span className="inline-block shrink-0 rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[10px] font-black text-[var(--brand)]">架空データ</span>
            </span>
            <Icon name="chevron" className="h-4 w-4 shrink-0 text-[var(--muted)] transition-transform group-open:rotate-90" />
          </summary>
          <div className="space-y-3 border-t border-[var(--line)] p-3.5">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--brand)] text-white">
              <Icon name="user" className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">デモユーザー</p>
              <p className="text-[10px] text-[var(--muted)]">データはこのブラウザ内にのみ保存されます</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="stat-tile rounded-lg p-2"><p className="text-lg font-black">{transactionCount ?? "—"}</p><p className="text-[10px] text-[var(--muted)]">支出</p></div>
            <div className="stat-tile rounded-lg p-2"><p className="text-lg font-black">{categories.length}</p><p className="text-[10px] text-[var(--muted)]">カテゴリ</p></div>
            <div className="stat-tile rounded-lg p-2"><p className="text-lg font-black">{paymentMethods.length}</p><p className="text-[10px] text-[var(--muted)]">支払方法</p></div>
          </div>

          <div className="rounded-xl bg-[var(--brand-soft)] p-2.5 text-[10px] leading-4 font-bold text-[var(--brand)]">
            実運用版ではここにGoogleログイン・Gmail連携の設定が表示されます。公開デモでは認証と外部通信を無効化しています。
          </div>

          {confirmingReset ? (
            <div className="space-y-2 rounded-xl border border-[#ecd59d] bg-[var(--warning-soft)] p-2.5">
              <p className="text-[10px] font-bold leading-4 text-[var(--warning)]">追加・編集した内容を含め、デモデータを初期状態に戻します。よろしいですか？</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={isResetting} onClick={() => setConfirmingReset(false)} className="secondary-button w-full disabled:opacity-60">キャンセル</button>
                <button type="button" disabled={isResetting} onClick={() => void handleReset()} className="primary-button w-full disabled:opacity-60">{isResetting ? "リセット中…" : "初期状態に戻す"}</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmingReset(true)} className="secondary-button w-full">デモデータを初期状態に戻す</button>
          )}

          <Link href="/import/email" className="secondary-button w-full"><Icon name="mail" className="h-4 w-4" />カード通知の取込へ</Link>
          </div>
        </details>

        <details className="group surface-card breakdown-card overflow-hidden">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-3.5 font-black [&::-webkit-details-marker]:hidden">
            <span className="text-sm">設定</span>
            <Icon name="chevron" className="h-4 w-4 shrink-0 text-[var(--muted)] transition-transform group-open:rotate-90" />
          </summary>
          <div className="border-t border-[var(--line)] p-3.5">
            <label htmlFor="dayBoundary" className="field-label">1日の切り替え時刻（締め時刻）</label>
            <select
              id="dayBoundary"
              value={dayBoundaryHour}
              disabled={saveStatus === "saving"}
              onChange={(event) => void updateHour(Number(event.target.value)).catch(() => undefined)}
              className="field appearance-none px-2 text-xs font-bold"
            >
              {DAY_BOUNDARY_OPTIONS.map((option) => (
                <option key={option} value={option}>{option === 0 ? "0時（標準）" : `朝${option}時`}</option>
              ))}
            </select>
            <p className="mt-1 text-[10px] leading-4 text-[var(--muted)]">
              深夜の支出を前日の分として集計します。例：朝6時にすると、3日の午前2時の支出は「2日」の支出になります。
              変更すると過去の月別集計の見え方も変わります（記録された日時そのものは変わりません）。
            </p>
            {saveStatus === "saved" ? <p role="status" className="mt-1 rounded-lg bg-[var(--brand-soft)] p-2 text-xs font-bold text-[var(--brand)]">保存しました。集計を締め時刻ベースで再計算します。</p> : null}
            {saveError ? <p className="mt-1 rounded-lg bg-[var(--danger-soft)] p-2 text-xs font-bold text-[var(--danger)]">{saveError}</p> : null}
          </div>
        </details>

          <CategoryManager onChanged={() => void reloadMaster()} />
          <PaymentMethodManager onChanged={() => void reloadMaster()} />
          <ExpenseTypeManager />
        </div>
      ) : null}
    </main>
  );
}
