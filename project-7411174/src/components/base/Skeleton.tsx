import { ReactNode } from "react";

// ── Base pulse block ─────────────────────────────────────────────────────────
interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-white/[0.07] rounded ${className}`} />
  );
}

// ── Paper / result card skeleton ─────────────────────────────────────────────
export function SkeletonPaperCard() {
  return (
    <div className="glass rounded-xl border border-white/[0.06] overflow-hidden flex animate-pulse">
      <div className="w-1 flex-shrink-0 bg-white/[0.06]" />
      <div className="flex-1 p-5">
        <div className="flex items-start gap-4">
          <div className="flex-1 space-y-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
            <Skeleton className="h-3 w-2/3" />
            <div className="flex gap-4">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-5 w-8 rounded-md" />
              <Skeleton className="h-5 w-12 rounded-md" />
              <Skeleton className="h-5 w-20 rounded-md" />
              <Skeleton className="h-5 w-16 rounded-md" />
            </div>
          </div>
          <div className="flex flex-col gap-2 flex-shrink-0">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <Skeleton className="w-10 h-10 rounded-lg" />
            <Skeleton className="w-10 h-10 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Scholar card skeleton ────────────────────────────────────────────────────
export function SkeletonScholarCard() {
  return (
    <div className="glass rounded-xl p-5 border border-white/[0.06] animate-pulse">
      <div className="flex items-start gap-4">
        <Skeleton className="w-14 h-14 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2.5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-48" />
          <div className="flex gap-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-20 rounded" />
            <Skeleton className="h-5 w-16 rounded" />
            <Skeleton className="h-5 w-14 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Plan card skeleton ───────────────────────────────────────────────────────
export function SkeletonPlanCard() {
  return (
    <div className="rounded-xl p-5 border border-white/[0.06] bg-[#0E1428] animate-pulse space-y-3">
      <div className="flex items-start justify-between">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-12" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <div className="flex gap-1.5 pt-1">
        <Skeleton className="h-4 w-16 rounded" />
        <Skeleton className="h-4 w-14 rounded" />
        <Skeleton className="h-4 w-12 rounded" />
      </div>
    </div>
  );
}

// ── List row skeleton ────────────────────────────────────────────────────────
export function SkeletonListRow({ hasAvatar = false }: { hasAvatar?: boolean }) {
  return (
    <div className="glass rounded-xl p-4 border border-white/[0.06] flex items-center gap-4 animate-pulse">
      {hasAvatar && <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />}
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
    </div>
  );
}

// ── Stats card skeleton ──────────────────────────────────────────────────────
export function SkeletonStatCard() {
  return (
    <div className="glass rounded-xl p-4 border border-white/[0.06] animate-pulse space-y-2">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-7 w-16" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

// ── Sort bar skeleton ────────────────────────────────────────────────────────
export function SkeletonSortBar() {
  return (
    <div className="flex items-center justify-between glass rounded-xl px-4 py-3 border border-white/[0.06] animate-pulse">
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-44" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-7 w-20 rounded-lg" />
      </div>
    </div>
  );
}

// ── Full page list skeleton ──────────────────────────────────────────────────
interface SkeletonListProps {
  count?: number;
  type?: "paper" | "scholar" | "plan" | "row";
  hasAvatar?: boolean;
}

export function SkeletonList({ count = 5, type = "paper", hasAvatar = false }: SkeletonListProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => {
        if (type === "paper") return <SkeletonPaperCard key={i} />;
        if (type === "scholar") return <SkeletonScholarCard key={i} />;
        if (type === "plan") return <SkeletonPlanCard key={i} />;
        return <SkeletonListRow key={i} hasAvatar={hasAvatar} />;
      })}
    </div>
  );
}

// ── Skeleton wrapper with optional header ────────────────────────────────────
export function SkeletonPage({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
