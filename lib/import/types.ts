import type { ExpenseType } from "@/lib/types";

export type ImportProvider = "smbc" | "unknown";
export type ImportSourceType = "email_paste" | "gmail_api";

export type ParsedEmailItem = {
  occurredOn: string;
  occurredTime: string;
  amount: number;
  merchantName: string;
  serviceName: string;
  memo: string;
  sourceText: string;
};

export type ImportCandidate = ParsedEmailItem & {
  id: string;
  provider: ImportProvider;
  sourceType: ImportSourceType;
  sourceHash: string;
  externalMessageId?: string;
  categoryId: string;
  paymentMethodId: string;
  expenseType: ExpenseType;
};

export type ParseEmailResult = {
  candidates: Omit<ImportCandidate, "categoryId" | "paymentMethodId" | "expenseType">[];
  warnings: string[];
  provider: ImportProvider;
};

export type EmailParser = {
  provider: Exclude<ImportProvider, "unknown">;
  matches: (text: string) => boolean;
  parse: (text: string) => ParsedEmailItem[];
};
