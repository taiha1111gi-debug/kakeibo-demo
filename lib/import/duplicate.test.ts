import { describe, expect, it } from "vitest";
import {
  buildTransactionMatchKeySet,
  candidateMatchKey,
  normalizeMerchantForComparison,
  transactionMatchKey,
} from "@/lib/import/duplicate";
import type { Transaction } from "@/lib/types";

const transaction = (overrides: Partial<Transaction>): Transaction => ({
  id: "t-1",
  occurredAt: "2026-07-02T09:40:00+00:00", // = 2026-07-02 18:40 JST
  rawMerchantName: "デイリーヤマザキ",
  normalizedMerchantName: "デイリーヤマザキ",
  amount: 620,
  categoryId: "c-1",
  categoryName: "未分類",
  categoryColor: "#e2a52e",
  categoryCode: "unclassified",
  paymentMethodId: "p-1",
  paymentMethodCode: "credit_card",
  paymentMethodName: "クレジットカード",
  paymentMethodColor: "#47725d",
  cardCompany: "smbc",
  source: "gmail_api",
  isVerified: true,
  transactionType: "purchase",
  expenseType: "daily",
  ...overrides,
});

describe("normalizeMerchantForComparison", () => {
  it("全角・空白・大文字小文字の揺れを吸収する", () => {
    expect(normalizeMerchantForComparison("ｾﾌﾞﾝ-イレブン")).toBe(normalizeMerchantForComparison("セブン-イレブン"));
    expect(normalizeMerchantForComparison("デイリー ヤマザキ")).toBe("デイリーヤマザキ");
    expect(normalizeMerchantForComparison("AMAZON.CO.JP")).toBe(normalizeMerchantForComparison("amazon.co.jp"));
  });
});

describe("candidateMatchKey / transactionMatchKey", () => {
  it("同じ利用日時・店名・金額なら候補と既存支出のキーが一致する", () => {
    const candidateKey = candidateMatchKey({
      occurredOn: "2026-07-02",
      occurredTime: "18:40",
      merchantName: "デイリー ヤマザキ",
      amount: 620,
    });
    expect(candidateKey).toBe(transactionMatchKey(transaction({})));
  });

  it("金額が違えばキーは一致しない", () => {
    const candidateKey = candidateMatchKey({
      occurredOn: "2026-07-02",
      occurredTime: "18:40",
      merchantName: "デイリーヤマザキ",
      amount: 621,
    });
    expect(candidateKey).not.toBe(transactionMatchKey(transaction({})));
  });

  it("時刻未取得の候補は12:00として扱う", () => {
    expect(candidateMatchKey({ occurredOn: "2026-07-02", occurredTime: "", merchantName: "店", amount: 100 }))
      .toBe("2026-07-02T12:00|店|100");
  });

  it("店名未取得の候補は「未取得」として扱う", () => {
    expect(candidateMatchKey({ occurredOn: "2026-07-02", occurredTime: "18:40", merchantName: "  ", amount: 100 }))
      .toBe("2026-07-02T18:40|未取得|100");
  });
});

describe("buildTransactionMatchKeySet", () => {
  it("既存支出のキー集合を作る", () => {
    const set = buildTransactionMatchKeySet([transaction({}), transaction({ id: "t-2", amount: 1200 })]);
    expect(set.has(candidateMatchKey({ occurredOn: "2026-07-02", occurredTime: "18:40", merchantName: "デイリーヤマザキ", amount: 620 }))).toBe(true);
    expect(set.has(candidateMatchKey({ occurredOn: "2026-07-02", occurredTime: "18:40", merchantName: "デイリーヤマザキ", amount: 9999 }))).toBe(false);
  });
});
