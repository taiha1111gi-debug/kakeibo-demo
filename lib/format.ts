const yen = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

export const formatCurrency = (amount: number) => yen.format(amount);

export const formatDate = (date: string) =>
  new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Tokyo",
  }).format(new Date(date));

export const toDateTimeLocalValue = (date: string) => {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Tokyo",
  }).format(new Date(date));
  return parts.replace(" ", "T");
};

// datetime-local入力値（"YYYY-MM-DDTHH:mm"）は端末タイムゾーンで解釈されてしまうため、
// 保存時は必ずJST固定のtimestamptz文字列へ変換する。
export const fromDateTimeLocalValue = (value: string) =>
  value.length === 16 ? `${value}:00+09:00` : `${value}+09:00`;

// --- 締め時刻（1日の切り替え時刻）---
// ユーザー設定で0〜6時（JST）を選べる。0なら通常どおり0時、6なら朝6時までの
// 支出を前日として扱う。データ本体(occurred_at)は変更せず、表示と集計の解釈だけを変える。
// 値の出所はユーザー設定（DayBoundaryProviderが起動時に適用する）。
//
// 値は購読可能な小さなストアとして持つ：
// - Reactへは useSyncExternalStore（DayBoundaryProvider）経由で伝わる
// - 正しさが重要なDBクエリ経路（lib/data.ts）は getDayBoundaryHour() で取得した値を
//   下記関数へ明示的に渡す（隠れたグローバル依存をI/O経路から排除する）

const MAX_DAY_BOUNDARY_HOUR = 6;
let dayBoundaryHour = 0;
const dayBoundaryListeners = new Set<() => void>();

export const setDayBoundaryHour = (hour: number) => {
  const next = Number.isInteger(hour) && hour >= 0 && hour <= MAX_DAY_BOUNDARY_HOUR ? hour : 0;
  if (next === dayBoundaryHour) return;
  dayBoundaryHour = next;
  dayBoundaryListeners.forEach((listener) => listener());
};

export const getDayBoundaryHour = () => dayBoundaryHour;

export const subscribeDayBoundaryHour = (listener: () => void) => {
  dayBoundaryListeners.add(listener);
  return () => {
    dayBoundaryListeners.delete(listener);
  };
};

// --- 月キー（JST基準の "YYYY-MM"）ユーティリティ ---
// occurred_atはUTC表記で保持されるため、slice(0, 7)ではJSTの月境界
// （1日の0時〜9時）がひと月ずれる。月・日単位の判定は必ずここを通す。

const jstDateKeyFormat = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Tokyo",
});

// 締め時刻ぶん巻き戻してから日付を取ると、「朝6時までは前日」の解釈になる。
// hourを省略した場合はストアの現在値を使う（表示用途）。クエリ経路は明示的に渡すこと。
const shiftForBoundary = (date: Date, hour: number) => new Date(date.getTime() - hour * 3_600_000);

export const jstDateKeyOf = (isoDate: string, hour: number = dayBoundaryHour) =>
  jstDateKeyFormat.format(shiftForBoundary(new Date(isoDate), hour));

export const jstMonthKeyOf = (isoDate: string, hour: number = dayBoundaryHour) => jstDateKeyOf(isoDate, hour).slice(0, 7);

export const currentDateKey = (hour: number = dayBoundaryHour) => jstDateKeyFormat.format(shiftForBoundary(new Date(), hour));

export const currentMonthKey = (hour: number = dayBoundaryHour) => currentDateKey(hour).slice(0, 7);

export const shiftMonthKey = (monthKey: string, offset: number) => {
  const [year, month] = monthKey.split("-").map(Number);
  const total = year * 12 + (month - 1) + offset;
  const shiftedYear = Math.floor(total / 12);
  const shiftedMonth = ((total % 12) + 12) % 12 + 1;
  return `${shiftedYear}-${String(shiftedMonth).padStart(2, "0")}`;
};

export const daysInMonth = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
};

// 月キー → occurred_at(timestamptz)のJST範囲 [start, end)。サーバー側の月フィルタに使う。
// 締め時刻設定時は「1日の締め時刻 〜 翌月1日の締め時刻」が1か月になる。
export const monthKeyToJstRange = (monthKey: string, hour: number = dayBoundaryHour) => {
  const boundary = `T${String(hour).padStart(2, "0")}:00:00+09:00`;
  return {
    startIso: `${monthKey}-01${boundary}`,
    endIso: `${shiftMonthKey(monthKey, 1)}-01${boundary}`,
  };
};

// earliest〜latest（両端含む）の月キーを昇順で列挙する
export const monthKeysBetween = (earliest: string, latest: string) => {
  const keys: string[] = [];
  for (let key = earliest; key <= latest && keys.length < 240; key = shiftMonthKey(key, 1)) {
    keys.push(key);
  }
  return keys;
};
