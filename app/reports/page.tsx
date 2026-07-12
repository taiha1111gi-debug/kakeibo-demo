"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import DataState from "@/components/DataState";
import Header from "@/components/Header";
import Icon from "@/components/Icon";
import { ReportsSkeleton } from "@/components/PageSkeletons";
import { useExpenseTypes } from "@/components/DayBoundaryProvider";
import { currentMonthKey, daysInMonth, formatCurrency } from "@/lib/format";
import { useMasterData, useMonthRange, useMonthTransactions } from "@/lib/useKakeiboData";

type BreakdownItem = { key: string; label: string; amount: number; color: string };
type Dimension = "category" | "payment" | "expense-type";

function Breakdown({ items, total, dimension, month }: { items: BreakdownItem[]; total: number; dimension: Dimension; month: string }) {
  return <div className="overflow-hidden">{items.map((item) => {
    const percentage = total > 0 ? (item.amount / total) * 100 : 0;
    return (
      <Link key={item.key} href={{ pathname: "/reports/detail", query: { dimension, id: item.key, month } }} className="breakdown-row block border-b border-[var(--line)] px-3 py-2.5 transition-colors last:border-0 active:bg-[var(--brand-soft)]" style={{ "--row-color": item.color } as CSSProperties}>
          <div className="flex items-center gap-2"><span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: item.color }} /><span className="min-w-0 flex-1 truncate text-sm font-bold">{item.label}</span><span className="shrink-0 font-black">{formatCurrency(item.amount)}</span><span className="w-11 shrink-0 text-right text-xs font-bold text-[var(--muted)]">{percentage.toFixed(1)}%</span><Icon name="chevron" className="h-4 w-4 shrink-0 text-[var(--muted)]" /></div>
          <div className="progress-track mt-1.5 ml-5 h-1.5 overflow-hidden rounded-full bg-[#e8ebe7] dark:bg-[#2d3933]"><div className="h-full rounded-full" style={{ width: `${percentage}%`, backgroundColor: item.color }} /></div>
      </Link>
    );
  })}</div>;
}

export default function ReportsPage() {
  const { months, isLoading: isRangeLoading, error: rangeError, reload: reloadRange } = useMonthRange();
  const { categories, paymentMethods, isLoading: isMasterLoading, error: masterError, reload: reloadMaster } = useMasterData();
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());
  const monthIndex = Math.max(0, months.indexOf(selectedMonth));
  const activeMonth = months[monthIndex] ?? currentMonthKey();
  const monthsToFetch = useMemo(() => [activeMonth], [activeMonth]);
  const { transactions: monthTransactions, isLoading: isTransactionsLoading, error: transactionsError, reload } = useMonthTransactions(monthsToFetch);

  const isLoading = isRangeLoading || isMasterLoading || isTransactionsLoading;
  const error = rangeError ?? masterError ?? transactionsError;
  const [year, month] = activeMonth.split("-").map(Number);
  const lastDay = daysInMonth(activeMonth);
  const total = monthTransactions.reduce((sum, item) => sum + item.amount, 0);
  const categoryItems = categories.map((category) => ({ key: category.id, label: category.name, color: category.color, amount: monthTransactions.filter((item) => item.categoryId === category.id).reduce((sum, item) => sum + item.amount, 0) })).filter((item) => item.amount > 0).sort((a, b) => b.amount - a.amount);
  const paymentItems = paymentMethods.map((method) => ({ key: method.id, label: method.name, color: method.color, amount: monthTransactions.filter((item) => item.paymentMethodId === method.id).reduce((sum, item) => sum + item.amount, 0) })).filter((item) => item.amount > 0).sort((a, b) => b.amount - a.amount);
  const effectiveExpenseTypes = useExpenseTypes();
  // 非表示タイプでも支出が残っている月は表示する（お金を隠さない）
  const expenseTypeItems = effectiveExpenseTypes
    .map((type) => ({ key: type.value, label: type.label, color: type.color, hidden: type.hidden, amount: monthTransactions.filter((item) => item.expenseType === type.value).reduce((sum, item) => sum + item.amount, 0) }))
    .filter((item) => !item.hidden || item.amount > 0);

  return (
    <main className="page-content">
      <Header title="レポート" />
      <DataState loading={isLoading} error={error} onRetry={() => { void reloadRange(); void reloadMaster(); void reload(); }} skeleton={<ReportsSkeleton />} />
      {!isLoading && !error ? <>
        <section className="surface-card month-picker mb-2 flex items-center justify-between p-1.5"><button type="button" aria-label="前の月" disabled={monthIndex === 0} onClick={() => setSelectedMonth(months[Math.max(0, monthIndex - 1)])} className="icon-button grid h-9 w-9 place-items-center rounded-lg disabled:opacity-25"><Icon name="chevron" className="h-4 w-4 rotate-180" /></button><div className="text-center"><p className="text-lg font-black">{year}年{month}月</p><p className="text-[10px] font-bold tracking-wide text-[var(--muted)]">{month}/1〜{month}/{lastDay}</p></div><button type="button" aria-label="次の月" disabled={monthIndex === months.length - 1} onClick={() => setSelectedMonth(months[Math.min(months.length - 1, monthIndex + 1)])} className="icon-button grid h-9 w-9 place-items-center rounded-lg disabled:opacity-25"><Icon name="chevron" className="h-4 w-4" /></button></section>
        <section className="report-hero mb-2 rounded-[17px] p-3.5"><div className="flex items-end justify-between"><p className="text-[30px] leading-none font-black tracking-[-0.05em]">{formatCurrency(total)}</p><p className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-xs font-bold text-white/75">{monthTransactions.length}件</p></div></section>
        <details className="group surface-card breakdown-card overflow-hidden"><summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-3.5 font-black [&::-webkit-details-marker]:hidden"><span>カテゴリ別の内訳</span><Icon name="chevron" className="h-4 w-4 text-[var(--muted)] transition-transform group-open:rotate-90" /></summary><div className="border-t border-[var(--line)]"><Breakdown items={categoryItems} total={total} dimension="category" month={activeMonth} /></div></details>
        <details className="group surface-card breakdown-card mt-2 overflow-hidden"><summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-3.5 font-black [&::-webkit-details-marker]:hidden"><span>支払方法別の内訳</span><Icon name="chevron" className="h-4 w-4 text-[var(--muted)] transition-transform group-open:rotate-90" /></summary><div className="border-t border-[var(--line)]"><Breakdown items={paymentItems} total={total} dimension="payment" month={activeMonth} /></div></details>
        <details className="group surface-card breakdown-card mt-2 overflow-hidden"><summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-3.5 font-black [&::-webkit-details-marker]:hidden"><span>支出タイプ別の内訳</span><Icon name="chevron" className="h-4 w-4 text-[var(--muted)] transition-transform group-open:rotate-90" /></summary><div className="border-t border-[var(--line)]"><Breakdown items={expenseTypeItems} total={total} dimension="expense-type" month={activeMonth} /></div></details>
      </> : null}
    </main>
  );
}
