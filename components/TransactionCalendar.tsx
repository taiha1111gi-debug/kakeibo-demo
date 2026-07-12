"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { daysInMonth, formatCurrency, jstDateKeyOf, shiftMonthKey } from "@/lib/format";
import type { Transaction } from "@/lib/types";

const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

const formatDayAmount = (amount: number) => amount.toLocaleString("ja-JP");

const dayOf = (occurredAt: string) => Number(jstDateKeyOf(occurredAt).slice(8, 10));

const toDateKey = (monthKey: string, day: number) => `${monthKey}-${String(day).padStart(2, "0")}`;

// 締め時刻を考慮した「会計上の日付キー」から見出し用の曜日を出す
const weekdayOfDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).getDay();
};

// スワイプで現れる削除ボタンの幅
const DELETE_WIDTH = 76;

type TransactionCalendarProps = {
  monthKey: string;
  // monthKeyの月の支出だけを渡す（親が月単位で取得し、表示フィルタも適用済み）
  transactions: Transaction[];
  onMonthChange: (monthKey: string) => void;
  // 選択日は "YYYY-MM-DD"。編集画面から戻ったとき同じ位置へ戻れるよう、親（URL）が保持する
  selectedDate: string | null;
  onSelectDate: (dateKey: string) => void;
  // 行の左スワイプ→削除ボタンで呼ばれる（削除の実行とUndoは親が担当）
  onDelete: (transaction: Transaction) => void;
  // カレンダーと一緒に上部固定したい要素（ページタイトル・表示フィルタなど）
  stickyHeader?: React.ReactNode;
};

