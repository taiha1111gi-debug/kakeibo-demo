import { currentDateKey, currentMonthKey, daysInMonth, shiftMonthKey } from "@/lib/format";
import type { ExpenseTypeOverrides } from "@/lib/expenseTypes";
import type { CardCompany, Category, ExpenseType, PaymentMethod, TransactionSource, TransactionType } from "@/lib/types";

// 公開デモのデータ置き場。SupabaseのかわりにlocalStorageへ保存する。
// 表示されるデータはすべて架空で、外部への通信は発生しない。

export const DEMO_USER_ID = "demo-user";
const STORAGE_KEY = "kakeibo-demo-db";
const DB_VERSION = 1;

export type DemoTransactionRow = {
  id: string;
  occurredAt: string; // ISO(UTC)。本番のtimestamptzと同じ解釈で比較できる
  merchantName: string;
  amount: number;
  categoryId: string;
  paymentMethodId: string;
  cardCompany: CardCompany;
  source: TransactionSource;
  isVerified: boolean;
  transactionType: TransactionType;
  expenseType: ExpenseType;
  memo: string | null;
  externalMessageId: string | null;
  deletedAt: string | null;
};

export type DemoImportLog = {
  id: string;
  sourceType: string;
  sourceHash: string;
  externalMessageId: string | null;
  transactionId: string;
};

export type DemoSettings = {
  dayBoundaryHour: number;
  expenseTypeOverrides: ExpenseTypeOverrides;
  calendarTypes: ExpenseType[] | null;
  gmailLastFetchedAt: number | null;
  gmailQuery: string | null;
};

export type DemoDb = {
  version: number;
  // シード時の月。月が変わったら再シードして「今月のデモデータ」を常に見せる
  seededMonth: string;
  categories: Category[];
  paymentMethods: PaymentMethod[];
  transactions: DemoTransactionRow[];
  importLogs: DemoImportLog[];
  settings: DemoSettings;
};

const DEFAULT_SETTINGS: DemoSettings = {
  dayBoundaryHour: 0,
  expenseTypeOverrides: {},
  calendarTypes: null,
  gmailLastFetchedAt: null,
  gmailQuery: null,
};

// 本番と同じ初期マスタ（雛形）。名前・色・並び順を実運用版のseedに合わせている。
const CATEGORY_SEED: [name: string, color: string, sortOrder: number, code: string | null, isSystem: boolean][] = [
  ["食費（仕事中）", "#55a67a", 10, null, false],
  ["飲み", "#b071c7", 20, null, false],
  ["交際費", "#d06f9b", 30, null, false],
  ["娯楽", "#e06d83", 40, null, false],
  ["外食", "#eb8b5c", 50, null, false],
  ["日用品", "#d3a245", 60, null, false],
  ["医療", "#40a9a5", 70, null, false],
  ["衣服", "#7c80d4", 80, null, false],
  ["デジタル購入", "#687787", 90, null, false],
  ["サブスク", "#8a72b6", 100, null, false],
  ["交通費", "#4e8fd3", 110, null, false],
  ["未分類", "#e2a52e", 120, "unclassified", true],
];

const PAYMENT_METHOD_SEED: [code: string, name: string, color: string, sortOrder: number][] = [
  ["cash", "現金", "#d39a4a", 10],
  ["paypay", "PayPay", "#e05a5a", 20],
  ["credit_card", "クレジットカード", "#47725d", 30],
  ["other", "その他", "#88938d", 40],
];

// 毎月同じ日に発生する支出（サブスク・経常消費）
type FixedSeedItem = { day: number; merchant: string; category: string; pm: string; type: ExpenseType; amount: number };
const FIXED_ITEMS: FixedSeedItem[] = [
  { day: 1, merchant: "Netflix", category: "サブスク", pm: "credit_card", type: "subscription", amount: 1490 },
  { day: 5, merchant: "Spotify", category: "サブスク", pm: "credit_card", type: "subscription", amount: 980 },
  { day: 10, merchant: "ジム月会費", category: "娯楽", pm: "credit_card", type: "subscription", amount: 7678 },
  { day: 2, merchant: "通勤定期券（1か月）", category: "交通費", pm: "credit_card", type: "recurring", amount: 8800 },
  { day: 20, merchant: "携帯電話料金", category: "デジタル購入", pm: "credit_card", type: "recurring", amount: 3278 },
  { day: 15, merchant: "コンタクトレンズ定期便", category: "医療", pm: "credit_card", type: "recurring", amount: 2980 },
];

