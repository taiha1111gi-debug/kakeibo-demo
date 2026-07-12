"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchMasterData,
  fetchMonthTransactions,
  fetchTransactionById,
  fetchTransactionMonthRange,
  fetchUnclassifiedTransactions,
} from "@/lib/data";
import { kakeiboCache } from "@/lib/kakeiboCache";
import { currentMonthKey, monthKeysBetween } from "@/lib/format";
import type { Category, PaymentMethod, Transaction } from "@/lib/types";

const dataErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const value = error as { code?: string; message?: string };
    if (value.code === "42703" && value.message?.includes("expense_type")) {
      return "Supabaseの追加SQLが未適用です。20260703_add_expense_type.sqlを実行してから再読み込みしてください。";
    }
    if (value.code === "42703" && (value.message?.includes("is_system") || value.message?.includes("code"))) {
      return "Supabaseの追加SQLが未適用です。20260709_add_category_code.sqlを実行してから再読み込みしてください。";
    }
    if (value.message) return value.message;
  }
  return "データの取得に失敗しました。";
};

const sortByOccurredAtDesc = (transactions: Transaction[]) =>
  [...transactions].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

// カテゴリ・支払方法。モジュールキャッシュがあれば即時表示し、reloadで取り直す。
export function useMasterData() {
  const [categories, setCategories] = useState<Category[]>(() => kakeiboCache.getMaster()?.categories ?? []);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(() => kakeiboCache.getMaster()?.paymentMethods ?? []);
  const [isLoading, setIsLoading] = useState(() => !kakeiboCache.getMaster());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force: boolean) => {
    kakeiboCache.hydrate();
    if (force) kakeiboCache.invalidateMaster();
    setError(null);
    // 前回のデータ（stale含む）があれば即表示し、freshでなければ裏で取り直す
    const peeked = kakeiboCache.peekMaster();
    if (peeked) {
      setCategories(peeked.categories);
      setPaymentMethods(peeked.paymentMethods);
      setIsLoading(false);
      if (!force && kakeiboCache.getMaster()) return;
    } else {
      setIsLoading(true);
    }
    try {
      const master = await fetchMasterData();
      setCategories(master.categories);
      setPaymentMethods(master.paymentMethods);
    } catch (nextError) {
      setError(dataErrorMessage(nextError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const reload = useCallback(() => load(true), [load]);
  return { categories, paymentMethods, isLoading, error, reload };
}

// 指定した月キー（JST "YYYY-MM"）の支出だけを取得する。月ごとにキャッシュされる。
export function useMonthTransactions(monthKeys: string[]) {
  const monthsKey = monthKeys.join("|");
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const cached = monthKeys.map((key) => kakeiboCache.getMonth(key));
    return cached.every(Boolean) ? sortByOccurredAtDesc((cached as Transaction[][]).flat()) : [];
  });
  const [isLoading, setIsLoading] = useState(() => monthKeys.length > 0 && !monthKeys.every((key) => kakeiboCache.getMonth(key)));
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const load = useCallback(async (force: boolean) => {
    kakeiboCache.hydrate();
    const keys = monthsKey ? monthsKey.split("|") : [];
    const seq = ++requestSeq.current;
    if (!keys.length) {
      setTransactions([]);
      setIsLoading(false);
      setError(null);
      return;
    }
    if (force) keys.forEach((key) => kakeiboCache.deleteMonth(key));
    setError(null);
    // 前回のデータ（stale含む）が全月分あれば即表示し、freshでない月があれば裏で取り直す
    const peeked = keys.map((key) => kakeiboCache.peekMonth(key));
    if (peeked.every((entry) => entry !== undefined)) {
      setTransactions(sortByOccurredAtDesc(peeked.flatMap((entry) => entry!.transactions)));
      setIsLoading(false);
      if (!force && keys.every((key) => kakeiboCache.getMonth(key))) return;
    } else {
      setIsLoading(true);
    }
    try {
      const results = await Promise.all(keys.map((key) => fetchMonthTransactions(key)));
      if (seq !== requestSeq.current) return; // 古いリクエストの結果は破棄する
      setTransactions(sortByOccurredAtDesc(results.flat()));
    } catch (nextError) {
      if (seq !== requestSeq.current) return;
      setError(dataErrorMessage(nextError));
    } finally {
      if (seq === requestSeq.current) setIsLoading(false);
    }
  }, [monthsKey]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const reload = useCallback(() => load(true), [load]);
  return { transactions, isLoading, error, reload };
}

// 未分類（カテゴリcode = unclassified）の支出を全期間から取得する
export function useUnclassifiedTransactions(enabled = true) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setTransactions(await fetchUnclassifiedTransactions());
    } catch (nextError) {
      setError(dataErrorMessage(nextError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      void load();
    } else {
      setIsLoading(false);
    }
  }, [enabled, load]);

  return { transactions, isLoading, error, reload: load };
}

// 編集画面用のID単件取得
export function useTransaction(id: string) {
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    // クエリパラメータ経由なので、idが欠けた・UUIDでないURLもありうる。
    // そのままDBへ投げると生のPostgresエラーが表示されるため、「見つかりません」扱いにする
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      setTransaction(null);
      setIsLoading(false);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const value = await fetchTransactionById(id);
      if (seq === requestSeq.current) setTransaction(value);
    } catch (nextError) {
      if (seq === requestSeq.current) setError(dataErrorMessage(nextError));
    } finally {
      if (seq === requestSeq.current) setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return { transaction, isLoading, error, reload: load };
}

// 月ナビゲーション用。データが存在する最古月〜最新月（現在月を必ず含む）を昇順で返す。
export function useMonthRange() {
  const [range, setRange] = useState<{ earliestMonth: string; latestMonth: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    kakeiboCache.hydrate();
    const seq = ++requestSeq.current;
    setError(null);
    // 前回の月範囲（stale含む）があれば即使い、freshでなければ裏で取り直す
    const peeked = kakeiboCache.peekMonthRange();
    if (peeked) {
      setRange(peeked);
      setIsLoading(false);
      if (kakeiboCache.getMonthRange()) return;
    } else {
      setIsLoading(true);
    }
    try {
      const value = await fetchTransactionMonthRange();
      if (seq === requestSeq.current) setRange(value);
    } catch (nextError) {
      if (seq === requestSeq.current) setError(dataErrorMessage(nextError));
    } finally {
      if (seq === requestSeq.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const months = useMemo(() => {
    const current = currentMonthKey();
    const earliest = range && range.earliestMonth < current ? range.earliestMonth : current;
    const latest = range && range.latestMonth > current ? range.latestMonth : current;
    return monthKeysBetween(earliest, latest);
  }, [range]);

  return { months, isLoading, error, reload: load };
}
