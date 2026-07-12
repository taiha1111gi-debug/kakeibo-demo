import type { SVGProps } from "react";

export type IconName =
  | "home"
  | "list"
  | "plus"
  | "alert"
  | "mail"
  | "chevron"
  | "wallet"
  | "check"
  | "clock"
  | "arrow"
  | "refresh"
  | "chart"
  | "user"
  | "pencil"
  | "eye"
  | "eyeOff"
  | "trash";

const paths: Record<IconName, React.ReactNode> = {
  home: <><path d="m3 11 9-8 9 8" /><path d="M5.5 9.5V21h13V9.5" /><path d="M9 21v-7h6v7" /></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  alert: <><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.7 2.5 17.2A2 2 0 0 0 4.2 20h15.6a2 2 0 0 0 1.7-2.8L13.7 3.7a2 2 0 0 0-3.4 0Z" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  chevron: <path d="m9 18 6-6-6-6" />,
  wallet: <><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H19v16H6.5A2.5 2.5 0 0 1 4 17.5v-11Z" /><path d="M15 10h6v5h-6a2.5 2.5 0 0 1 0-5Z" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  arrow: <><path d="M5 12h14" /><path d="m15 8 4 4-4 4" /></>,
  refresh: <><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M6.1 8a7 7 0 0 1 11.4-2.2L20 8M4 16l2.5 2.2A7 7 0 0 0 17.9 16" /></>,
  chart: <><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></>,
  pencil: <><path d="m17 3 4 4L8 20l-5 1 1-5L17 3Z" /><path d="m14.5 5.5 4 4" /></>,
  eye: <><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="m3 3 18 18" /><path d="M10.6 5.3A10.6 10.6 0 0 1 12 5.2c6.5 0 10 6.8 10 6.8a17.6 17.6 0 0 1-3.1 4M6.5 6.5C3.7 8.3 2 12 2 12s3.5 6.8 10 6.8a10 10 0 0 0 4.3-1" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  trash: <><path d="M4 7h16" /><path d="M9.5 7V4.5h5V7" /><path d="m6 7 .8 13h10.4L18 7" /><path d="M10 11v5.5M14 11v5.5" /></>,
};

export default function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
