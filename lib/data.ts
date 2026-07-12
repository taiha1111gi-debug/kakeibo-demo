import { DEMO_USER_ID, ensureDb, resetDb, saveDb, type DemoDb, type DemoTransactionRow } from "@/lib/demo/db";
import { kakeiboCache } from "@/lib/kakeiboCache";
import { getDayBoundaryHour, jstMonthKeyOf, monthKeyToJstRange } from "@/lib/format";
import type { ExpenseTypeOverrides } from "@/lib/expenseTypes";
import {
  UNCLASSIFIED_CATEGORY_CODE,
  pickUnusedColor,
  type Category,
  type CreateTransactionInput,
  type ExpenseType,
  type PaymentMethod,
  type Transaction,
  type UpdateTransactionInput,
} from "@/lib/types";
import type { ImportCandidate } from "@/lib/import/types";

// 公開デモのデータ層。本番版はここがSupabase（PostgreSQL + RLS + RPC）への
// アクセスに置き換わる。関数のシグネチャ・エラーメッセージ・キャッシュ連携は
// 本番版と同じに保ち、画面側のコードは一切変えずに動くようにしている。
// データはすべて架空で、このブラウザのlocalStorageにのみ保存される。

// 本番のensureUser（匿名自動ログイン）に相当。デモDBを用意しキャッシュの持ち主を固定する
const ensureDemoDb = (): DemoDb => {
  const db = ensureDb();
  kakeiboCache.setOwner(DEMO_USER_ID);
  return db;
};

const activeTransactions = (db: DemoDb) => db.transactions.filter((row) => !row.deletedAt);

const sortByOccurredAtDesc = (rows: DemoTransactionRow[]) =>
  [...rows].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

const mapTransaction = (db: DemoDb, row: DemoTransactionRow): Transaction => {
  const category = db.categories.find((item) => item.id === row.categoryId);
  const paymentMethod = db.paymentMethods.find((item) => item.id === row.paymentMethodId);
  return {
    id: row.id,
    occurredAt: row.occurredAt,
    rawMerchantName: row.merchantName,
    normalizedMerchantName: row.merchantName,
    amount: row.amount,
    categoryId: row.categoryId,
    categoryName: category?.name ?? "不明",
    categoryColor: category?.color ?? "#88938d",
    categoryCode: category?.code ?? null,
    paymentMethodId: row.paymentMethodId,
    paymentMethodCode: paymentMethod?.code ?? "other",
    paymentMethodName: paymentMethod?.name ?? "不明",
    paymentMethodColor: paymentMethod?.color ?? "#88938d",
    cardCompany: row.cardCompany,
    source: row.source,
    isVerified: row.isVerified,
    transactionType: row.transactionType,
    expenseType: row.expenseType,
    memo: row.memo ?? undefined,
  };
};

export type UserSettings = {
  dayBoundaryHour: number;
  expenseTypeOverrides: ExpenseTypeOverrides;
  calendarTypes: ExpenseType[] | null;
  // サンプルメール取込の最終取得時刻（エポックms）
  gmailLastFetchedAt: number | null;
  gmailQuery: string | null;
};

export async function fetchUserSettings(): Promise<UserSettings> {
  const db = ensureDemoDb();
  return { ...db.settings };
}

export async function saveDayBoundaryHour(hour: number): Promise<void> {
  const db = ensureDemoDb();
  db.settings.dayBoundaryHour = hour;
  saveDb(db);
}

export async function saveExpenseTypeOverrides(overrides: ExpenseTypeOverrides): Promise<void> {
  const db = ensureDemoDb();
  db.settings.expenseTypeOverrides = overrides;
  saveDb(db);
}

export async function saveCalendarTypes(types: ExpenseType[] | null): Promise<void> {
  const db = ensureDemoDb();
  db.settings.calendarTypes = types;
  saveDb(db);
}

export async function saveGmailSettings(patch: { lastFetchedAt?: number | null; query?: string | null }): Promise<void> {
  const db = ensureDemoDb();
  if (patch.lastFetchedAt !== undefined) db.settings.gmailLastFetchedAt = patch.lastFetchedAt;
  if (patch.query !== undefined) db.settings.gmailQuery = patch.query;
  saveDb(db);
}

