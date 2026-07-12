import type { ExpenseType } from "@/lib/types";

// 支出タイプは固定4種（DBのCHECK制約と対応）。ユーザーは表示名の変更と非表示だけができる。
export const expenseTypes: { value: ExpenseType; label: string; color: string }[] = [
  { value: "daily", label: "日常消費", color: "#47725d" },
  { value: "recurring", label: "経常消費", color: "#d39a4a" },
  { value: "subscription", label: "サブスク", color: "#7c80d4" },
  { value: "necessary", label: "必要経費", color: "#4e8fd3" },
];

export const expenseTypeColor = Object.fromEntries(
  expenseTypes.map((item) => [item.value, item.color]),
) as Record<ExpenseType, string>;

// user_settings.expense_type_overrides に保存されるユーザー別の上書き
export type ExpenseTypeOverride = { label?: string; hidden?: boolean };
export type ExpenseTypeOverrides = Partial<Record<ExpenseType, ExpenseTypeOverride>>;

export type EffectiveExpenseType = {
  value: ExpenseType;
  label: string;
  color: string;
  hidden: boolean;
};

// 固定4種にユーザーの上書きを適用した「実効タイプ」を返す。
// DB由来のoverridesに未知のキーや空文字ラベルが混ざっていても安全に既定へ倒す。
export const resolveExpenseTypes = (overrides: ExpenseTypeOverrides | null | undefined): EffectiveExpenseType[] =>
  expenseTypes.map((type) => {
    const override = overrides?.[type.value];
    const label = typeof override?.label === "string" && override.label.trim() ? override.label.trim() : type.label;
    return { value: type.value, color: type.color, label, hidden: override?.hidden === true };
  });
