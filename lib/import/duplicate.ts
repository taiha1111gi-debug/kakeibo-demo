import { toDateTimeLocalValue } from "@/lib/format";
import type { ImportCandidate } from "@/lib/import/types";
import type { Transaction } from "@/lib/types";

// 「利用日時 | 正規化した店名 | 金額」を重複判定キーにする。
// import_logs（同一メールの再取込防止）とは別の、既存支出との類似判定に使う。

export const normalizeMerchantForComparison = (value: string) => value
  .normalize("NFKC")
  .toLocaleLowerCase("ja-JP")
  .replace(/\s+/g, "")
  .trim();

export type CandidateMatchFields = Pick<ImportCandidate, "occurredOn" | "occurredTime" | "merchantName" | "amount">;

export const candidateMatchKey = (candidate: CandidateMatchFields) => {
  const dateTime = `${candidate.occurredOn}T${candidate.occurredTime || "12:00"}`;
  const merchant = normalizeMerchantForComparison(candidate.merchantName.trim() || "未取得");
  return `${dateTime}|${merchant}|${candidate.amount}`;
};

export const transactionMatchKey = (transaction: Transaction) =>
  `${toDateTimeLocalValue(transaction.occurredAt)}|${normalizeMerchantForComparison(transaction.normalizedMerchantName || transaction.rawMerchantName)}|${transaction.amount}`;

export const buildTransactionMatchKeySet = (transactions: Transaction[]) =>
  new Set(transactions.map(transactionMatchKey));
