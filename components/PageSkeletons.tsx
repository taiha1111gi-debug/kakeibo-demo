import Skeleton from "@/components/Skeleton";

// 各ページの実レイアウトに寄せたスケルトン。DataStateのskeletonプロパティに渡す。

export function HomeSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-[172px] rounded-[21px]" />
      <Skeleton className="h-12 rounded-[14px]" />
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-[84px]" />
        <Skeleton className="h-[84px]" />
        <Skeleton className="h-[84px]" />
        <Skeleton className="h-[84px]" />
      </div>
    </div>
  );
}

export function CalendarSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-11 rounded-xl" />
      <Skeleton className="h-[300px] rounded-[16px]" />
      <div className="space-y-1.5">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    </div>
  );
}

export function ReportsSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-[52px] rounded-[14px]" />
      <Skeleton className="h-[100px] rounded-[17px]" />
      <Skeleton className="h-12" />
      <Skeleton className="h-12" />
      <Skeleton className="h-12" />
    </div>
  );
}

export function ReportDetailSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-[240px] rounded-[16px]" />
      <div className="space-y-1.5">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    </div>
  );
}

export function TransactionListSkeleton() {
  return (
    <div className="space-y-1.5">
      <Skeleton className="h-[76px] rounded-[17px]" />
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-[360px] rounded-[16px]" />
      <Skeleton className="h-12 rounded-[14px]" />
    </div>
  );
}

export function AccountSkeleton() {
  return <Skeleton className="h-[320px] rounded-[16px]" />;
}
