"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchMonthTransactions,
  fetchRegisteredImportKeys,
  isEmailImportRegistered,
  registerEmailImport,
} from "@/lib/data";
import { buildTransactionMatchKeySet, candidateMatchKey } from "@/lib/import/duplicate";
import { parseEmail } from "@/lib/import/parseEmail";
import { useGmailSettings } from "@/components/DayBoundaryProvider";
import { SAMPLE_MAILS } from "@/data/demo/sampleMails";
import type { ImportCandidate, ParseEmailResult } from "@/lib/import/types";
import { UNCLASSIFIED_CATEGORY_CODE, type Category, type PaymentMethod } from "@/lib/types";

// 公開デモの取込フロー。本番版ではサンプルメールの部分がGmail APIの差分取得
// （ページネーション＋チェックポイント管理）になるだけで、解析（パーサー）・
// 重複判定・確認して登録という流れ自体は本番と同じコードを使っている。

export type EditableCandidate = ImportCandidate & {
  status: "idle" | "saving" | "saved";
  error?: string;
  needsDuplicateConfirmation?: boolean;
};

export type GmailSummary = {
  fetched: number;
  parsed: number;
  alreadyImported: number;
  unparsed: number;
};

export type BulkRegisterResult = { registered: number; duplicates: number; failed: number };

type UseGmailImportInput = {
  categories: Category[];
  paymentMethods: PaymentMethod[];
  // マスタデータの読込完了後にtrue。autoFetchの発火条件に使う。
  ready: boolean;
  autoFetch: boolean;
};