// 月内にばらつく支出（回数・金額・日付を乱数で決める）
type VariableSeedItem = {
  merchant: string; category: string; pm: string; type: ExpenseType;
  min: number; max: number; minCount: number; maxCount: number;
};
const VARIABLE_ITEMS: VariableSeedItem[] = [
  { merchant: "セブン-イレブン", category: "食費（仕事中）", pm: "paypay", type: "daily", min: 380, max: 880, minCount: 6, maxCount: 9 },
  { merchant: "ローソン", category: "食費（仕事中）", pm: "paypay", type: "daily", min: 320, max: 780, minCount: 3, maxCount: 5 },
  { merchant: "まいばすけっと", category: "日用品", pm: "credit_card", type: "daily", min: 900, max: 2400, minCount: 4, maxCount: 6 },
  { merchant: "マツモトキヨシ", category: "日用品", pm: "paypay", type: "daily", min: 700, max: 1900, minCount: 1, maxCount: 2 },
  { merchant: "サイゼリヤ", category: "外食", pm: "cash", type: "daily", min: 1000, max: 1800, minCount: 1, maxCount: 2 },
  { merchant: "マクドナルド", category: "外食", pm: "paypay", type: "daily", min: 590, max: 1080, minCount: 1, maxCount: 3 },
  { merchant: "スターバックス", category: "外食", pm: "credit_card", type: "daily", min: 550, max: 750, minCount: 2, maxCount: 3 },
  { merchant: "すき家", category: "外食", pm: "paypay", type: "daily", min: 480, max: 980, minCount: 1, maxCount: 2 },
  { merchant: "居酒屋 花くら", category: "飲み", pm: "cash", type: "daily", min: 3200, max: 5800, minCount: 1, maxCount: 2 },
  { merchant: "友人と飲み会", category: "飲み", pm: "paypay", type: "daily", min: 4000, max: 6000, minCount: 0, maxCount: 1 },
  { merchant: "モバイルSuicaチャージ", category: "交通費", pm: "credit_card", type: "daily", min: 3000, max: 3000, minCount: 2, maxCount: 3 },
  { merchant: "TOHOシネマズ", category: "娯楽", pm: "credit_card", type: "daily", min: 2000, max: 2000, minCount: 0, maxCount: 1 },
  { merchant: "Steam", category: "デジタル購入", pm: "credit_card", type: "daily", min: 1480, max: 2980, minCount: 0, maxCount: 1 },
  { merchant: "ユニクロ", category: "衣服", pm: "credit_card", type: "daily", min: 2990, max: 6990, minCount: 0, maxCount: 1 },
  { merchant: "内科クリニック", category: "医療", pm: "cash", type: "necessary", min: 1450, max: 2300, minCount: 0, maxCount: 1 },
  { merchant: "処方箋薬局", category: "医療", pm: "cash", type: "necessary", min: 680, max: 1400, minCount: 0, maxCount: 1 },
  { merchant: "友人へのプレゼント", category: "交際費", pm: "credit_card", type: "daily", min: 2500, max: 4500, minCount: 0, maxCount: 1 },
  { merchant: "資格試験テキスト", category: "デジタル購入", pm: "credit_card", type: "necessary", min: 2200, max: 3300, minCount: 0, maxCount: 1 },
];

// 未分類カテゴリのまま残っている取込例（当月のみ）。未分類画面のデモに使う
const UNCLASSIFIED_ITEMS: { merchant: string; amount: number }[] = [
  { merchant: "Amazon.co.jp", amount: 2480 },
  { merchant: "楽天市場", amount: 1980 },
];

