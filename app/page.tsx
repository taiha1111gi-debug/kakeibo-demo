"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import DataState from "@/components/DataState";
import Header from "@/components/Header";
import Icon from "@/components/Icon";
import { HomeSkeleton } from "@/components/PageSkeletons";
import SyncButton from "@/components/SyncButton";
import { useExpenseTypes } from "@/components/DayBoundaryProvider";
import { fetchUnclassifiedCount } from "@/lib/data";
import {
  currentDateKey,
  currentMonthKey,
  daysInMonth,
  formatCurrency,
  jstMonthKeyOf,
  shiftMonthKey,
} from "@/lib/format";
import { UNCLASSIFIED_CATEGORY_CODE } from "@/lib/types";
import { useMonthRange, useMonthTransactions } from "@/lib/useKakeiboData";

export default function HomePage() {
  const { months, isLoading: isRangeLoading, error: rangeError, reload: reloadRange } = useMonthRange();
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());
  const monthIndex = Math.max(0, months.indexOf(selectedMonth));
  const activeMonth = months[monthIndex] ?? currentMonthKey();
  const previousMonth = shiftMonthKey(activeMonth, -1);
  // 選択月と、前月ペース比較用の前月だけを取得する
  const monthsToFetch = useMemo(() => [activeMonth, previousMonth], [activeMonth, previousMonth]);
  const { transactions, isLoading: isTransactionsLoading, error: transactionsError, reload } = useMonthTransactions(monthsToFetch);
  const isLoading = isRangeLoading || isTransactionsLoading;
  const error = rangeError ?? transactionsError;

  const [year, month] = activeMonth.split("-").map(Number);
  const monthTransactions = transactions.filter((item) => jstMonthKeyOf(item.occurredAt) === activeMonth);
  const total = monthTransactions.reduce((sum, item) => sum + item.amount, 0);
  const previousTotal = transactions.filter((item) => jstMonthKeyOf(item.occurredAt) === previousMonth).reduce((sum, item) => sum + item.amount, 0);
  const previousMonthDays = daysInMonth(previousMonth);
  const todayKey = currentDateKey();
  const daysInActiveMonth = daysInMonth(activeMonth);
  const elapsedDays = activeMonth === todayKey.slice(0, 7)
    ? Number(todayKey.slice(8, 10))
    : activeMonth < todayKey.slice(0, 7) ? daysInActiveMonth : 0;
  const previousPaceAmount = previousMonthDays > 0 ? Math.round((previousTotal / previousMonthDays) * elapsedDays) : 0;
  const monthDifference = total - previousPaceAmount;
  const previousMonthRatio = previousPaceAmount > 0 ? (monthDifference / previousPaceAmount) * 100 : null;
  const unclassified = monthTransactions.filter((item) => item.categoryCode === UNCLASSIFIED_CATEGORY_CODE);
  const unclassifiedTotal = unclassified.reduce((sum, item) => sum + item.amount, 0);

  // 過去の月にだけ未分類が残っているケースも取りこぼさないよう、全期間の件数も軽く数える
  const [allUnclassifiedCount, setAllUnclassifiedCount] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    fetchUnclassifiedCount()
      .then((count) => {
        if (active) setAllUnclassifiedCount(count);
      })
      .catch(() => {
        // 数えられなくても当月分の警告表示は成立する
      });
    return () => {
      active = false;
    };
  }, [transactions]);
  const otherMonthsUnclassifiedCount = allUnclassifiedCount === null ? 0 : Math.max(0, allUnclassifiedCount - unclassified.length);
  const effectiveExpenseTypes = useExpenseTypes();
  // 非表示タイプでも支出が残っている月は表示する（お金を隠さない）
  const expenseTypeTotals = effectiveExpenseTypes
    .map((type) => ({
      ...type,
      amount: monthTransactions.filter((item) => item.expenseType === type.value).reduce((sum, item) => sum + item.amount, 0),
    }))
    .filter((type) => !type.hidden || type.amount > 0);
  return (
    <main className="page-content">
      <Header title={`${month}月の家計`} action={<Link href="/account" aria-label="アカウント設定" className="account-orb grid h-10 w-10 place-items-center rounded-full text-[var(--brand)]"><Icon name="user" className="h-5 w-5" /></Link>} />

      <DataState loading={isLoading} error={error} onRetry={() => { void reloadRange(); void reload(); }} skeleton={<HomeSkeleton />} />

      {!isLoading && !error ? (
        <>
          <section className="hero-card relative overflow-hidden rounded-[21px] p-3 text-white">
            <div className="absolute -top-16 -right-12 h-44 w-44 rounded-full bg-[#537b67]/45" />
            <div className="absolute right-16 -bottom-20 h-36 w-36 rounded-full bg-[#e2a85b]/12" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <button type="button" aria-label="前の月を表示" disabled={monthIndex === 0} onClick={() => setSelectedMonth(months[Math.max(0, monthIndex - 1)])} className="hero-nav-button grid h-9 w-9 place-items-center rounded-xl disabled:opacity-25">
                  <Icon name="chevron" className="h-4 w-4 rotate-180" />
                </button>
                <p className="hero-caption text-sm font-extrabold text-white/85">{year}年{month}月の支出</p>
                <button type="button" aria-label="次の月を表示" disabled={monthIndex === months.length - 1} onClick={() => setSelectedMonth(months[Math.min(months.length - 1, monthIndex + 1)])} className="hero-nav-button grid h-9 w-9 place-items-center rounded-xl disabled:opacity-25">
                  <Icon name="chevron" className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 flex items-end justify-between gap-4">
                <p className="hero-total text-[32px] leading-none font-black tracking-[-0.055em]">{formatCurrency(total)}</p>
                <span className="hero-count rounded-full px-3 py-1.5 text-xs font-bold">{monthTransactions.length}件</span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-white/15 pt-2 text-[10px] font-bold text-white/75">
                <span>前月比 {previousMonthRatio === null ? "—" : `${previousMonthRatio >= 0 ? "+" : ""}${previousMonthRatio.toFixed(1)}%`}</span>
                <span>前月ペース {formatCurrency(previousPaceAmount)}（{elapsedDays}日分）</span>
              </div>
              <div className="mt-2.5"><SyncButton /></div>
            </div>
          </section>

          {unclassified.length > 0 || otherMonthsUnclassifiedCount > 0 ? (
            <Link href={{ pathname: "/transactions/unclassified", query: { returnTo: "/" } }} className="notice-card mt-3 flex items-center gap-3 rounded-[18px] p-3 text-[var(--foreground)]">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/70 text-[var(--warning)] dark:bg-black/10"><Icon name="alert" className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[var(--warning)]">未分類の支出があります</p>
                {unclassified.length > 0 ? (
                  <p className="mt-0.5 font-black">{unclassified.length}件 ・ {formatCurrency(unclassifiedTotal)}</p>
                ) : (
                  <p className="mt-0.5 font-black">ほかの月に{otherMonthsUnclassifiedCount}件</p>
                )}
                {unclassified.length > 0 && otherMonthsUnclassifiedCount > 0 ? (
                  <p className="mt-0.5 text-[10px] font-bold text-[var(--muted)]">ほかの月にも{otherMonthsUnclassifiedCount}件あります</p>
                ) : null}
              </div>
              <Icon name="chevron" className="h-5 w-5 text-[var(--warning)]" />
            </Link>
          ) : null}

          <Link href={{ pathname: "/transactions/new", query: { returnTo: "/" } }} className="primary-button mt-3 w-full"><Icon name="plus" className="h-5 w-5" />支出を追加</Link>

          <section className="mt-2">
            <h2 className="section-heading mb-2 px-1">{month}月の内訳</h2>
            <div className="grid grid-cols-2 gap-2">
              {expenseTypeTotals.map((item) => (
                <Link
                  key={item.value}
                  href={{ pathname: "/reports/detail", query: { dimension: "expense-type", id: item.value, month: activeMonth, returnTo: "/" } }}
                  className="surface-card metric-card min-w-0 p-3 transition-transform active:scale-[0.98]"
                  style={{ "--metric-color": item.color } as CSSProperties}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="metric-dot h-2.5 w-2.5 shrink-0 rounded-full" />
                    <span className="truncate text-xs font-bold text-[var(--muted)]">{item.label}</span>
                    <span className="metric-arrow ml-auto grid h-6 w-6 shrink-0 place-items-center rounded-full"><Icon name="chevron" className="h-3.5 w-3.5 text-[var(--muted)]" /></span>
                  </div>
                  <p className="metric-amount mt-2 truncate text-lg font-black tracking-[-0.03em]">{formatCurrency(item.amount)}</p>
                </Link>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
