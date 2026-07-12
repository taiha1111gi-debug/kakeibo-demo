import { getDayBoundaryHour, setDayBoundaryHour } from "@/lib/format";
import type { Category, PaymentMethod, Transaction } from "@/lib/types";

// 月別支出・マスタ・月範囲のキャッシュ。
// メモリ（ページ遷移間の再取得防止）に加えてlocalStorageへ永続化し、アプリを
// 開き直した直後は前回のデータを即表示（stale）→裏で取り直す（revalidate）。
// - fresh: このセッションでSupabaseから取得した値。再取得せずそのまま使える。
// - stale: localStorageから復元した値。即表示には使うが、必ず裏で取り直す。
// 支出の作成・更新・削除・取込の成功時に data.ts 側が invalidateTransactions() を呼ぶ。

type MasterData = { categories: Category[]; paymentMethods: PaymentMethod[] };
type MonthRange = { earliestMonth: string; latestMonth: string };
type MonthEntry = { transactions: Transaction[]; isFresh: boolean };

const STORAGE_KEY = "kakeibo-cache";
const CACHE_VERSION = 1;
// 古すぎるキャッシュは復元しない（別端末で変更した内容が長く残り続けるのを防ぐ）
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
// localStorageの肥大化を防ぐため、直近の月だけ永続化する
const MAX_PERSISTED_MONTHS = 13;

type PersistedCache = {
  version: number;
  userId: string | null;
  savedAt: number;
  // 月バケツの解釈は締め時刻に依存するため、保存時の値を一緒に持つ
  dayBoundaryHour?: number;
  master: MasterData | null;
  monthRange: MonthRange | null;
  months: Record<string, Transaction[]>;
};

const months = new Map<string, MonthEntry>();
let master: { value: MasterData; isFresh: boolean } | null = null;
let monthRange: { value: MonthRange; isFresh: boolean } | null = null;
let ownerId: string | null = null;
let hydrated = false;
// キャッシュの世代番号。無効化のたびに進み、無効化より前に始まった取得の
// 書き込み（通信の追い越しで遅れて届いた古いデータ）を捨てるために使う。
let generation = 0;

const hasStorage = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

// 本番版ではここで認証セッションからユーザーIDを同期的に読み、
// 復元したキャッシュが別ユーザーのものだった場合に全消しする（共有端末対策）。
// デモ版はユーザーが常に1人なので照合は不要（setOwnerでの整合だけ残す）。
const readSessionUserId = (): string | null => null;

const clearStorage = () => {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 消せなくても実害はない（次回hydrateの検証で再度弾かれる）
  }
};

const persist = () => {
  if (!hasStorage()) return;
  try {
    const persistedMonthKeys = [...months.keys()].sort().slice(-MAX_PERSISTED_MONTHS);
    const payload: PersistedCache = {
      version: CACHE_VERSION,
      userId: ownerId,
      savedAt: Date.now(),
      dayBoundaryHour: getDayBoundaryHour(),
      master: master?.value ?? null,
      monthRange: monthRange?.value ?? null,
      months: Object.fromEntries(persistedMonthKeys.map((key) => [key, months.get(key)!.transactions])),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // 容量超過などで保存できなくても、メモリキャッシュだけで動作を続ける
  }
};

export const kakeiboCache = {
  // localStorageから前回のデータを復元する（クライアントで一度だけ・冪等）。復元分はstale扱い。
  // hydration mismatchを避けるため、モジュール読込時ではなくフックのuseEffectから呼ぶ。
  hydrate: () => {
    if (hydrated || !hasStorage()) return;
    hydrated = true;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const persisted = JSON.parse(raw) as PersistedCache;
      if (persisted.version !== CACHE_VERSION) return clearStorage();
      if (!persisted.savedAt || Date.now() - persisted.savedAt > MAX_AGE_MS) return clearStorage();
      const sessionUserId = readSessionUserId();
      if (sessionUserId && persisted.userId && sessionUserId !== persisted.userId) return clearStorage();
      ownerId = persisted.userId;
      // 前回の締め時刻を先に適用してから復元する（月バケツの解釈を保存時と一致させる）
      setDayBoundaryHour(persisted.dayBoundaryHour ?? 0);
      if (persisted.master && !master) master = { value: persisted.master, isFresh: false };
      if (persisted.monthRange && !monthRange) monthRange = { value: persisted.monthRange, isFresh: false };
      for (const [key, transactions] of Object.entries(persisted.months ?? {})) {
        if (!months.has(key) && Array.isArray(transactions)) {
          months.set(key, { transactions, isFresh: false });
        }
      }
    } catch {
      clearStorage();
    }
  },

  // ensureUser後に呼ぶ。ユーザーが変わっていたらキャッシュを全消しする（アカウント切替対策）。
  setOwner: (userId: string) => {
    if (ownerId === userId) return;
    generation += 1;
    months.clear();
    master = null;
    monthRange = null;
    ownerId = userId;
    persist();
  },

  // ログアウト時に呼ぶ。メモリ・localStorageの両方から家計データを完全に消す
  // （共有端末に前ユーザーの支出キャッシュを残さないため）。
  clearAll: () => {
    generation += 1;
    months.clear();
    master = null;
    monthRange = null;
    ownerId = null;
    clearStorage();
  },

  // 取得開始時に控えておき、setMonthに渡すことで「無効化前に始まった取得」の書き込みを防ぐ
  getGeneration: () => generation,

  // fresh（このセッションで取得済み）のときだけ返す。データ取得の短絡に使う。
  getMonth: (monthKey: string) => {
    const entry = months.get(monthKey);
    return entry?.isFresh ? entry.transactions : undefined;
  },
  // staleも含めて返す。「即表示→裏で更新」の即表示側に使う。
  peekMonth: (monthKey: string) => months.get(monthKey),
  setMonth: (monthKey: string, transactions: Transaction[], generationAtFetchStart?: number) => {
    // 取得中に無効化（登録・削除・設定変更・ログアウト）が起きていたら、古いデータを書き込まない
    if (generationAtFetchStart !== undefined && generationAtFetchStart !== generation) return;
    months.set(monthKey, { transactions, isFresh: true });
    persist();
  },
  deleteMonth: (monthKey: string) => {
    generation += 1;
    months.delete(monthKey);
  },
  invalidateTransactions: () => {
    generation += 1;
    months.clear();
    // 支出の追加・削除は最古月/最新月も変えうるので月範囲も一緒に破棄する
    monthRange = null;
    persist();
  },

  getMaster: () => (master?.isFresh ? master.value : null),
  peekMaster: () => master?.value ?? null,
  setMaster: (value: MasterData, generationAtFetchStart?: number) => {
    if (generationAtFetchStart !== undefined && generationAtFetchStart !== generation) return;
    master = { value, isFresh: true };
    persist();
  },
  invalidateMaster: () => {
    generation += 1;
    master = null;
    persist();
  },

  getMonthRange: () => (monthRange?.isFresh ? monthRange.value : null),
  peekMonthRange: () => monthRange?.value ?? null,
  setMonthRange: (value: MonthRange, generationAtFetchStart?: number) => {
    if (generationAtFetchStart !== undefined && generationAtFetchStart !== generation) return;
    monthRange = { value, isFresh: true };
    persist();
  },
};