// 固定シードの擬似乱数（月ごとに同じ並びを再現する）
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const randInt = (rand: () => number, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

const toIso = (monthKey: string, day: number, hour: number, minute: number) =>
  new Date(`${monthKey}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+09:00`).toISOString();

const buildMonthRows = (
  monthKey: string,
  maxDay: number,
  fullDays: number,
  categoryIdByName: Map<string, string>,
  paymentMethodIdByCode: Map<string, string>,
): DemoTransactionRow[] => {
  const rand = mulberry32(Number(monthKey.replace("-", "")));
  const rows: DemoTransactionRow[] = [];
  const push = (item: { day: number; merchant: string; category: string; pm: string; type: ExpenseType; amount: number }) => {
    if (item.day > maxDay) return;
    const categoryId = categoryIdByName.get(item.category);
    const paymentMethodId = paymentMethodIdByCode.get(item.pm);
    if (!categoryId || !paymentMethodId) return;
    rows.push({
      id: crypto.randomUUID(),
      occurredAt: toIso(monthKey, item.day, randInt(rand, 8, 21), randInt(rand, 0, 59)),
      merchantName: item.merchant,
      amount: item.amount,
      categoryId,
      paymentMethodId,
      cardCompany: null,
      source: "manual",
      isVerified: true,
      transactionType: "purchase",
      expenseType: item.type,
      memo: null,
      externalMessageId: null,
      deletedAt: null,
    });
  };
  for (const item of FIXED_ITEMS) push(item);
  for (const item of VARIABLE_ITEMS) {
    // 月の途中（当月）は経過日数ぶんだけ発生させ、前月比が不自然に膨らまないようにする
    const count = Math.round(randInt(rand, item.minCount, item.maxCount) * (maxDay / fullDays));
    for (let index = 0; index < count; index += 1) {
      push({
        day: randInt(rand, 1, maxDay),
        merchant: item.merchant,
        category: item.category,
        pm: item.pm,
        type: item.type,
        amount: randInt(rand, item.min, item.max),
      });
    }
  }
  return rows;
};

const seedDb = (): DemoDb => {
  const categories: Category[] = CATEGORY_SEED.map(([name, color, sortOrder, code, isSystem]) => ({
    id: crypto.randomUUID(), name, color, sortOrder, isActive: true, code, isSystem,
  }));
  const paymentMethods: PaymentMethod[] = PAYMENT_METHOD_SEED.map(([code, name, color, sortOrder]) => ({
    id: crypto.randomUUID(), code, name, color, sortOrder, isActive: true,
  }));
  const categoryIdByName = new Map(categories.map((category) => [category.name, category.id]));
  const paymentMethodIdByCode = new Map(paymentMethods.map((method) => [method.code, method.id]));

  // 締め時刻の初期値は0時なので、シードの月解釈も0時基準で固定する
  const currentMonth = currentMonthKey(0);
  const todayDay = Number(currentDateKey(0).slice(8, 10));
  const transactions: DemoTransactionRow[] = [];
  for (const offset of [-2, -1, 0]) {
    const monthKey = shiftMonthKey(currentMonth, offset);
    const fullDays = daysInMonth(monthKey);
    const maxDay = offset === 0 ? todayDay : fullDays;
    transactions.push(...buildMonthRows(monthKey, maxDay, fullDays, categoryIdByName, paymentMethodIdByCode));
  }

  // 当月の未分類（取込直後にカテゴリを直していない想定の架空データ）
  const unclassifiedId = categories.find((category) => category.code === "unclassified")?.id;
  const creditCardId = paymentMethodIdByCode.get("credit_card");
  if (unclassifiedId && creditCardId) {
    const rand = mulberry32(Number(currentMonth.replace("-", "")) + 7);
    for (const item of UNCLASSIFIED_ITEMS) {
      transactions.push({
        id: crypto.randomUUID(),
        occurredAt: toIso(currentMonth, Math.max(1, randInt(rand, Math.max(1, todayDay - 6), todayDay)), randInt(rand, 9, 21), randInt(rand, 0, 59)),
        merchantName: item.merchant,
        amount: item.amount,
        categoryId: unclassifiedId,
        paymentMethodId: creditCardId,
        cardCompany: "smbc",
        source: "pasted_email",
        isVerified: true,
        transactionType: "purchase",
        expenseType: "daily",
        memo: null,
        externalMessageId: null,
        deletedAt: null,
      });
    }
  }

  return {
    version: DB_VERSION,
    seededMonth: currentMonth,
    categories,
    paymentMethods,
    transactions,
    importLogs: [],
    settings: { ...DEFAULT_SETTINGS },
  };
};

const hasStorage = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const loadDb = (): DemoDb | null => {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const db = JSON.parse(raw) as DemoDb;
    if (db.version !== DB_VERSION) return null;
    return db;
  } catch {
    return null;
  }
};

export const saveDb = (db: DemoDb) => {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // 容量超過などで保存できなくても、メモリ上の動作は続ける
  }
};

// デモDBを取得する（無ければシード）。月が変わっていたら作り直して、
// いつ訪れても「今月の家計」が入っている状態を保つ。
export const ensureDb = (): DemoDb => {
  const loaded = loadDb();
  if (loaded && loaded.seededMonth === currentMonthKey(0)) return loaded;
  const db = seedDb();
  saveDb(db);
  return db;
};

// デモデータを初期状態へ戻す
export const resetDb = (): DemoDb => {
  const db = seedDb();
  saveDb(db);
  return db;
};
