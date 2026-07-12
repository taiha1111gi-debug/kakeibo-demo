"use client";

import Link from "next/link";
import {
  formatCurrency,
  formatDate,
} from "@/lib/format";
import { useExpenseTypes } from "@/components/DayBoundaryProvider";
import type { Transaction } from "@/lib/types";
import Icon from "@/components/Icon";

export default function TransactionCard({ transaction, returnTo = "/transactions" }: { transaction: Transaction; returnTo?: string }) {
  const merchant = transaction.normalizedMerchantName || transaction.rawMerchantName;
  const expenseType = useExpenseTypes().find((item) => item.value === transaction.expenseType);

  return (
    <Link
      href={{ pathname: "/transactions/edit", query: { id: transaction.id, returnTo } }}
      className="surface-card transaction-card flex min-h-[64px] items-center gap-2.5 p-2.5 transition-all active:scale-[0.99]"
    >
      <span
        className="h-10 w-1 shrink-0 rounded-full shadow-sm"
        style={{ backgroundColor: transaction.categoryColor }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-black tracking-[-0.02em]">{merchant}</p>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--muted)]">
              <span className="min-w-0 truncate">{formatDate(transaction.occurredAt)} ・ {transaction.paymentMethodName}</span>
              {expenseType ? <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold" style={{ color: expenseType.color, backgroundColor: `${expenseType.color}18` }}>{expenseType.label}</span> : null}
            </div>
          </div>
          <p className="shrink-0 text-[17px] font-black tracking-[-0.03em]">
            {formatCurrency(transaction.amount)}
          </p>
        </div>
      </div>
      <span className="transaction-chevron z-[1] grid h-7 w-7 shrink-0 place-items-center rounded-full"><Icon name="chevron" className="h-4 w-4 text-[#929c97]" /></span>
    </Link>
  );
}
