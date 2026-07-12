"use client";

import Icon from "@/components/Icon";
import type { GmailSummary } from "@/lib/import/useGmailImport";

type GmailImportPanelProps = {
  onFetch: () => void;
  isFetching: boolean;
  sampleCount: number;
  gmailError: string | null;
  summary: GmailSummary | null;
  showNoNewCandidates: boolean;
};

export default function GmailImportPanel({
  onFetch,
  isFetching,
  sampleCount,
  gmailError,
  summary,
  showNoNewCandidates,
}: GmailImportPanelProps) {
  return (
    <section className="surface-card form-card space-y-2.5 p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black">サンプル通知から取得</h2>
        <span className="text-[10px] font-bold text-[var(--muted)]">サンプル{sampleCount}件</span>
      </div>
      <p className="text-[10px] leading-4 text-[var(--muted)]">このデモでは、Gmail APIの代わりにカード利用通知と同じ形式のサンプルメールを解析して登録候補を作成します。自動では登録しません。実運用版はGmail APIから同じ流れで取り込みます。</p>
      <button type="button" disabled={isFetching} onClick={onFetch} className="primary-button w-full disabled:opacity-60">
        <Icon name="mail" className="h-5 w-5" />{isFetching ? "サンプル通知を解析中…" : "サンプル通知を読み込む"}
      </button>
      {gmailError ? <div className="rounded-lg bg-[var(--danger-soft)] p-2 text-xs font-bold text-[var(--danger)]">{gmailError}</div> : null}
      {summary ? (
        <div className="rounded-xl bg-[var(--brand-soft)] p-2.5">
          <div className="grid grid-cols-4 gap-1 text-center">
            <div><p className="text-lg font-black text-[var(--brand)]">{summary.fetched}</p><p className="text-[10px] font-bold text-[var(--muted)]">取得メール</p></div>
            <div><p className="text-lg font-black text-[var(--brand)]">{summary.parsed}</p><p className="text-[10px] font-bold text-[var(--muted)]">解析候補</p></div>
            <div><p className="text-lg font-black text-[var(--brand)]">{summary.alreadyImported}</p><p className="text-[10px] font-bold text-[var(--muted)]">取込済み</p></div>
            <div><p className="text-lg font-black text-[var(--brand)]">{summary.unparsed}</p><p className="text-[10px] font-bold text-[var(--muted)]">解析不可</p></div>
          </div>
          {showNoNewCandidates ? <p className="mt-1.5 text-center text-[10px] font-bold text-[var(--muted)]">新しい登録候補はありません。</p> : null}
        </div>
      ) : null}
    </section>
  );
}
