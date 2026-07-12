// フォーム入力の検証。DBの制約（amount > 0 など）に達する前にアプリ側で弾き、
// Postgresの英語エラーがそのまま画面に出るのを防ぐ。

export const MAX_TRANSACTION_AMOUNT = 99_999_999;

export function validateAmountInput(value: string): string | null {
  if (!value.trim()) return "金額を入力してください。";
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount <= 0) return "金額は1円以上の整数で入力してください。";
  if (amount > MAX_TRANSACTION_AMOUNT) return "金額が大きすぎます（1億円未満で入力してください）。";
  return null;
}
