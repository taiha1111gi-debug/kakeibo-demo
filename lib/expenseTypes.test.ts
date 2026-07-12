import { describe, expect, it } from "vitest";
import { resolveExpenseTypes, type ExpenseTypeOverrides } from "@/lib/expenseTypes";

describe("resolveExpenseTypes", () => {
  it("上書きなしなら既定の4種をそのまま返す", () => {
    const resolved = resolveExpenseTypes({});
    expect(resolved.map((type) => type.value)).toEqual(["daily", "recurring", "subscription", "necessary"]);
    expect(resolved.map((type) => type.label)).toEqual(["日常消費", "経常消費", "サブスク", "必要経費"]);
    expect(resolved.every((type) => !type.hidden)).toBe(true);
  });

  it("表示名の上書きと非表示フラグが反映される", () => {
    const overrides: ExpenseTypeOverrides = {
      daily: { label: "ふだんの買い物" },
      necessary: { hidden: true },
    };
    const resolved = resolveExpenseTypes(overrides);
    expect(resolved.find((type) => type.value === "daily")?.label).toBe("ふだんの買い物");
    expect(resolved.find((type) => type.value === "necessary")?.hidden).toBe(true);
    expect(resolved.find((type) => type.value === "recurring")?.label).toBe("経常消費");
  });

  it("空白だけのラベルは既定名に倒す", () => {
    const resolved = resolveExpenseTypes({ daily: { label: "   " } });
    expect(resolved.find((type) => type.value === "daily")?.label).toBe("日常消費");
  });

  it("nullやundefined、DB由来の不正な値でも壊れない", () => {
    expect(() => resolveExpenseTypes(null)).not.toThrow();
    expect(() => resolveExpenseTypes(undefined)).not.toThrow();
    const junk = { daily: { label: 123 }, bogus: { hidden: true } } as unknown as ExpenseTypeOverrides;
    const resolved = resolveExpenseTypes(junk);
    expect(resolved.find((type) => type.value === "daily")?.label).toBe("日常消費");
    expect(resolved).toHaveLength(4);
  });

  it("色は上書きできず既定のまま", () => {
    const resolved = resolveExpenseTypes({ daily: { label: "x" } });
    expect(resolved.find((type) => type.value === "daily")?.color).toBe("#47725d");
  });
});