export function useGmailImport({ categories, paymentMethods, ready, autoFetch }: UseGmailImportInput) {
  const [candidates, setCandidates] = useState<EditableCandidate[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isBulkRegistering, setIsBulkRegistering] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkRegisterResult | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [gmailError, setGmailError] = useState<string | null>(null);
  const [summary, setSummary] = useState<GmailSummary | null>(null);
  // ホームの「最終取得」表示用（本番ではGmail差分取得のチェックポイント）
  const { markGmailFetched } = useGmailSettings();

  // 「登録候補と一致する既存支出」の判定キー。取得時に候補の該当月だけを読んで作る。
  const existingMatchKeys = useRef<Set<string>>(new Set());
  const [registeredMatchKeys, setRegisteredMatchKeys] = useState<Set<string>>(() => new Set());

  const updateCandidate = useCallback(<K extends keyof EditableCandidate>(id: string, key: K, value: EditableCandidate[K]) => {
    setCandidates((items) => items.map((item) => item.id === id ? { ...item, [key]: value, error: undefined, needsDuplicateConfirmation: false } : item));
  }, []);

  const removeCandidate = useCallback((id: string) => {
    setCandidates((items) => items.filter((item) => item.id !== id));
  }, []);

  const applyCandidatePatch = useCallback((id: string, patch: Partial<EditableCandidate>) => {
    setCandidates((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  }, []);

  const buildEditableCandidates = useCallback((parsed: ParseEmailResult["candidates"]): EditableCandidate[] | null => {
    const unclassified = categories.find((item) => item.code === UNCLASSIFIED_CATEGORY_CODE) ?? categories[0];
    const creditCard = paymentMethods.find((item) => item.code === "credit_card") ?? paymentMethods[0];
    if (!unclassified || !creditCard) return null;
    return parsed.map((candidate) => ({
      ...candidate,
      categoryId: unclassified.id,
      paymentMethodId: creditCard.id,
      expenseType: "daily" as const,
      status: "idle" as const,
    }));
  }, [categories, paymentMethods]);

  const fetchSamples = useCallback(async () => {
    setIsFetching(true);
    setGmailError(null);
    setSummary(null);
    setBulkResult(null);
    setWarnings([]);
    setCandidates([]);
    try {
      const emails = SAMPLE_MAILS;
      let unparsed = 0;
      const parsedCandidates: ParseEmailResult["candidates"] = [];
      const parseWarnings = new Set<string>();
      for (const email of emails) {
        let result: ParseEmailResult;
        try {
          result = await parseEmail(email.bodyText, { sourceType: "gmail_api", externalMessageId: email.id });
        } catch (parseError) {
          result = {
            candidates: [],
            warnings: [parseError instanceof Error ? parseError.message : "解析中にエラーが発生しました。"],
            provider: "unknown",
          };
        }
        if (!result.candidates.length) {
          unparsed += 1;
          result.warnings.forEach((warning) => parseWarnings.add(warning));
          continue;
        }
        parsedCandidates.push(...result.candidates);
      }
      // 登録済みのメールを候補から除外する（取込済みフィルタ）
      const registered = parsedCandidates.length ? await fetchRegisteredImportKeys({
        sourceHashes: parsedCandidates.map((candidate) => candidate.sourceHash),
        externalMessageIds: parsedCandidates.flatMap((candidate) => candidate.externalMessageId ? [candidate.externalMessageId] : []),
      }) : { sourceHashes: new Set<string>(), externalMessageIds: new Set<string>() };
      const fresh = parsedCandidates.filter((candidate) =>
        !registered.sourceHashes.has(candidate.sourceHash)
        && !(candidate.externalMessageId && registered.externalMessageIds.has(candidate.externalMessageId)),
      );
      const editable = buildEditableCandidates(fresh);
      if (fresh.length && !editable) {
        setGmailError("カテゴリまたは支払方法がありません。先に支出追加画面で作成してください。");
        return;
      }
      // 既存支出との類似判定用に、候補が属する月の支出だけを読む
      const candidateMonths = [...new Set(fresh.map((candidate) => candidate.occurredOn.slice(0, 7)))];
      const monthTransactions = await Promise.all(candidateMonths.map((monthKey) => fetchMonthTransactions(monthKey)));
      existingMatchKeys.current = buildTransactionMatchKeySet(monthTransactions.flat());
      setRegisteredMatchKeys(new Set());
      setCandidates(editable ?? []);
      setWarnings([...parseWarnings]);
      setSummary({
        fetched: emails.length,
        parsed: parsedCandidates.length,
        alreadyImported: parsedCandidates.length - fresh.length,
        unparsed,
      });
      void markGmailFetched(Date.now()).catch(() => undefined);
    } catch (nextError) {
      setGmailError(nextError instanceof Error ? nextError.message : "サンプル通知の取得に失敗しました。");
    } finally {
      setIsFetching(false);
    }
  }, [buildEditableCandidates, markGmailFetched]);

  // ホームの「更新」から ?autoFetch=1 で遷移してきた場合は、到着時に一度だけ自動取得する
  const autoFetchStarted = useRef(false);
  useEffect(() => {
    if (!ready || !autoFetch) return;
    if (autoFetchStarted.current) return;
    autoFetchStarted.current = true;
    void fetchSamples();
  }, [ready, autoFetch, fetchSamples]);

  const hasMatchingTransaction = useCallback((candidate: EditableCandidate) => {
    const matchKey = candidateMatchKey(candidate);
    return registeredMatchKeys.has(matchKey) || existingMatchKeys.current.has(matchKey);
  }, [registeredMatchKeys]);

  const register = useCallback(async (candidate: EditableCandidate, confirmedPossibleDuplicate = false) => {
    if (!candidate.amount || !candidate.occurredOn || !candidate.categoryId || !candidate.paymentMethodId) {
      updateCandidate(candidate.id, "error", "金額・利用日・カテゴリ・支払方法を確認してください。");
      return;
    }
    updateCandidate(candidate.id, "status", "saving");
    try {
      if (await isEmailImportRegistered(candidate)) {
        applyCandidatePatch(candidate.id, { status: "idle", needsDuplicateConfirmation: false, error: "このメールはすでに登録されています。" });
        return;
      }
      if (!confirmedPossibleDuplicate && hasMatchingTransaction(candidate)) {
        applyCandidatePatch(candidate.id, { status: "idle", needsDuplicateConfirmation: true, error: undefined });
        return;
      }
      await registerEmailImport(candidate);
      setRegisteredMatchKeys((keys) => new Set(keys).add(candidateMatchKey(candidate)));
      applyCandidatePatch(candidate.id, { status: "saved" });
    } catch (nextError) {
      applyCandidatePatch(candidate.id, { status: "idle", error: nextError instanceof Error ? nextError.message : "登録に失敗しました。" });
    }
  }, [applyCandidatePatch, hasMatchingTransaction, updateCandidate]);

  const bulkRegister = useCallback(async () => {
    setIsBulkRegistering(true);
    setBulkResult(null);
    const matchKeys = new Set(registeredMatchKeys);
    let registered = 0;
    let duplicates = 0;
    let failed = 0;
    for (const candidate of candidates.filter((item) => item.status !== "saved")) {
      if (!candidate.amount || !candidate.occurredOn || !candidate.categoryId || !candidate.paymentMethodId) {
        failed += 1;
        applyCandidatePatch(candidate.id, { error: "金額・利用日・カテゴリ・支払方法を確認してください。" });
        continue;
      }
      applyCandidatePatch(candidate.id, { status: "saving", error: undefined });
      try {
        if (await isEmailImportRegistered(candidate)) {
          duplicates += 1;
          applyCandidatePatch(candidate.id, { status: "idle", needsDuplicateConfirmation: false, error: "このメールはすでに登録されています。" });
          continue;
        }
        const matchKey = candidateMatchKey(candidate);
        if (matchKeys.has(matchKey) || existingMatchKeys.current.has(matchKey)) {
          duplicates += 1;
          applyCandidatePatch(candidate.id, { status: "idle", needsDuplicateConfirmation: true, error: undefined });
          continue;
        }
        await registerEmailImport(candidate);
        matchKeys.add(matchKey);
        registered += 1;
        removeCandidate(candidate.id);
      } catch (nextError) {
        failed += 1;
        applyCandidatePatch(candidate.id, { status: "idle", error: nextError instanceof Error ? nextError.message : "登録に失敗しました。" });
      }
    }
    setRegisteredMatchKeys(matchKeys);
    setBulkResult({ registered, duplicates, failed });
    setIsBulkRegistering(false);
  }, [applyCandidatePatch, candidates, registeredMatchKeys, removeCandidate]);

  const hasPending = candidates.some((item) => item.status !== "saved");
  const hasRegistered = (bulkResult?.registered ?? 0) > 0 || candidates.some((item) => item.status === "saved");
  const showCompletionLinks = !hasPending && (hasRegistered || (summary !== null && candidates.length === 0 && !bulkResult));

  return {
    candidates,
    warnings,
    summary,
    bulkResult,
    isFetching,
    isBulkRegistering,
    gmailError,
    sampleCount: SAMPLE_MAILS.length,
    fetchSamples,
    updateCandidate,
    removeCandidate,
    register,
    bulkRegister,
    showCompletionLinks,
  };
}
