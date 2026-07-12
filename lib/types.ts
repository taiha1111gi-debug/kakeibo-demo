export type CardCompany = "smbc" | "dcard" | null;
export type TransactionSource = "manual" | "pasted_email" | "gmail_api";
export type TransactionType = "purchase" | "charge";
export type ExpenseType = "daily" | "recurring" | "subscription" | "necessary";

// システムカテゴリの識別コード。名前の文字列一致（「未分類」）での判定は使わない。
export const UNCLASSIFIED_CATEGORY_CODE = "unclassified";

// カテゴリ・支払方法に使える配色パレット。
// 新規追加時は使われていない色を自動で割り当て、管理画面からも選び直せる。
export const MASTER_ITEM_COLORS = [
  "#55a67a", "#b071c7", "#d06f9b", "#e06d83",
  "#eb8b5c", "#d3a245", "#40a9a5", "#7c80d4",
  "#687787", "#8a72b6", "#4e8fd3", "#d39a4a",
  "#e05a5a", "#47725d", "#c86b6b", "#5b83bd",
] as const;

// 既存の色と重ならないパレット色を選ぶ（全部使用中なら件数で巡回）
export const pickUnusedColor = (usedColors: string[]) => {
  const used = new Set(usedColors.map((color) => color.toLowerCase()));
  return MASTER_ITEM_COLORS.find((color) => !used.has(color.toLowerCase()))
    ?? MASTER_ITEM_COLORS[usedColors.length % MASTER_ITEM_COLORS.length];
};

export type Category = {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
  code: string | null;
  isSystem: boolean;
};

export type PaymentMethod = {
  id: string;
  code: string;
  name: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
};

export type Transaction = {
  id: string;
  occurredAt: string;
  rawMerchantName: string;
  normalizedMerchantName: string;
  amount: number;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryCode: string | null;
  paymentMethodId: string;
  paymentMethodCode: string;
  paymentMethodName: string;
  paymentMethodColor: string;
  cardCompany: CardCompany;
  source: TransactionSource;
  isVerified: boolean;
  transactionType: TransactionType;
  expenseType: ExpenseType;
  memo?: string;
};

export type CreateTransactionInput = {
  occurredAt: string;
  merchantName: string;
  amount: number;
  categoryId: string;
  paymentMethodId: string;
  expenseType: ExpenseType;
};

export type UpdateTransactionInput = CreateTransactionInput & {
  isVerified: boolean;
};
