"use client";

import { FormEvent, KeyboardEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DataState from "@/components/DataState";
import Header from "@/components/Header";
import Icon from "@/components/Icon";
import { FormSkeleton } from "@/components/PageSkeletons";
import { createCategory, createPaymentMethod, createTransaction } from "@/lib/data";
import { useExpenseTypes } from "@/components/DayBoundaryProvider";
import { currentDateKey, formatCurrency } from "@/lib/format";
import { getSafeReturnTo } from "@/lib/navigation";
import { validateAmountInput } from "@/lib/validation";
import type { ExpenseType } from "@/lib/types";
import { useMasterData } from "@/lib/useKakeiboData";

const occurredAtForDate = (date: string) => {
  const time = new Intl.DateTimeFormat("sv-SE", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Tokyo" }).format(new Date());
  return `${date}T${time}+09:00`;
};

function NewTransactionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = getSafeReturnTo(searchParams.get("returnTo"), "/");
  const { categories, paymentMethods, isLoading, error, reload } = useMasterData();
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [occurredOn, setOccurredOn] = useState(currentDateKey);
  const [merchant, setMerchant] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [expenseType, setExpenseType] = useState<ExpenseType>("daily");
  const [newCategory, setNewCategory] = useState("");
  const [newPaymentMethod, setNewPaymentMethod] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [addingPaymentMethod, setAddingPaymentMethod] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // 新規登録では非表示タイプを選択肢に出さない
  const visibleExpenseTypes = useExpenseTypes().filter((item) => !item.hidden);

  useEffect(() => {
    if (!categoryId && categories.length) setCategoryId(categories[0].id);
    if (!paymentMethodId && paymentMethods.length) {
      setPaymentMethodId(paymentMethods.find((item) => item.code === "cash")?.id ?? paymentMethods[0].id);
    }
  }, [categories, categoryId, paymentMethodId, paymentMethods]);

  useEffect(() => {
    // 既定の「日常消費」が非表示設定の場合は、先頭の表示タイプへ倒す
    if (visibleExpenseTypes.length && !visibleExpenseTypes.some((item) => item.value === expenseType)) {
      setExpenseType(visibleExpenseTypes[0].value);
    }
  }, [expenseType, visibleExpenseTypes]);

  const showError = (nextError: unknown) => setFormError(nextError instanceof Error ? nextError.message : "処理に失敗しました。");
  const addCategoryOption = async () => {
    if (!newCategory.trim()) return;
    try {
      const created = await createCategory(newCategory);
      setCategoryId(created.id);
      setNewCategory("");
      setAddingCategory(false);
      await reload();
    } catch (nextError) { showError(nextError); }
  };
  const addPaymentOption = async () => {
    if (!newPaymentMethod.trim()) return;
    try {
      const created = await createPaymentMethod(newPaymentMethod);
      setPaymentMethodId(created.id);
      setNewPaymentMethod("");
      setAddingPaymentMethod(false);
      await reload();
    } catch (nextError) { showError(nextError); }
  };
  const addOnEnter = (event: KeyboardEvent<HTMLInputElement>, add: () => Promise<void>) => {
    if (event.key === "Enter") { event.preventDefault(); void add(); }
  };
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!categoryId || !paymentMethodId) return;
    const amountError = validateAmountInput(amount);
    if (amountError) {
      setFormError(amountError);
      return;
    }
    setIsSaving(true);
    setFormError(null);
    try {
      await createTransaction({
        occurredAt: occurredAtForDate(occurredOn),
        merchantName: merchant.trim() || "手動支出",
        amount: Number(amount),
        categoryId,
        paymentMethodId,
        expenseType,
      });
      setSaved(true);
      // 遷移までisSavingを戻さない：成功直後の連打による二重登録を防ぐ
      window.setTimeout(() => router.replace(returnTo), 500);
    } catch (nextError) {
      showError(nextError);
      setIsSaving(false);
    }
  };

  return (
    <main className="page-content">
      <Header title="支出を追加" backHref={returnTo} />
      <DataState loading={isLoading} error={error} onRetry={() => void reload()} skeleton={<FormSkeleton />} />
      {saved ? <div role="status" aria-live="polite" className="status-message fixed top-3 left-1/2 z-[60] flex w-[calc(100%-24px)] max-w-[456px] -translate-x-1/2 items-center gap-2 rounded-xl bg-[var(--brand-soft)] p-2.5 text-xs font-bold text-[var(--brand)] shadow-lg"><Icon name="check" className="h-4 w-4" />登録しました</div> : null}
      {formError ? <div className="mb-2 rounded-xl bg-[var(--danger-soft)] p-2 text-xs font-bold text-[var(--danger)]">{formError}</div> : null}

      {!isLoading && !error ? <form onSubmit={handleSubmit} className="space-y-2">
        <section className="surface-card form-card space-y-2.5 p-3">
          <div className="flex items-center justify-between"><label htmlFor="amount" className="field-label !mb-0">金額</label>{amount ? <span className="text-xs font-bold text-[var(--muted)]">{formatCurrency(Number(amount))}</span> : null}</div>
          <div className="amount-field-shell relative"><span className="absolute top-1/2 left-3 -translate-y-1/2 text-xl font-black text-[var(--accent)]">¥</span><input id="amount" required inputMode="numeric" pattern="[0-9]*" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, ""))} placeholder="0" autoFocus className="field h-[52px] pl-9 text-right text-3xl font-black tracking-[-0.04em]" /></div>

          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0"><label htmlFor="occurredOn" className="field-label">利用日</label><input id="occurredOn" type="date" required value={occurredOn} onChange={(event) => setOccurredOn(event.target.value)} className="field px-2 text-xs font-bold" /></div>
            <div className="min-w-0"><div className="flex items-center justify-between"><label htmlFor="category" className="field-label">カテゴリ</label><button type="button" aria-label="カテゴリを追加" onClick={() => setAddingCategory((value) => !value)} className="mb-1 text-base leading-none font-black text-[var(--brand)]">＋</button></div><select id="category" required value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="field appearance-none px-2 text-xs font-bold">{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          </div>
          {addingCategory ? <div className="flex gap-2"><input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} onKeyDown={(event) => addOnEnter(event, addCategoryOption)} placeholder="新しいカテゴリ名" className="field min-w-0 flex-1" autoFocus /><button type="button" onClick={() => void addCategoryOption()} className="secondary-button shrink-0 px-3">追加</button></div> : null}

          <div><div className="mb-1 flex items-center justify-between"><span className="field-label !mb-0">支払方法</span><button type="button" onClick={() => setAddingPaymentMethod((value) => !value)} className="text-[11px] font-extrabold text-[var(--brand)]">＋ 追加</button></div><div className="grid grid-cols-4 gap-1" role="group" aria-label="支払方法">{paymentMethods.map((method) => <button key={method.id} type="button" aria-pressed={paymentMethodId === method.id} onClick={() => setPaymentMethodId(method.id)} className={`min-h-9 truncate rounded-lg border px-1 text-[11px] font-extrabold ${paymentMethodId === method.id ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)]"}`}>{method.code === "credit_card" ? "クレカ" : method.name}</button>)}</div>
          {addingPaymentMethod ? <div className="mt-1.5 flex gap-2"><input value={newPaymentMethod} onChange={(event) => setNewPaymentMethod(event.target.value)} onKeyDown={(event) => addOnEnter(event, addPaymentOption)} placeholder="新しい支払方法名" className="field min-w-0 flex-1" autoFocus /><button type="button" onClick={() => void addPaymentOption()} className="secondary-button shrink-0 px-3">追加</button></div> : null}</div>

          <div><span className="field-label">支出タイプ</span><div className="grid grid-cols-2 gap-1" role="group" aria-label="支出タイプ">{visibleExpenseTypes.map((item) => <button key={item.value} type="button" aria-pressed={expenseType === item.value} onClick={() => setExpenseType(item.value)} className={`min-h-8 rounded-lg border px-1 text-[10px] font-extrabold ${expenseType === item.value ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)]"}`}>{item.label}</button>)}</div></div>

          <div><label htmlFor="merchant" className="field-label">店名</label><input id="merchant" value={merchant} onChange={(event) => setMerchant(event.target.value)} placeholder="空欄なら「手動支出」" className="field" /></div>
        </section>
        <button type="submit" disabled={isSaving} className="primary-button w-full disabled:opacity-60">{saved ? "登録しました" : isSaving ? "登録中…" : "登録する（時刻は現在時刻）"}</button>
      </form> : null}
    </main>
  );
}

export default function NewTransactionPage() {
  return <Suspense fallback={null}><NewTransactionForm /></Suspense>;
}
