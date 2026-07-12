"use client";

import { useExpenseTypes } from "@/components/DayBoundaryProvider";
import { formatCurrency } from "@/lib/format";
import type { EditableCandidate } from "@/lib/import/useGmailImport";
import type { Category, PaymentMethod } from "@/lib/types";

type ImportCandidateCardProps = {
  candidate: EditableCandidate;
  categories: Category[];
  paymentMethods: PaymentMethod[];
  onUpdate: <K extends keyof EditableCandidate>(id: string, key: K, value: EditableCandidate[K]) => void;
  onRemove: (id: string) => void;
  onRegister: (candidate: EditableCandidate, confirmedPossibleDuplicate?: boolean) => void;
  showDebugInfo: boolean;
};

export default function ImportCandidateCard({
  candidate,
  categories,
  paymentMethods,
  onUpdate,
  onRemove,
  onRegister,
  showDebugInfo,
}: ImportCandidateCardProps) {
  // 非表示タイプは選択肢から外す。ただし現在選択中の値だけは表示する
  const visibleExpenseTypes = useExpenseTypes().filter((item) => !item.hidden || item.value === candidate.expenseType);
  return (
    <article className="surface-card candidate-card space-y-2.5 p-3">
      <div className="flex items-start justify-between gap-2">
        <div><p className="text-xs font-bold text-[var(--muted)]">{candidate.serviceName}</p><p className="text-lg font-black">{formatCurrency(candidate.amount)}</p></div>
        <span className="rounded-full bg-[var(--brand-soft)] px-2 py-1 text-[10px] font-black text-[var(--brand)]">{candidate.provider === "smbc" ? "三井住友" : "不明"}</span>
      </div>

      <div className="grid grid-cols-[0.8fr_1.25fr_0.75fr] gap-1.5">
        <div className="min-w-0"><label className="field-label" htmlFor={`amount-${candidate.id}`}>金額</label><input id={`amount-${candidate.id}`} inputMode="numeric" pattern="[0-9]*" value={candidate.amount} onChange={(event) => onUpdate(candidate.id, "amount", Number(event.target.value.replace(/[^0-9]/g, "")))} className="field px-2 text-right font-black" /></div>
        <div className="min-w-0"><label className="field-label" htmlFor={`date-${candidate.id}`}>利用日</label><input id={`date-${candidate.id}`} type="date" value={candidate.occurredOn} onChange={(event) => onUpdate(candidate.id, "occurredOn", event.target.value)} className="field px-2 text-xs font-bold" /></div>
        <div className="min-w-0"><label className="field-label" htmlFor={`time-${candidate.id}`}>時刻</label><input id={`time-${candidate.id}`} type="time" value={candidate.occurredTime} onChange={(event) => onUpdate(candidate.id, "occurredTime", event.target.value)} className="field px-1 text-[10px] font-bold" /></div>
      </div>
      <div>
        <label className="field-label" htmlFor={`merchant-${candidate.id}`}>店名・利用先</label>
        {!candidate.merchantName.trim() ? <p className="mb-1.5 rounded-lg bg-[var(--warning-soft)] p-2 text-[10px] font-bold leading-4 text-[var(--warning)]">利用先を取得できませんでした。必要に応じて手入力してください。</p> : null}
        <input id={`merchant-${candidate.id}`} value={candidate.merchantName} onChange={(event) => onUpdate(candidate.id, "merchantName", event.target.value)} placeholder="未取得（手入力できます）" className="field" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="field-label" htmlFor={`category-${candidate.id}`}>カテゴリ</label><select id={`category-${candidate.id}`} value={candidate.categoryId} onChange={(event) => onUpdate(candidate.id, "categoryId", event.target.value)} className="field appearance-none px-2 text-xs font-bold">{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        <div><label className="field-label" htmlFor={`payment-${candidate.id}`}>支払方法</label><select id={`payment-${candidate.id}`} value={candidate.paymentMethodId} onChange={(event) => onUpdate(candidate.id, "paymentMethodId", event.target.value)} className="field appearance-none px-2 text-xs font-bold">{paymentMethods.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      </div>
      <div><span className="field-label">支出タイプ</span><div className="grid grid-cols-2 gap-1">{visibleExpenseTypes.map((type) => <button key={type.value} type="button" aria-pressed={candidate.expenseType === type.value} onClick={() => onUpdate(candidate.id, "expenseType", type.value)} className={`min-h-8 rounded-lg border px-1 text-[10px] font-extrabold ${candidate.expenseType === type.value ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)]"}`}>{type.label}</button>)}</div></div>
      <div><label className="field-label" htmlFor={`memo-${candidate.id}`}>メモ（元テキスト）</label><textarea id={`memo-${candidate.id}`} rows={3} value={candidate.memo} onChange={(event) => onUpdate(candidate.id, "memo", event.target.value)} className="field resize-none text-[11px] leading-4" /></div>

      {candidate.error ? <p className="rounded-lg bg-[var(--danger-soft)] p-2 text-xs font-bold text-[var(--danger)]">{candidate.error}</p> : null}
      {candidate.status === "saved" ? (
        <div role="status" className="rounded-lg bg-[var(--brand-soft)] p-2 text-center text-xs font-bold text-[var(--brand)]">登録しました</div>
      ) : candidate.needsDuplicateConfirmation ? (
        <div className="rounded-xl border border-[#ecd59d] bg-[var(--warning-soft)] p-2.5">
          <p className="text-xs font-black text-[var(--warning)]">重複の可能性が高い支出です</p>
          <p className="mt-1 text-[10px] leading-4 text-[var(--muted)]">利用日時・店名・金額が一致する既存支出があります。</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onRemove(candidate.id)} className="secondary-button w-full text-xs font-bold text-[var(--danger)]">削除</button>
            <button type="button" onClick={() => onRegister(candidate, true)} className="primary-button w-full px-2 text-xs">それでも登録</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          <button type="button" disabled={candidate.status === "saving"} onClick={() => onRemove(candidate.id)} className="secondary-button w-full text-xs font-bold text-[var(--danger)] disabled:opacity-60">削除</button>
          <button type="button" disabled={candidate.status === "saving"} onClick={() => onRegister(candidate)} className="primary-button col-span-2 w-full disabled:opacity-60">{candidate.status === "saving" ? "登録中…" : "確認して登録"}</button>
        </div>
      )}
      {showDebugInfo ? (
        <p className="truncate text-[10px] text-[var(--muted)]">識別情報：{candidate.sourceType} / {candidate.sourceHash.slice(0, 12)}…{candidate.externalMessageId ? ` / ${candidate.externalMessageId}` : ""}</p>
      ) : null}
    </article>
  );
}
