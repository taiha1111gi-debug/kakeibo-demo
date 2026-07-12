"use client";

import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  fetchUserSettings,
  saveCalendarTypes,
  saveDayBoundaryHour,
  saveExpenseTypeOverrides,
  saveGmailSettings,
} from "@/lib/data";
import { resolveExpenseTypes, type ExpenseTypeOverride, type ExpenseTypeOverrides } from "@/lib/expenseTypes";
import { getDayBoundaryHour, setDayBoundaryHour, subscribeDayBoundaryHour } from "@/lib/format";
import { kakeiboCache } from "@/lib/kakeiboCache";
import type { ExpenseType } from "@/lib/types";

// ユーザー設定（締め時刻・支出タイプの表示名/非表示・カレンダーの表示タイプ）を全画面へ配る。
// 締め時刻はformat.ts内の購読可能なストアが持ち、変更はuseSyncExternalStoreで自然に再描画される
// （以前のkey={hour}による全ツリー再マウントは廃止。月キャッシュの無効化は変更時に行う）。

export const DAY_BOUNDARY_OPTIONS = [0, 3, 4, 5, 6] as const;

type SaveStatus = "idle" | "saving" | "saved";

type SettingsContextValue = {
  hour: number;
  saveStatus: SaveStatus;
  saveError: string | null;
  updateHour: (hour: number) => Promise<void>;
  expenseTypeOverrides: ExpenseTypeOverrides;
  updateExpenseTypeOverride: (value: ExpenseType, patch: ExpenseTypeOverride) => Promise<void>;
  calendarTypes: ExpenseType[] | null;
  updateCalendarTypes: (types: ExpenseType[] | null) => Promise<void>;
  // Gmail差分取得のチェックポイント（エポックms）と保存済み検索条件。端末間で同期される
  gmailLastFetchedAt: number | null;
  markGmailFetched: (atMs: number) => Promise<void>;
  resetGmailFetched: () => Promise<void>;
  gmailQuery: string | null;
  updateGmailQuery: (query: string | null) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue>({
  hour: 0,
  saveStatus: "idle",
  saveError: null,
  updateHour: async () => undefined,
  expenseTypeOverrides: {},
  updateExpenseTypeOverride: async () => undefined,
  calendarTypes: null,
  updateCalendarTypes: async () => undefined,
  gmailLastFetchedAt: null,
  markGmailFetched: async () => undefined,
  resetGmailFetched: async () => undefined,
  gmailQuery: null,
  updateGmailQuery: async () => undefined,
});

export function DayBoundaryProvider({ children }: { children: ReactNode }) {
  // format.ts内のストアを購読する。値の変更で購読コンポーネントだけが再描画される
  const hour = useSyncExternalStore(subscribeDayBoundaryHour, getDayBoundaryHour, () => 0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [expenseTypeOverrides, setExpenseTypeOverrides] = useState<ExpenseTypeOverrides>({});
  const [calendarTypes, setCalendarTypes] = useState<ExpenseType[] | null>(null);
  const [gmailLastFetchedAt, setGmailLastFetchedAt] = useState<number | null>(null);
  const [gmailQuery, setGmailQuery] = useState<string | null>(null);

  useEffect(() => {
    // 永続キャッシュに保存された前回の締め時刻を即適用し、その後サーバー設定と同期する
    kakeiboCache.hydrate();
    void fetchUserSettings()
      .then((settings) => {
        if (settings.dayBoundaryHour !== getDayBoundaryHour()) {
          setDayBoundaryHour(settings.dayBoundaryHour);
          kakeiboCache.invalidateTransactions();
        }
        setExpenseTypeOverrides(settings.expenseTypeOverrides);
        setCalendarTypes(settings.calendarTypes);
        setGmailLastFetchedAt(settings.gmailLastFetchedAt);
        setGmailQuery(settings.gmailQuery);
      })
      .catch(() => {
        // 未ログイン・通信断・SQL未適用のときは前回値（既定）のまま動かす
      });
  }, []);

  const updateHour = useCallback(async (next: number) => {
    setSaveStatus("saving");
    setSaveError(null);
    try {
      await saveDayBoundaryHour(next);
      setDayBoundaryHour(next);
      // 月バケツの解釈が変わるので取り直させる（次に月データを使う画面が取得し直す）
      kakeiboCache.invalidateTransactions();
      setSaveStatus("saved");
      window.setTimeout(() => setSaveStatus("idle"), 2500);
    } catch (nextError) {
      setSaveStatus("idle");
      setSaveError(nextError instanceof Error ? nextError.message : "設定を保存できませんでした。");
      throw nextError;
    }
  }, []);

  const updateExpenseTypeOverride = useCallback(async (value: ExpenseType, patch: ExpenseTypeOverride) => {
    // 楽観更新はせず、保存成功後に反映する（失敗時に表示が巻き戻る混乱を避ける）
    const current = expenseTypeOverrides[value] ?? {};
    const merged: ExpenseTypeOverride = { ...current, ...patch };
    if (merged.label !== undefined && !merged.label.trim()) delete merged.label;
    if (merged.hidden !== true) delete merged.hidden;
    const next: ExpenseTypeOverrides = { ...expenseTypeOverrides };
    if (Object.keys(merged).length) {
      next[value] = merged;
    } else {
      delete next[value];
    }
    await saveExpenseTypeOverrides(next);
    setExpenseTypeOverrides(next);
  }, [expenseTypeOverrides]);

  const updateCalendarTypes = useCallback(async (types: ExpenseType[] | null) => {
    await saveCalendarTypes(types);
    setCalendarTypes(types);
  }, []);

  const markGmailFetched = useCallback(async (atMs: number) => {
    await saveGmailSettings({ lastFetchedAt: atMs });
    setGmailLastFetchedAt(atMs);
  }, []);

  const resetGmailFetched = useCallback(async () => {
    await saveGmailSettings({ lastFetchedAt: null });
    setGmailLastFetchedAt(null);
  }, []);

  const updateGmailQuery = useCallback(async (query: string | null) => {
    await saveGmailSettings({ query });
    setGmailQuery(query);
  }, []);

  return (
    <SettingsContext.Provider value={{ hour, saveStatus, saveError, updateHour, expenseTypeOverrides, updateExpenseTypeOverride, calendarTypes, updateCalendarTypes, gmailLastFetchedAt, markGmailFetched, resetGmailFetched, gmailQuery, updateGmailQuery }}>
      {children}
    </SettingsContext.Provider>
  );
}

// Gmail取込のチェックポイント・保存済み検索条件（取込画面とホームの「最終取得」表示が使う）
export const useGmailSettings = () => {
  const { gmailLastFetchedAt, markGmailFetched, resetGmailFetched, gmailQuery, updateGmailQuery } = useContext(SettingsContext);
  return { gmailLastFetchedAt, markGmailFetched, resetGmailFetched, gmailQuery, updateGmailQuery };
};

export const useDayBoundary = () => useContext(SettingsContext);

// 上書き適用済みの支出タイプ一覧（表示名・非表示フラグつき）
export const useExpenseTypes = () => resolveExpenseTypes(useContext(SettingsContext).expenseTypeOverrides);

// カレンダーの表示タイプ設定（null = すべて）
export const useCalendarTypes = () => {
  const { calendarTypes, updateCalendarTypes } = useContext(SettingsContext);
  return { calendarTypes, updateCalendarTypes };
};
