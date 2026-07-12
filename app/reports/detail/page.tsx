"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import DataState from "@/components/DataState";
import Header from "@/components/Header";
import { ReportDetailSkeleton } from "@/components/PageSkeletons";
import TransactionCard from "@/components/TransactionCard";
import { useExpenseTypes } from "@/components/DayBoundaryProvider";
import { currentMonthKey, formatCurrency, jstDateKeyOf, jstMonthKeyOf, shiftMonthKey } from "@/lib/format";
import { getSafeReturnTo } from "@/lib/navigation";
import type { ExpenseType, Transaction } from "@/lib/types";
import { useMasterData, useMonthTransactions } from "@/lib/useKakeiboData";

type Dimension = "category" | "payment" | "expense-type";

const compactCurrency = (amount: number) => {
  if (amount >= 10000) return `¥${(amount / 10000).toFixed(amount % 10000 === 0 ? 0 : 1)}万`;
  return formatCurrency(amount);
};

function ReportDetailContent() {
  const searchParams = useSearchParams();
  const returnTo = getSafeReturnTo(searchParams.get("returnTo"), "/reports");
  const { categories, paymentMethods, isLoading: isMasterLoading, error: masterError, reload: reloadMaster } = useMasterData();
  // 動的ルートだとサーバー関数のコールドスタートを踏むため、クエリパラメータで受ける
  const dimensionParam = searchParams.get("dimension");
  const dimension: Dimension | null = dimensionParam === "category" || dimensionParam === "payment" || dimensionParam === "expense-type" ? dimensionParam : null;
  const targetId = searchParams.get("id") ?? "";
  const monthParam = searchParams.get("month") ?? "";
  const selectedMonth = /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonthKey();

  // トレンド表示に必要な直近6か月だけを取得する。dimensionが不正なURLでは無駄なフェッチをしない
  const months = useMemo(
    () => (dimension ? Array.from({ length: 6 }, (_, index) => shiftMonthKey(selectedMonth, index - 5)) : []),
    [dimension, selectedMonth],
  );
  const { transactions, isLoading: isTransactionsLoading, error: transactionsError, reload } = useMonthTransactions(months);

  const isLoading = isMasterLoading || isTransactionsLoading;
  const error = masterError ?? transactionsError;
  const effectiveExpenseTypes = useExpenseTypes();

  const target = useMemo(() => {
    if (dimension === "category") {
      const category = categories.find((item) => item.id === targetId);
      return category ? { label: category.name, color: category.color, matches: (item: Transaction) => item.categoryId === category.id } : null;
    }
    if (dimension === "payment") {
      const method = paymentMethods.find((item) => item.id === targetId);
      return method ? { label: method.name, color: method.color, matches: (item: Transaction) => item.paymentMethodId === method.id } : null;
    }
    if (dimension === "expense-type") {
      const type = effectiveExpenseTypes.find((item) => item.value === targetId);
      return type ? { label: type.label, color: type.color, matches: (item: Transaction) => item.expenseType === (type.value as ExpenseType) } : null;
    }
    return null;
  }, [categories, dimension, effectiveExpenseTypes, paymentMethods, targetId]);

  const targetTransactions = target ? transactions.filter(target.matches) : [];
  const monthlyTotals = months.map((month) => ({
    month,
    amount: targetTransactions.filter((item) => jstMonthKeyOf(item.occurredAt) === month).reduce((sum, item) => sum + item.amount, 0),
  }));
  const maximum = Math.max(...monthlyTotals.map((item) => item.amount), 1);
  const sixMonthAverage = Math.round(monthlyTotals.reduce((sum, item) => sum + item.amount, 0) / monthlyTotals.length);
  const selectedTransactions = targetTransactions
    .filter((item) => jstMonthKeyOf(item.occurredAt) === selectedMonth)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const selectedTotal = selectedTransactions.reduce((sum, item) => sum + item.amount, 0);
  const [selectedYear, selectedMonthNumber] = selectedMonth.split("-").map(Number);

  const groupedTransactions = selectedTransactions.reduce<Record<string, Transaction[]>>((groups, transaction) => {
    const date = jstDateKeyOf(transaction.occurredAt);
    groups[date] = [...(groups[date] ?? []), transaction];
    return groups;
  }, {});

  return (
    <main className="page-content">
      <Header
        title={target?.label ?? "詳細レポート"}
        description={target ? `${selectedYear}年${selectedMonthNumber}月　${formatCurrency(selectedTotal)}` : undefined}
        backHref={returnTo}
      />
      <DataState loading={isLoading} error={error} onRetry={() => { void reloadMaster(); void reload(); }} skeleton={<ReportDetailSkeleton />} />

      {!isLoading && !error && !target ? (
        <div className="surface-card empty-state p-4 text-center text-xs text-[var(--muted)]">対象の集計項目が見つかりません。</div>
      ) : null}

      {!isLoading && !error && target ? (
        <>
          <section className="surface-card chart-card p-3.5">
            <div className="mb-2 flex items-end justify-between">
              <div><h2 className="text-base font-black">月別支出</h2></div>
              <div className="text-right text-[10px] font-bold text-[var(--muted)]"><p>6か月平均 {formatCurrency(sixMonthAverage)}</p><p className="mt-0.5">選択月 {formatCurrency(selectedTotal)}</p></div>
            </div>

            <div className="relative h-[190px] border-b border-[var(--line)]">
              {[0, 1, 2, 3].map((line) => (
                <span key={line} className="absolute right-0 left-0 border-t border-[var(--line)]" style={{ top: `${line * 30}%` }} />
              ))}
              <div className="pointer-events-none absolute top-6 right-1 bottom-5 left-1 z-10">
                <div className="absolute right-0 left-0 border-t-2 border-dashed" style={{ bottom: `${(sixMonthAverage / maximum) * 100}%`, borderColor: target.color }}>
                  <span className="absolute right-0 -top-4 rounded bg-[var(--surface)] px-1 text-[9px] font-black" style={{ color: target.color }}>平均 {compactCurrency(sixMonthAverage)}</span>
                </div>
              </div>
              <div className="absolute inset-0 flex items-end gap-1.5 px-1 pt-6">
                {monthlyTotals.map((item) => {
                  const isSelected = item.month === selectedMonth;
                  const monthNumber = Number(item.month.slice(5, 7));
                  return (
                    <div key={item.month} className="flex h-full min-w-0 flex-1 flex-col justify-end text-center">
                      <div className="relative flex min-h-0 flex-1 items-end justify-center">
                        <div
                          className="relative w-[70%] min-w-3 rounded-t-md transition-[height]"
                          style={{
                            height: item.amount ? `${Math.max((item.amount / maximum) * 100, 3)}%` : "2px",
                            backgroundColor: isSelected ? target.color : `${target.color}88`,
                          }}
                        >
                          <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-extrabold" style={{ color: target.color }}>
                            {compactCurrency(item.amount)}
                          </span>
                        </div>
                      </div>
                      <p className={`mt-1 text-[10px] font-extrabold ${isSelected ? "text-[var(--foreground)]" : "text-[var(--muted)]"}`}>{monthNumber}月</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="mt-3">
            <div className="mb-1.5 flex items-center justify-between px-1">
              <h2 className="text-sm font-black">{selectedMonthNumber}月の支出</h2>
              <p className="text-xs font-bold text-[var(--muted)]">{selectedTransactions.length}件</p>
            </div>
            {selectedTransactions.length ? (
              <div className="space-y-2">
                {Object.entries(groupedTransactions).sort(([a], [b]) => b.localeCompare(a)).map(([date, items]) => {
                  const dayTotal = items.reduce((sum, item) => sum + item.amount, 0);
                  return (
                    <div key={date}>
                      <div className="mb-1 flex items-center justify-between px-1 text-[10px] font-bold text-[var(--muted)]">
                        <span>{Number(date.slice(5, 7))}月{Number(date.slice(8, 10))}日</span>
                        <span>{formatCurrency(dayTotal)}</span>
                      </div>
                      <div className="space-y-1.5">{items.map((transaction) => <TransactionCard key={transaction.id} transaction={transaction} returnTo="/reports" />)}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="surface-card empty-state p-4 text-center text-xs text-[var(--muted)]">この月の支出はありません。</div>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}

export default function ReportDetailPage() {
  return <Suspense fallback={null}><ReportDetailContent /></Suspense>;
}