export default function TransactionCalendar({ monthKey, transactions, onMonthChange, selectedDate, onSelectDate, onDelete, stickyHeader }: TransactionCalendarProps) {
  const stickyRef = useRef<HTMLDivElement | null>(null);
  const [year, month] = monthKey.split("-").map(Number);
  const dayCount = daysInMonth(monthKey);
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const selectedDay = selectedDate?.startsWith(`${monthKey}-`) ? Number(selectedDate.slice(8, 10)) : null;

  // スワイプ削除の状態。一度に開けるのは1行だけ
  const [openId, setOpenId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number } | null>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; horizontal: boolean | null; baseOffset: number; lastX: number } | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    // データが入れ替わったら（削除・月移動・再取得）開いている行をリセットする
    setOpenId(null);
    setDrag(null);
  }, [transactions]);

  const totalsByDay = useMemo(() => {
    return transactions.reduce<Record<number, number>>((totals, transaction) => {
      const day = dayOf(transaction.occurredAt);
      totals[day] = (totals[day] ?? 0) + transaction.amount;
      return totals;
    }, {});
  }, [transactions]);

  // 月全体の明細を日付ごとにまとめる（新しい日が上）
  const dayGroups = useMemo(() => {
    const byDate = new Map<string, Transaction[]>();
    for (const transaction of transactions) {
      const dateKey = jstDateKeyOf(transaction.occurredAt);
      const bucket = byDate.get(dateKey);
      if (bucket) {
        bucket.push(transaction);
      } else {
        byDate.set(dateKey, [transaction]);
      }
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dateKey, items]) => ({
        dateKey,
        items: [...items].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
        total: items.reduce((sum, item) => sum + item.amount, 0),
      }));
  }, [transactions]);

  const monthTotal = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);

  const scrollToDate = (dateKey: string, smooth: boolean) => {
    const target = document.getElementById(`calendar-day-${dateKey}`);
    if (!target) return;
    // タイトル・フィルタ・カレンダーが上部に固定されるため、その高さぶん下げた位置へスクロールする
    const stickyOffset = (stickyRef.current?.offsetHeight ?? 0) + 8;
    const top = target.getBoundingClientRect().top + window.scrollY - stickyOffset;
    window.scrollTo({ top: Math.max(0, top), behavior: smooth ? "smooth" : "auto" });
  };

  const handleDayTap = (day: number) => {
    const dateKey = toDateKey(monthKey, day);
    onSelectDate(dateKey);
    scrollToDate(dateKey, true);
  };

  // 編集画面から?date=付きで戻ってきたとき、開いていた日の位置を復元する（初回のみ・アニメなし）
  const didInitialScroll = useRef(false);
  useEffect(() => {
    if (didInitialScroll.current || !dayGroups.length) return;
    didInitialScroll.current = true;
    if (selectedDate?.startsWith(`${monthKey}-`)) scrollToDate(selectedDate, false);
  }, [dayGroups.length, monthKey, selectedDate]);

  const handleRowTouchStart = (id: string) => (event: React.TouchEvent) => {
    const touch = event.touches[0];
    dragRef.current = {
      id,
      startX: touch.clientX,
      startY: touch.clientY,
      horizontal: null,
      baseOffset: openId === id ? -DELETE_WIDTH : 0,
      lastX: openId === id ? -DELETE_WIDTH : 0,
    };
    suppressClickRef.current = false;
    if (openId && openId !== id) setOpenId(null);
  };

  const handleRowTouchMove = (id: string) => (event: React.TouchEvent) => {
    const state = dragRef.current;
    if (!state || state.id !== id) return;
    const touch = event.touches[0];
    const dx = touch.clientX - state.startX;
    const dy = touch.clientY - state.startY;
    if (state.horizontal === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      // 最初の動きの向きで「横スワイプ」か「縦スクロール」かを決める（誤爆防止）
      state.horizontal = Math.abs(dx) > Math.abs(dy);
    }
    if (!state.horizontal) return;
    suppressClickRef.current = true;
    const x = Math.min(0, Math.max(-DELETE_WIDTH, state.baseOffset + dx));
    state.lastX = x;
    setDrag({ id, x });
  };

  const handleRowTouchEnd = (id: string) => () => {
    const state = dragRef.current;
    dragRef.current = null;
    if (!state || state.id !== id) return;
    if (state.horizontal) {
      setOpenId(state.lastX < -DELETE_WIDTH / 2 ? id : null);
    }
    setDrag(null);
  };

  const handleRowClickCapture = (event: React.MouseEvent) => {
    // スワイプ直後のタップや、削除ボタンが開いている間は編集画面へ遷移させない
    if (suppressClickRef.current || openId) {
      event.preventDefault();
      event.stopPropagation();
      suppressClickRef.current = false;
      if (openId) setOpenId(null);
    }
  };

  const rowOffset = (id: string) => {
    if (drag?.id === id) return drag.x;
    return openId === id ? -DELETE_WIDTH : 0;
  };

  const dayTone = (amount: number, selected: boolean) => {
    if (selected) return "bg-[var(--brand-deep)] text-white ring-2 ring-[var(--brand-deep)] ring-offset-2 ring-offset-[var(--surface)]";
    if (amount >= 5000) return "bg-[#47725d] text-white";
    if (amount >= 2000) return "bg-[#cfe3d8] text-[#234735] dark:bg-[#315343] dark:text-white";
    if (amount > 0) return "bg-[var(--brand-soft)] text-[var(--brand)]";
    return "bg-transparent text-[var(--muted)]";
  };

  const headerDayClass = (dateKey: string) => {
    const weekday = weekdayOfDateKey(dateKey);
    if (weekday === 0) return "text-[#c86b6b]";
    if (weekday === 6) return "text-[#5b83bd]";
    return "";
  };

  return (
    <div className="space-y-2">
      {/* ページ左右の余白(10px)いっぱいに広げて、下の明細が透けないよう背景色で覆う */}
      <div ref={stickyRef} className="sticky-top-shell z-20 -mx-2.5 bg-[var(--background)] px-2.5 pb-2">
      {stickyHeader}
      <section className="surface-card calendar-card overflow-hidden p-2.5">
        <div className="flex items-center justify-between pb-1.5">
          <button
            type="button"
            onClick={() => onMonthChange(shiftMonthKey(monthKey, -1))}
            aria-label="前の月"
            className="icon-button grid h-8 w-8 place-items-center rounded-lg"
          >
            <Icon name="chevron" className="h-4 w-4 rotate-180" />
          </button>
          <div className="text-center">
            <h2 className="text-base font-black">{year}年{month}月</h2>
            <p className="text-[10px] font-bold text-[var(--muted)]">合計 {formatCurrency(monthTotal)}</p>
          </div>
          <button
            type="button"
            onClick={() => onMonthChange(shiftMonthKey(monthKey, 1))}
            aria-label="次の月"
            className="icon-button grid h-8 w-8 place-items-center rounded-lg"
          >
            <Icon name="chevron" className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {weekdays.map((weekday, index) => (
            <div
              key={weekday}
              className={`pb-0.5 text-center text-[10px] font-extrabold ${
                index === 0 ? "text-[#c86b6b]" : index === 6 ? "text-[#5b83bd]" : "text-[var(--muted)]"
              }`}
            >
              {weekday}
            </div>
          ))}
          {Array.from({ length: firstWeekday }).map((_, index) => (
            <span key={`blank-${index}`} aria-hidden="true" />
          ))}
          {Array.from({ length: dayCount }, (_, index) => index + 1).map((day) => {
            const amount = totalsByDay[day] ?? 0;
            const selected = selectedDay === day;
            return (
              <button
                key={day}
                type="button"
                onClick={() => handleDayTap(day)}
                aria-label={`${month}月${day}日 ${amount ? formatCurrency(amount) : "支出なし"}の明細へ移動`}
                className={`calendar-day ${amount ? "calendar-day-filled" : ""} flex min-h-[38px] flex-col items-center justify-center rounded-lg px-0.5 transition-all active:scale-95 ${dayTone(amount, selected)}`}
              >
                <span className="text-[11px] leading-none font-black">{day}</span>
                <span className="mt-0.5 min-h-2.5 whitespace-nowrap text-[9px] leading-none font-extrabold tracking-[-0.05em]">
                  {amount ? formatDayAmount(amount) : ""}
                </span>
              </button>
            );
          })}
        </div>
      </section>
      </div>

      {dayGroups.length ? (
        <section className="surface-card overflow-hidden" aria-label={`${month}月の全明細`}>
          {dayGroups.map((group) => {
            const [, groupMonth, groupDay] = group.dateKey.split("-").map(Number);
            return (
              <div key={group.dateKey} id={`calendar-day-${group.dateKey}`}>
                <div className="flex items-center justify-between border-t border-[var(--line)] bg-black/[0.035] px-3 py-1.5 first:border-t-0 dark:bg-white/[0.05]">
                  <span className={`text-[11px] font-black ${headerDayClass(group.dateKey)}`}>
                    {groupMonth}月{groupDay}日（{weekdays[weekdayOfDateKey(group.dateKey)]}）
                  </span>
                  <span className="text-[11px] font-black text-[var(--muted)]">{formatCurrency(group.total)}</span>
                </div>
                <div className="divide-y divide-[var(--line)]">
                  {group.items.map((transaction) => {
                    const merchant = transaction.normalizedMerchantName || transaction.rawMerchantName;
                    const merchantLabel = merchant && merchant !== "手動支出" ? merchant : "";
                    const rowLabel = `${transaction.categoryName} ${formatCurrency(transaction.amount)}`;
                    return (
                      <div key={transaction.id} className="relative touch-pan-y overflow-hidden">
                        <button
                          type="button"
                          tabIndex={openId === transaction.id ? 0 : -1}
                          aria-hidden={openId !== transaction.id}
                          onClick={() => {
                            setOpenId(null);
                            onDelete(transaction);
                          }}
                          className="absolute inset-y-0 right-0 z-0 w-[76px] text-xs font-black text-white"
                          style={{ backgroundColor: "var(--danger)" }}
                          aria-label={`${rowLabel}を削除`}
                        >
                          削除
                        </button>
                        <Link
                          href={{ pathname: "/transactions/edit", query: { id: transaction.id, returnTo: `/transactions?date=${group.dateKey}` } }}
                          onTouchStart={handleRowTouchStart(transaction.id)}
                          onTouchMove={handleRowTouchMove(transaction.id)}
                          onTouchEnd={handleRowTouchEnd(transaction.id)}
                          onClickCapture={handleRowClickCapture}
                          className={`relative z-[1] flex min-h-[46px] items-center gap-2 bg-[var(--surface)] px-3 active:bg-[var(--brand-soft)] ${drag?.id === transaction.id ? "" : "transition-transform duration-150"}`}
                          style={{ transform: `translateX(${rowOffset(transaction.id)}px)` }}
                        >
                          <span className="h-7 w-1 shrink-0 rounded-full" style={{ backgroundColor: transaction.categoryColor }} />
                          <span className="min-w-0 flex-1 truncate text-[13px] font-bold">
                            {transaction.categoryName}
                            {merchantLabel ? <span className="ml-1 text-[11px] font-bold text-[var(--muted)]">（{merchantLabel}）</span> : null}
                          </span>
                          <span className="shrink-0 text-[15px] font-black tracking-[-0.02em]">{formatCurrency(transaction.amount)}</span>
                          <Icon name="chevron" className="h-4 w-4 shrink-0 text-[#929c97]" />
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      ) : (
        <div className="surface-card empty-state p-4 text-center text-xs text-[var(--muted)]">この月の支出はありません。</div>
      )}
    </div>
  );
}
