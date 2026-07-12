"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import DataState from "@/components/DataState";
import Header from "@/components/Header";
import { FormSkeleton } from "@/components/PageSkeletons";
import GmailImportPanel from "@/components/import/GmailImportPanel";
import ImportCandidateCard from "@/components/import/ImportCandidateCard";
import { useGmailImport } from "@/lib/import/useGmailImport";
import { useMasterData } from "@/lib/useKakeiboData";

const shouldShowImportDebugInfo = process.env.NODE_ENV === "development";

function EmailImportContent() {
  const searchParams = useSearchParams();
  const { categories, paymentMethods, isLoading, error, reload } = useMasterData();
  const gmail = useGmailImport({
    categories,
    paymentMethods,
    ready: !isLoading && !error,
    autoFetch: searchParams.get("autoFetch") === "1",
  });
  const pendingCount = gmail.candidates.filter((item) => item.status !== "saved").length;

  return (
    <main className="page-content">
      <Header title="カード通知を取込" description="サンプルのカード利用通知を解析し、確認後に保存します。" />
      <DataState loading={isLoading} error={error} onRetry={() => void reload()} skeleton={<FormSkeleton />} />

      {!isLoading && !error ? (
        <>
          <GmailImportPanel
            onFetch={() => void gmail.fetchSamples()}
            isFetching={gmail.isFetching}
            sampleCount={gmail.sampleCount}
            gmailError={gmail.gmailError}
            summary={gmail.summary}
            showNoNewCandidates={gmail.candidates.length === 0 && !gmail.bulkResult}
          />

          {gmail.warnings.map((warning) => <div key={warning} className="mt-2 rounded-xl border border-[#ecd59d] bg-[var(--warning-soft)] p-3 text-xs font-bold text-[var(--warning)]">{warning}</div>)}

          {gmail.bulkResult ? (
            <div role="status" className="mt-2 rounded-xl bg-[var(--brand-soft)] p-2.5 text-xs font-bold text-[var(--brand)]">
              一括登録の結果：登録 {gmail.bulkResult.registered}件 / 重複スキップ {gmail.bulkResult.duplicates}件 / エラー {gmail.bulkResult.failed}件
              {gmail.bulkResult.duplicates ? <p className="mt-1 text-[10px] font-bold leading-4 text-[var(--muted)]">重複の可能性がある候補は登録せずに残しています。内容を確認して「それでも登録」または「削除」を選んでください。</p> : null}
            </div>
          ) : null}

          {gmail.candidates.length ? (
            <section className="mt-3 space-y-2">
              <div className="flex items-center justify-between px-1"><h2 className="text-sm font-black">登録候補</h2><span className="text-xs font-bold text-[var(--muted)]">{gmail.candidates.length}件</span></div>
              {pendingCount ? (
                <button type="button" disabled={gmail.isBulkRegistering} onClick={() => void gmail.bulkRegister()} className="primary-button w-full disabled:opacity-60">
                  {gmail.isBulkRegistering ? "一括登録中…" : `重複を除いて一括登録（${pendingCount}件）`}
                </button>
              ) : null}
              {gmail.candidates.map((candidate) => (
                <ImportCandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  categories={categories}
                  paymentMethods={paymentMethods}
                  onUpdate={gmail.updateCandidate}
                  onRemove={gmail.removeCandidate}
                  onRegister={(item, confirmed) => void gmail.register(item, confirmed)}
                  showDebugInfo={shouldShowImportDebugInfo}
                />
              ))}
            </section>
          ) : null}

          {gmail.showCompletionLinks ? (
            <section className="mt-3 grid grid-cols-2 gap-2">
              <Link href="/" className="secondary-button w-full">ホームへ戻る</Link>
              <Link href="/transactions" className="primary-button w-full">カレンダーを見る</Link>
            </section>
          ) : null}

          <div className="mt-3 rounded-xl border border-dashed border-[var(--line)] p-2.5 text-[10px] leading-4 text-[var(--muted)]">取得したメールは候補を確認してから登録します。自動登録は行いません。</div>
        </>
      ) : null}
    </main>
  );
}

export default function EmailImportPage() {
  return <Suspense fallback={null}><EmailImportContent /></Suspense>;
}
