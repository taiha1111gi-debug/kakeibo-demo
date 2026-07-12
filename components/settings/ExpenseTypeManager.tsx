"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import { useDayBoundary, useExpenseTypes } from "@/components/DayBoundaryProvider";
import type { ExpenseType } from "@/lib/types";

// 内訳（支出タイプ）の管理。固定4種の「表示名の変更」と「非表示」だけができる。
// 追加・削除・並び替えはできない（集計の仕組みがこの4種に紐づいているため）。

export default function ExpenseTypeManager() {
  const types = useExpenseTypes();
  const { updateExpenseTypeOverride } = useDayBoundary();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingValue, setEditingValue] = useState<ExpenseType | null>(null);
  const [editingName, setEditingName] = useState("");

  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await operation();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "更新に失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  const startRename = (value: ExpenseType, currentLabel: string) => {
    setError(null);
    setEditingValue(value);
    setEditingName(currentLabel);
  };

  const commitRename = () => {
    if (!editingValue) return;
    const value = editingValue;
    const name = editingName.trim();
    if (name.length > 20) {
      setError("表示名は20文字以内にしてください。");
      return;
    }
    setEditingValue(null);
    // 空にしたら既定名へ戻す
    void run(() => updateExpenseTypeOverride(value, { label: name }));
  };

  const toggleHidden = (value: ExpenseType, hidden: boolean) => {
    if (!hidden && types.filter((type) => !type.hidden).length <= 1) {
      setError("最後の1つは非表示にできません。");
      return;
    }
    void run(() => updateExpenseTypeOverride(value, { hidden: !hidden ? true : undefined }));
  };

  return (
    <details className="group surface-card breakdown-card overflow-hidden">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-3.5 font-black [&::-webkit-details-marker]:hidden">
        <span className="text-sm">内訳（支出タイプ）の管理</span>
        <Icon name="chevron" className="h-4 w-4 text-[var(--muted)] transition-transform group-open:rotate-90" />
      </summary>
      <div className="space-y-2 border-t border-[var(--line)] p-3">
        <p className="text-[10px] leading-4 text-[var(--muted)]">
          表示名の変更と非表示ができます（4種の枠組み自体は集計の土台なので変えられません）。
          非表示にすると登録時の選択肢から消えますが、支出が残っている月の集計には表示され続けます。
          表示名を空にすると既定名に戻ります。
        </p>
        {error ? <p role="alert" className="rounded-lg bg-[var(--danger-soft)] p-2 text-xs font-bold text-[var(--danger)]">{error}</p> : null}
        <ul className="space-y-1.5">
          {types.map((type) => (
            <li key={type.value} className="flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--line)] px-2 py-1.5">
              {editingValue === type.value ? (
                <>
                  <input
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitRename();
                      }
                      if (event.key === "Escape") setEditingValue(null);
                    }}
                    maxLength={20}
                    autoFocus
                    className="field min-w-0 flex-1 px-2 text-xs font-bold"
                  />
                  <button type="button" disabled={busy} onClick={commitRename} className="secondary-button shrink-0 px-2 text-[10px] disabled:opacity-60">保存</button>
                  <button type="button" disabled={busy} onClick={() => setEditingValue(null)} className="secondary-button shrink-0 px-2 text-[10px] disabled:opacity-60">取消</button>
                </>
              ) : (
                <>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: type.color }} />
                  <span className={`min-w-0 flex-1 truncate text-xs font-bold ${type.hidden ? "text-[var(--muted)] line-through" : ""}`}>{type.label}</span>
                  <button type="button" aria-label={`${type.label}の表示名を変更`} title="改名" disabled={busy} onClick={() => startRename(type.value, type.label)} className="icon-button grid h-8 w-8 shrink-0 place-items-center rounded-lg disabled:opacity-25">
                    <Icon name="pencil" className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" aria-label={type.hidden ? `${type.label}を再表示する` : `${type.label}を非表示にする`} title={type.hidden ? "再表示" : "非表示"} disabled={busy} onClick={() => toggleHidden(type.value, type.hidden)} className="icon-button grid h-8 w-8 shrink-0 place-items-center rounded-lg disabled:opacity-25">
                    <Icon name={type.hidden ? "eye" : "eyeOff"} className="h-4 w-4" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
