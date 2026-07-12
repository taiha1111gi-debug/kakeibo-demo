"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DataState from "@/components/DataState";
import Header from "@/components/Header";
import Icon from "@/components/Icon";
import { FormSkeleton } from "@/components/PageSkeletons";
import { softDeleteTransaction, updateTransaction } from "@/lib/data";
import { useExpenseTypes } from "@/components/DayBoundaryProvider";
import { formatCurrency, fromDateTimeLocalValue, toDateTimeLocalValue } from "@/lib/format";
import { getSafeReturnTo } from "@/lib/navigation";
import { validateAmountInput } from "@/lib/validation";
import type { ExpenseType } from "@/lib/types";
import { useMasterData, useTransaction } from "@/lib/useKakeiboData";

function EditTransactionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // 動的ルート([id])だとサーバー関数のコールドスタートを踏むため、クエリパラメータで受ける
  const id = searchParams.get("id") ?? "";
  const returnTo = getSafeReturnTo(searchParams.get("returnTo"), "/transactions");
  const { categories, paymentMethods, isLoading: isMasterLoading, error: masterError, reload: reloadMaster } = useMasterData();
  const { transaction, isLoading: isTransactionLoading, error: transactionError, reload: reloadTransaction } = useTransaction(id);
  const isLoading = isMasterLoading || isTransactionLoading;
  const error = masterError ?? transactionError;
  const [occurredAt, setOccurredAt] = useState("");
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [expenseType, setExpenseType] = useState<ExpenseType>("daily");
  const [verified, setVerified] = useState(false);
  const [status, setStatus] = useState<"saved" | "deleted" | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // 非表示タイプは選択肢から外す。ただし編集中の支出が非表示タイプならそれだけは表示する
  const visibleExpenseTypes = useExpenseTypes().filter((item) => !item.hidden || item.value === expenseType);

  useEffect(() => {
    if (!transaction) return;
    setOccurredAt(toDateTimeLocalValue(transaction.occurredAt));
    setMerchant(transaction.normalizedMerchantName || transaction.rawMerchantName);
    setAmount(String(transaction.amount));
    setCategoryId(transaction.categoryId);
    setPaymentMethodId(transaction.paymentMethodId);
    setExpenseType(transaction.expenseType ?? "daily");
    setVerified(transaction.isVerified);
  }, [transaction]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!transaction || !categoryId || !paymentMethodId) return;
    const amountError = validateAmountInput(amount);
    if (amountError) {
      setFormError(amountError);
      return;
    }
    setIsSaving(true);
    setFormError(null);
    try {
      await updateTransaction(transaction.id, {
        // datetime-localの値は端末タイムゾーンに依存させず、JST固定で保存する
        occurredAt: fromDateTimeLocalValue(occurredAt),
        merchantName: merchant.trim() || "手動支出",
        amount: Number(amount),
        categoryId,
        paymentMethodId,
        expenseType,
        isVerified: verified,
      });
      setStatus("saved");
      // 遷移までisSavingを戻さない：成功直後の連打による二重保存を防ぐ
      window.setTimeout(() => router.replace(returnTo), 500);
    } catch (nextError) {
      setFormError(nextError instanceof Error ? nextError.message : "保存に失敗しました。");
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!transaction) return;
    setIsSaving(true);
    setFormError(null);
    try {
      await softDeleteTransaction(transaction.id);
      setConfirmingDelete(false);
      setStatus("deleted");
      window.setTimeout(() => router.replace(returnTo), 500);
    } catch (nextError) { setConfirmingDelete(false); setFormError(nextError instanceof Error ? nextError.message : "削除に失敗しました。"); setIsSaving(false); }
  };

  return (
    <main className="page-content">
      <Header title="支出を編集" backHref={returnTo} />
      <DataState loading={isLoading} error={error} onRetry={() => { void reloadMaster(); void reloadTransaction(); }} skeleton={<FormSkeleton />} />
      {status ? <div role="status" aria-live="polite" className={`status-message fixed top-3 left-1/2 z-[60] flex w-[calc(100%-24px)] max-w-[456px] -translate-x-1/2 items-center gap-2 rounded-xl p-2.5 text-xs font-bold shadow-lg ${status === "saved" ? "bg-[var(--brand-soft)] text-[var(--brand)]" : "bg-[var(--danger-soft)] text-[var(--danger)]"}`}><Icon name={status === "saved" ? "check" : "alert"} className="h-4 w-4" />{status === "saved" ? "保存しました" : "削除しました"}</div> : null}
      {formError ? <div className="mb-2 rounded-xl bg-[var(--danger-soft)] p-2 text-xs font-bold text-[var(--danger)]">{formError}</div> : null}

      {!isLoading && !error && !transaction ? <div className="surface-card p-4 text-center text-xs text-[var(--muted)]">支出が見つかりません。</div> : null}
      {transaction ? <form onSubmit={handleSubmit} className="space-y-2">
        <section className="surface-card form-card space-y-2.5 p-3">
          <div className="flex items-center justify-between"><label htmlFor="amount" className="field-label !mb-0">金額</label>{amount ? <span className="text-xs font-bold text-[var(--muted)]">{formatCurrency(Number(amount))}</span> : null}</div>
          <div className="amount-field-shell relative"><span className="absolute top-1/2 left-3 -translate-y-1/2 text-xl font-black text-[var(--accent)]">¥</span><input id="amount" required inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, ""))} className="field h-[52px] pl-9 text-right text-3xl font-black tracking-[-0.04em]" /></div>
          <div className="grid grid-cols-2 gap-2"><div className="min-w-0"><label htmlFor="occurredAt" className="field-label">利用日時</label><input id="occurredAt" type="datetime-local" required value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} className="field px-2 text-[10px] font-bold" /></div><div className="min-w-0"><label htmlFor="category" className="field-label">カテゴリ</label><select id="category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="field appearance-none px-2 text-xs font-bold">{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div></div>
          <p className="text-[10px] leading-4 text-[var(--muted)]">カテゴリ変更は、次回から同じ店舗の分類にも反映する想定です</p>
          <div><span className="field-label">支払方法</span><div className="grid grid-cols-4 gap-1" role="group" aria-label="支払方法">{paymentMethods.map((method) => <button key={method.id} type="button" aria-pressed={paymentMethodId === method.id} onClick={() => setPaymentMethodId(method.id)} className={`min-h-9 truncate rounded-lg border px-1 text-[11px] font-extrabold ${paymentMethodId === method.id ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)]"}`}>{method.code === "credit_card" ? "クレカ" : method.name}</button>)}</div></div>
          <div><span className="field-label">支出タイプ</span><div className="grid grid-cols-2 gap-1" role="group" aria-label="支出タイプ">{visibleExpenseTypes.map((item) => <button key={item.value} type="button" aria-pressed={expenseType === item.value} onClick={() => setExpenseType(item.value)} className={`min-h-8 rounded-lg border px-1 text-[10px] font-extrabold ${expenseType === item.value ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)]"}`}>{item.label}</button>)}</div></div>
          <div><label htmlFor="merchant" className="field-label">店名</label><input id="merchant" value={merchant} onChange={(event) => setMerchant(event.target.value)} className="field" /></div>
          <label className="flex min-h-10 cursor-pointer items-center justify-between rounded-lg border border-[var(--line)] px-3"><span className="text-xs font-extrabold">確認済みにする</span><span className={`relative h-6 w-10 rounded-full transition-colors ${verified ? "bg-[var(--brand)]" : "bg-[#c9cfcb]"}`}><input type="checkbox" checked={verified} onChange={(event) => setVerified(event.target.checked)} className="sr-only" /><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${verified ? "translate-x-5" : "translate-x-1"}`} /></span></label>
        </section>
        <div className="grid grid-cols-[1fr_2fr] gap-2"><button type="button" disabled={isSaving} onClick={() => setConfirmingDelete(true)} className="danger-button w-full px-2 text-xs disabled:opacity-60">削除</button><button type="submit" disabled={isSaving} className="primary-button w-full disabled:opacity-60">{status === "saved" ? "保存しました" : isSaving ? "保存中…" : "変更を保存"}</button></div>
      </form> : null}
      {confirmingDelete ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/35 px-5 backdrop-blur-[2px]" role="presentation" onClick={() => { if (!isSaving) setConfirmingDelete(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="delete-confirm-title" className="w-full max-w-[340px] rounded-[26px] border border-[var(--danger-soft)] bg-[var(--surface)] p-5 text-center shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--danger-soft)] text-[var(--danger)]">
              <Icon name="alert" className="h-6 w-6" />
            </div>
            <h2 id="delete-confirm-title" className="mt-3 text-lg font-black tracking-[-0.04em] text-[var(--danger)]">この支出を削除しますか？</h2>
            <p className="mt-2 text-xs font-bold leading-5 text-[var(--muted)]">{merchant || "支出"} ・ {amount ? formatCurrency(Number(amount)) : ""}を削除します。</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" disabled={isSaving} onClick={() => setConfirmingDelete(false)} className="secondary-button w-full text-xs disabled:opacity-60">キャンセル</button>
              <button type="button" disabled={isSaving} onClick={() => void handleDelete()} className="danger-button w-full px-2 text-xs disabled:opacity-60">{isSaving ? "削除中…" : "削除する"}</button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export default function EditTransactionPage() {
  return <Suspense fallback={null}><EditTransactionForm /></Suspense>;
}
