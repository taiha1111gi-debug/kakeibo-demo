"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import DataState from "@/components/DataState";
import Header from "@/components/Header";
import { CalendarSkeleton } from "@/components/PageSkeletons";
import TransactionCalendar from "@/components/TransactionCalendar";
import { useCalendarTypes, useExpenseTypes } from "@/components/DayBoundaryProvider";
import { restoreTransaction, softDeleteTransaction } from "@/lib/data";
import { currentMonthKey, formatCurrency, jstMonthKeyOf } from "@/lib/format";
import type { ExpenseType, Transaction } from "@/lib/types";
import { useMonthTransactions } from "@/lib/useKakeiboData";

function TransactionsContent() {
  // 編集画面から戻ったとき、開いていた日へスクロール復元するために ?date=YYYY-MM-DD を受け取る
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");
  const initialDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : null;

  const [calendarMonth, setCalendarMonth] = useState(initialDate ? initialDate.slice(0, 7) : currentMonthKey());
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate);

  const monthsToFetch = useMemo(() => [calendarMonth], [calendarMonth]);
  const { transactions, isLoading, error, reload } = useMonthTransactions(monthsToFetch);

  // 表示する内訳（支出タイプ）のフィルタ。null = すべて。マスの合計・月合計・明細の全部に効く
  const effectiveTypes = useExpenseTypes();
  const { calendarTypes, updateCalendarTypes } = useCalendarTypes();
  const [filterBusy, setFilterBusy] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);
  const activeSet = new Set<ExpenseType>(calendarTypes ?? effectiveTypes.map((type) => type.value));
  const calendarTransactions = transactions.filter(
    (transaction) => jstMonthKeyOf(transaction.occurredAt) === calendarMonth && activeSet.has(transaction.expenseType),
  );

  const toggleType = async (value: ExpenseType) => {
    const isOn = activeSet.has(value);
    if (isOn && activeSet.size <= 1) {
      setFilterError("最低1つの内訳は表示してください。");
      return;
    }
    const next = effectiveTypes.map((type) => type.value).filter((candidate) => (candidate === value ? !isOn : activeSet.has(candidate)));
    setFilterBusy(true);
    setFilterError(null);
    try {
      await updateCalendarTypes(next.length === effectiveTypes.length ? null : next);
    } catch (nextError) {
      setFilterError(nextError instanceof Error ? nextError.message : "設定を保存できませんでした。");
    } finally {
      setFilterBusy(false);
    }
  };

  // スワイプ削除と「元に戻す」
  const [undoTarget, setUndoTarget] = useState<{ id: string; label: string } | null>(null);
  const [undoError, setUndoError] = useState<string | null>(null);
  const undoTimerRef = useRef<number | null>(null);
  const clearUndoTimer = () => {
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    undoTimerRef.current = null;
  };
  useEffect(() => clearUndoTimer, []);

  const handleDelete = async (transaction: Transaction) => {
    setUndoError(null);
    try {
      await softDeleteTransaction(transaction.id);
      setUndoTarget({ id: transaction.id, label: `${transaction.categoryName}・${formatCurrency(transaction.amount)}` });
      clearUndoTimer();
      undoTimerRef.current = window.setTimeout(() => setUndoTarget(null), 6000);
      void reload();
    } catch (nextError) {
      setUndoError(nextError instanceof Error ? nextError.message : "削除に失敗しました。");
      clearUndoTimer();
      undoTimerRef.current = window.setTimeout(() => setUndoError(null), 6000);
    }
  };

  const handleUndo = async () => {
    if (!undoTarget) return;
    try {
      await restoreTransaction(undoTarget.id);
      clearUndoTimer();
      setUndoTarget(null);
      void reload();
    } catch (nextError) {
      setUndoError(nextError instanceof Error ? nextError.message : "元に戻せませんでした。");
    }
  };

  return (
    <main className="page-content">
      {isLoading || error ? <Header title="カレンダー" /> : null}
      <DataState loading={isLoading} error={error} onRetry={() => void reload()} skeleton={<CalendarSkeleton />} />
      {!isLoading && !error ? (
        <TransactionCalendar
          monthKey={calendarMonth}
          transactions={calendarTransactions}
          onMonthChange={setCalendarMonth}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onDelete={(transaction) => void handleDelete(transaction)}
          stickyHeader={
            <>
              <Header title="カレンダー" />
              {/* 4項目を必ず1行に収める（各チップが等幅で縮み、長い表示名は省略される） */}
              <div className="mb-2 flex gap-1" role="group" aria-label="表示する内訳">
                {effectiveTypes.map((type) => {
                  const on = activeSet.has(type.value);
                  return (
                    <button
                      key={type.value}
                      type="button"
                      aria-pressed={on}
                      disabled={filterBusy}
                      onClick={() => void toggleType(type.value)}
                      className={`flex min-h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-full border px-1.5 text-[10px] font-extrabold disabled:opacity-60 ${on ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]"}`}
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: on ? "#fff" : type.color }} />
                      <span className="truncate">{type.label}</span>
                    </button>
                  );
                })}
              </div>
              {filterError ? <p className="mb-2 rounded-lg bg-[var(--danger-soft)] p-2 text-xs font-bold text-[var(--danger)]">{filterError}</p> : null}
            </>
          }
        />
      ) : null}

      {undoTarget || undoError ? (
        <div role="status" aria-live="polite" className="fixed bottom-[calc(84px+env(safe-area-inset-bottom))] left-1/2 z-[60] flex w-[calc(100%-24px)] max-w-[456px] -translate-x-1/2 items-center justify-between gap-2 rounded-xl bg-[#26332c] p-2.5 text-xs font-bold text-white shadow-lg">
          <span className="min-w-0 truncate">{undoError ?? `${undoTarget?.label} を削除しました`}</span>
          {undoTarget && !undoError ? (
            <button type="button" onClick={() => void handleUndo()} className="shrink-0 rounded-lg bg-white/15 px-3 py-1.5 font-black">
              元に戻す
            </button>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}

export default function TransactionsPage() {
  return <Suspense fallback={null}><TransactionsContent /></Suspense>;
}