// カテゴリ・支払方法はまとめて取得し、モジュールキャッシュに保持する
export async function fetchMasterData(): Promise<{ categories: Category[]; paymentMethods: PaymentMethod[] }> {
  const cached = kakeiboCache.getMaster();
  if (cached) return cached;
  const generationAtFetchStart = kakeiboCache.getGeneration();
  const db = ensureDemoDb();
  const master = {
    categories: db.categories.filter((item) => item.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    paymentMethods: db.paymentMethods.filter((item) => item.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
  };
  kakeiboCache.setMaster(master, generationAtFetchStart);
  return master;
}

// 支出は月単位で取得・キャッシュする（本番と同じ月バケツ構造）
export async function fetchMonthTransactions(monthKey: string): Promise<Transaction[]> {
  const cached = kakeiboCache.getMonth(monthKey);
  if (cached) return cached;
  const generationAtFetchStart = kakeiboCache.getGeneration();
  const dayBoundaryHour = getDayBoundaryHour();
  const db = ensureDemoDb();
  const { startIso, endIso } = monthKeyToJstRange(monthKey, dayBoundaryHour);
  const startMs = Date.parse(startIso);
  const endMs = Date.parse(endIso);
  const rows = sortByOccurredAtDesc(activeTransactions(db).filter((row) => {
    const occurredMs = Date.parse(row.occurredAt);
    return occurredMs >= startMs && occurredMs < endMs;
  }));
  const transactions = rows.map((row) => mapTransaction(db, row));
  kakeiboCache.setMonth(monthKey, transactions, generationAtFetchStart);
  return transactions;
}

const unclassifiedRows = (db: DemoDb) => {
  const unclassifiedIds = new Set(db.categories.filter((item) => item.code === UNCLASSIFIED_CATEGORY_CODE).map((item) => item.id));
  return activeTransactions(db).filter((row) => unclassifiedIds.has(row.categoryId));
};

// ホームの「ほかの月にも未分類があります」表示用の全期間カウント
export async function fetchUnclassifiedCount(): Promise<number> {
  const db = ensureDemoDb();
  return unclassifiedRows(db).length;
}

// 未分類の支出は月をまたいで確認したいので全期間分を返す
export async function fetchUnclassifiedTransactions(): Promise<Transaction[]> {
  const db = ensureDemoDb();
  return sortByOccurredAtDesc(unclassifiedRows(db)).map((row) => mapTransaction(db, row));
}

export async function fetchTransactionById(id: string): Promise<Transaction | null> {
  const db = ensureDemoDb();
  const row = activeTransactions(db).find((item) => item.id === id);
  return row ? mapTransaction(db, row) : null;
}

// 月ナビゲーション用に、データが存在する期間（最古月〜最新月）を返す
export async function fetchTransactionMonthRange(): Promise<{ earliestMonth: string; latestMonth: string } | null> {
  const cached = kakeiboCache.getMonthRange();
  if (cached) return cached;
  const generationAtFetchStart = kakeiboCache.getGeneration();
  const dayBoundaryHour = getDayBoundaryHour();
  const db = ensureDemoDb();
  const rows = activeTransactions(db);
  if (!rows.length) return null;
  let earliest = rows[0].occurredAt;
  let latest = rows[0].occurredAt;
  for (const row of rows) {
    if (row.occurredAt < earliest) earliest = row.occurredAt;
    if (row.occurredAt > latest) latest = row.occurredAt;
  }
  const range = { earliestMonth: jstMonthKeyOf(earliest, dayBoundaryHour), latestMonth: jstMonthKeyOf(latest, dayBoundaryHour) };
  kakeiboCache.setMonthRange(range, generationAtFetchStart);
  return range;
}

export async function fetchTransactionCount(): Promise<number> {
  const db = ensureDemoDb();
  return activeTransactions(db).length;
}

// 管理画面用：非表示（isActive=false）の項目も含めて全件返す
export async function fetchAllCategories(): Promise<Category[]> {
  const db = ensureDemoDb();
  return [...db.categories].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function fetchAllPaymentMethods(): Promise<PaymentMethod[]> {
  const db = ensureDemoDb();
  return [...db.paymentMethods].sort((a, b) => a.sortOrder - b.sortOrder);
}

type MasterItemPatch = { name?: string; sortOrder?: number; isActive?: boolean; color?: string };

// 本番ではDBの一意制約（23505）が防ぐ重複名を、デモでは事前チェックで再現する
const assertUniqueName = (items: { id: string; name: string }[], id: string | null, name: string, message: string) => {
  if (items.some((item) => item.id !== id && item.name === name)) throw new Error(message);
};

export async function updateCategory(id: string, patch: MasterItemPatch) {
  const db = ensureDemoDb();
  const category = db.categories.find((item) => item.id === id);
  if (!category) throw new Error("更新対象が見つかりませんでした。");
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    assertUniqueName(db.categories, id, name, "同じ名前のカテゴリが既に存在します（非表示の項目を含む）。");
    category.name = name;
  }
  if (patch.sortOrder !== undefined) category.sortOrder = patch.sortOrder;
  if (patch.isActive !== undefined) category.isActive = patch.isActive;
  if (patch.color !== undefined) category.color = patch.color;
  saveDb(db);
  kakeiboCache.invalidateMaster();
  // 名称・色は履歴の表示にも結合されているため、変更時は支出キャッシュも取り直す
  if (patch.name !== undefined || patch.color !== undefined) kakeiboCache.invalidateTransactions();
}

export async function updatePaymentMethod(id: string, patch: MasterItemPatch) {
  const db = ensureDemoDb();
  const method = db.paymentMethods.find((item) => item.id === id);
  if (!method) throw new Error("更新対象が見つかりませんでした。");
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    assertUniqueName(db.paymentMethods, id, name, "同じ名前の支払方法が既に存在します（非表示の項目を含む）。");
    method.name = name;
  }
  if (patch.sortOrder !== undefined) method.sortOrder = patch.sortOrder;
  if (patch.isActive !== undefined) method.isActive = patch.isActive;
  if (patch.color !== undefined) method.color = patch.color;
  saveDb(db);
  kakeiboCache.invalidateMaster();
  if (patch.name !== undefined || patch.color !== undefined) kakeiboCache.invalidateTransactions();
}

// 削除は「支出が1件も紐づいていない項目」だけ成功する。
// 本番ではDBの外部キー制約（23503）が拒否する条件を、デモでは参照チェックで再現する。
export async function deleteCategory(id: string) {
  const db = ensureDemoDb();
  if (!db.categories.some((item) => item.id === id)) throw new Error("削除対象が見つかりませんでした。");
  if (db.transactions.some((row) => row.categoryId === id)) {
    throw new Error("このカテゴリは過去の支出で使用中のため削除できません。「非表示」をご利用ください。");
  }
  db.categories = db.categories.filter((item) => item.id !== id);
  saveDb(db);
  kakeiboCache.invalidateMaster();
}

export async function deletePaymentMethod(id: string) {
  const db = ensureDemoDb();
  if (!db.paymentMethods.some((item) => item.id === id)) throw new Error("削除対象が見つかりませんでした。");
  if (db.transactions.some((row) => row.paymentMethodId === id)) {
    throw new Error("この支払方法は過去の支出で使用中のため削除できません。「非表示」をご利用ください。");
  }
  db.paymentMethods = db.paymentMethods.filter((item) => item.id !== id);
  saveDb(db);
  kakeiboCache.invalidateMaster();
}

export async function createCategory(name: string): Promise<Category> {
  const db = ensureDemoDb();
  const trimmed = name.trim();
  assertUniqueName(db.categories, null, trimmed, "同じ名前のカテゴリが既に存在します（非表示の項目を含む）。");
  // 既存カテゴリと重ならないパレット色を自動で割り当てる（一律グレーにしない）
  const category: Category = {
    id: crypto.randomUUID(),
    name: trimmed,
    color: pickUnusedColor(db.categories.map((item) => item.color)),
    sortOrder: 1000,
    isActive: true,
    code: null,
    isSystem: false,
  };
  db.categories.push(category);
  saveDb(db);
  kakeiboCache.invalidateMaster();
  return category;
}

export async function createPaymentMethod(name: string): Promise<PaymentMethod> {
  const db = ensureDemoDb();
  const trimmed = name.trim();
  assertUniqueName(db.paymentMethods, null, trimmed, "同じ名前の支払方法が既に存在します（非表示の項目を含む）。");
  const method: PaymentMethod = {
    id: crypto.randomUUID(),
    code: `custom_${crypto.randomUUID()}`,
    name: trimmed,
    color: pickUnusedColor(db.paymentMethods.map((item) => item.color)),
    sortOrder: 1000,
    isActive: true,
  };
  db.paymentMethods.push(method);
  saveDb(db);
  kakeiboCache.invalidateMaster();
  return method;
}

export async function createTransaction(input: CreateTransactionInput) {
  const db = ensureDemoDb();
  db.transactions.push({
    id: crypto.randomUUID(),
    occurredAt: new Date(input.occurredAt).toISOString(),
    merchantName: input.merchantName,
    amount: input.amount,
    categoryId: input.categoryId,
    paymentMethodId: input.paymentMethodId,
    cardCompany: null,
    source: "manual",
    isVerified: true,
    transactionType: "purchase",
    expenseType: input.expenseType,
    memo: null,
    externalMessageId: null,
    deletedAt: null,
  });
  saveDb(db);
  kakeiboCache.invalidateTransactions();
}

// 「取込済み」は、削除されていない支出に紐づく取込履歴だけを対象にする。
// 支出を誤って削除した場合は、同じメールをもう一度取り込み直せる（本番と同じ挙動）。
const activeImportLogs = (db: DemoDb) => {
  const activeIds = new Set(activeTransactions(db).map((row) => row.id));
  return db.importLogs.filter((log) => activeIds.has(log.transactionId));
};

export async function registerEmailImport(candidate: ImportCandidate) {
  const db = ensureDemoDb();
  const logs = activeImportLogs(db);
  const registered = logs.some((log) =>
    (log.sourceType === candidate.sourceType && log.sourceHash === candidate.sourceHash)
    || (candidate.externalMessageId && log.externalMessageId === candidate.externalMessageId),
  );
  if (registered) throw new Error("このメールはすでに登録されています。");
  const transactionId = crypto.randomUUID();
  db.transactions.push({
    id: transactionId,
    occurredAt: new Date(`${candidate.occurredOn}T${candidate.occurredTime || "12:00"}:00+09:00`).toISOString(),
    merchantName: candidate.merchantName.trim() || "未取得",
    amount: candidate.amount,
    categoryId: candidate.categoryId,
    paymentMethodId: candidate.paymentMethodId,
    cardCompany: candidate.provider === "smbc" ? "smbc" : null,
    source: candidate.sourceType === "email_paste" ? "pasted_email" : "gmail_api",
    isVerified: true,
    transactionType: "purchase",
    expenseType: candidate.expenseType,
    memo: candidate.memo.trim() || null,
    externalMessageId: candidate.externalMessageId ?? null,
    deletedAt: null,
  });
  db.importLogs.push({
    id: crypto.randomUUID(),
    sourceType: candidate.sourceType,
    sourceHash: candidate.sourceHash,
    externalMessageId: candidate.externalMessageId ?? null,
    transactionId,
  });
  saveDb(db);
  kakeiboCache.invalidateTransactions();
  return transactionId;
}

export async function isEmailImportRegistered(candidate: Pick<ImportCandidate, "sourceHash" | "sourceType" | "externalMessageId">) {
  const db = ensureDemoDb();
  return activeImportLogs(db).some((log) =>
    (log.sourceType === candidate.sourceType && log.sourceHash === candidate.sourceHash)
    || (candidate.externalMessageId && log.externalMessageId === candidate.externalMessageId),
  );
}

export async function fetchRegisteredImportKeys(input: { sourceHashes: string[]; externalMessageIds: string[] }) {
  const db = ensureDemoDb();
  const registered = { sourceHashes: new Set<string>(), externalMessageIds: new Set<string>() };
  const sourceHashes = new Set(input.sourceHashes);
  const externalMessageIds = new Set(input.externalMessageIds);
  for (const log of activeImportLogs(db)) {
    if (sourceHashes.has(log.sourceHash)) registered.sourceHashes.add(log.sourceHash);
    if (log.externalMessageId && externalMessageIds.has(log.externalMessageId)) registered.externalMessageIds.add(log.externalMessageId);
  }
  return registered;
}

export async function fetchImportLogCount() {
  const db = ensureDemoDb();
  return db.importLogs.length;
}

export async function updateTransaction(id: string, input: UpdateTransactionInput) {
  const db = ensureDemoDb();
  const row = db.transactions.find((item) => item.id === id && !item.deletedAt);
  if (!row) throw new Error("更新対象が見つかりませんでした。");
  row.occurredAt = new Date(input.occurredAt).toISOString();
  row.merchantName = input.merchantName;
  row.amount = input.amount;
  row.categoryId = input.categoryId;
  row.paymentMethodId = input.paymentMethodId;
  row.isVerified = input.isVerified;
  row.expenseType = input.expenseType;
  saveDb(db);
  kakeiboCache.invalidateTransactions();
}

// スワイプ削除の「元に戻す」用。ソフト削除を取り消す。
export async function restoreTransaction(id: string) {
  const db = ensureDemoDb();
  const row = db.transactions.find((item) => item.id === id);
  if (!row || !row.deletedAt) throw new Error("元に戻す対象が見つかりませんでした。");
  // 本番では一意制約（23505）が防ぐ「同じメールの再取込との衝突」を、デモでも再現する
  if (row.externalMessageId && activeTransactions(db).some((other) => other.externalMessageId === row.externalMessageId)) {
    throw new Error("同じメールからの支出が再取込されているため、元に戻せませんでした。");
  }
  row.deletedAt = null;
  saveDb(db);
  kakeiboCache.invalidateTransactions();
}

export async function softDeleteTransaction(id: string) {
  const db = ensureDemoDb();
  const row = db.transactions.find((item) => item.id === id && !item.deletedAt);
  if (!row) throw new Error("削除対象を更新できませんでした。");
  row.deletedAt = new Date().toISOString();
  saveDb(db);
  kakeiboCache.invalidateTransactions();
}

// デモデータを初期状態へ戻す（アカウント画面・デモ説明ページから呼ばれる）
export async function resetDemoData() {
  resetDb();
  kakeiboCache.clearAll();
}
