import type { ReactNode } from "react";

export default function DataState({ loading, error, onRetry, skeleton }: { loading: boolean; error: string | null; onRetry?: () => void; skeleton?: ReactNode }) {
  if (loading) {
    if (skeleton) {
      // スケルトン表示。スクリーンリーダーには読み込み中であることだけ伝える
      return <div role="status" aria-label="データを読み込んでいます">{skeleton}</div>;
    }
    return <div className="surface-card loading-card p-4 text-center text-xs font-bold text-[var(--muted)]">データを読み込んでいます…</div>;
  }
  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-[#ecd59d] bg-[var(--warning-soft)] p-3 text-xs leading-5 font-bold text-[var(--warning)]">
        {error}
        {onRetry ? (
          <button type="button" onClick={onRetry} className="secondary-button mt-2 w-full text-xs">
            再読み込み
          </button>
        ) : null}
      </div>
    );
  }
  return null;
}
