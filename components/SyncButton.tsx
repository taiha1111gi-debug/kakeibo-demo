"use client";

import Link from "next/link";
import Icon from "@/components/Icon";
import { useGmailSettings } from "@/components/DayBoundaryProvider";

export default function SyncButton() {
  const { gmailLastFetchedAt } = useGmailSettings();

  return (
    <div className="border-t border-white/12 pt-2.5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold text-white/55">メール取得（サンプル）</p>
          <p className="mt-0.5 text-[10px] font-bold text-white/55">最終取得：{gmailLastFetchedAt ? new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" }).format(new Date(gmailLastFetchedAt)) : "—"}</p>
        </div>
        <Link
          href="/import/email?autoFetch=1"
          className="sync-button inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-black text-[var(--brand-deep)]"
        >
          <Icon name="refresh" className="h-4 w-4" />
          更新
        </Link>
      </div>
    </div>
  );
}
