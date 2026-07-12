"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import DataState from "@/components/DataState";
import Header from "@/components/Header";
import { TransactionListSkeleton } from "@/components/PageSkeletons";
import TransactionCard from "@/components/TransactionCard";
import { formatCurrency } from "@/lib/format";
import { getSafeReturnTo } from "@/lib/navigation";
import { useUnclassifiedTransactions } from "@/lib/useKakeiboData";

function UnclassifiedContent() {
  const searchParams = useSearchParams();
  // ホーム(returnTo=/)からもカレンダーからも来るので、戻り先を引き継ぐ
  const returnTo = getSafeReturnTo(searchParams.get("returnTo"), "/transactions");
  const selfPath = `/transactions/unclassified?returnTo=${encodeURIComponent(returnTo)}`;
  const { transactions, isLoading, error, reload } = useUnclassifiedTransactions();
  const total = transactions.reduce((sum, item) => sum + item.amount, 0);

  return (
    <main className="page-content">
      <Header title="未分類" backHref={returnTo} />
      <DataState loading={isLoading} error={error} onRetry={() => void reload()} skeleton={<TransactionListSkeleton />} />
      {!isLoading && !error ? (
        <>
          <section className="notice-card mb-2 rounded-[17px] p-3.5">
            <p className="text-xs font-bold text-[var(--warning)]">未分類の合計</p>
            <div className="mt-1 flex items-end justify-between"><p className="text-2xl font-black">{formatCurrency(total)}</p><p className="rounded-full bg-white/65 px-3 py-1 text-xs font-extrabold text-[var(--warning)] dark:bg-black/10">{transactions.length}件</p></div>
          </section>
          <div className="space-y-1.5">{transactions.length ? transactions.map((transaction) => <TransactionCard key={transaction.id} transaction={transaction} returnTo={selfPath} />) : <div className="surface-card empty-state p-4 text-center text-xs text-[var(--muted)]">未分類の支出はありません。</div>}</div>
        </>
      ) : null}
    </main>
  );
}

export default function UnclassifiedPage() {
  return <Suspense fallback={null}><UnclassifiedContent /></Suspense>;
}
