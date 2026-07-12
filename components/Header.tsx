import Link from "next/link";
import type { ReactNode } from "react";
import Icon from "@/components/Icon";

type HeaderProps = {
  title: string;
  description?: string;
  backHref?: string;
  action?: ReactNode;
};

export default function Header({ title, description, backHref, action }: HeaderProps) {
  return (
    <header className="page-header relative mb-3">
      {action ? <div className="absolute top-0 right-0">{action}</div> : null}
      {backHref ? (
        <Link
          href={backHref}
          className="mb-1 inline-flex min-h-8 items-center gap-1 text-xs font-bold text-[var(--brand)]"
        >
          <Icon name="chevron" className="h-5 w-5 rotate-180" />
          戻る
        </Link>
      ) : null}
      <h1 className={`page-title text-[24px] leading-tight font-black tracking-[-0.045em] ${action ? "pr-12" : ""}`}>{title}</h1>
      {description ? (
        <p className="page-description mt-0.5 text-xs leading-4 text-[var(--muted)]">{description}</p>
      ) : null}
    </header>
  );
}
