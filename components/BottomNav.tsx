"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "@/components/Icon";

const items: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "ホーム", icon: "home" },
  { href: "/transactions", label: "カレンダー", icon: "list" },
  { href: "/reports", label: "レポート", icon: "chart" },
];

export default function BottomNav() {
  const pathname = usePathname();
  if (pathname === "/login" || pathname.startsWith("/auth/")) return null;

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/transactions") return pathname.startsWith("/transactions");
    return pathname.startsWith(href);
  };

  return (
    <nav
      aria-label="メインナビゲーション"
      className="nav-dock fixed right-2 bottom-[calc(6px+env(safe-area-inset-bottom))] left-2 z-50 mx-auto rounded-[20px] p-1.5 backdrop-blur-xl min-[540px]:max-w-[464px]"
    >
      <div className="grid grid-cols-3 gap-1">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`nav-item flex min-h-[48px] flex-col items-center justify-center gap-0 rounded-[14px] text-[10px] font-extrabold transition-all ${
                active ? "nav-item-active bg-[var(--brand-deep)] text-white shadow-[0_5px_12px_rgba(28,51,41,0.18)]" : "text-[#87918c]"
              }`}
            >
              <Icon name={item.icon} className="h-[18px] w-[18px]" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
