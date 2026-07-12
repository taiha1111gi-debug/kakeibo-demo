import { describe, expect, it } from "vitest";
import { MAX_TRANSACTION_AMOUNT, validateAmountInput } from "@/lib/validation";

describe("validateAmountInput", () => {
  it("空欄・0円・負数を日本語メッセージで弾く", () => {
    expect(validateAmountInput("")).toContain("金額を入力");
    expect(validateAmountInput("   ")).toContain("金額を入力");
    expect(validateAmountInput("0")).toContain("1円以上");
    expect(validateAmountInput("-100")).toContain("1円以上");
  });

  it("上限を超える金額を弾く", () => {
    expect(validateAmountInput(String(MAX_TRANSACTION_AMOUNT + 1))).toContain("大きすぎます");
  });

  it("正常な金額はnull（エラーなし）", () => {
    expect(validateAmountInput("1")).toBeNull();
    expect(validateAmountInput("620")).toBeNull();
    expect(validateAmountInput(String(MAX_TRANSACTION_AMOUNT))).toBeNull();
  });
});
