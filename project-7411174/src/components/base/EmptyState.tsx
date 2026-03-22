interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: string;
  secondaryLabel?: string;
  onSecondary?: () => void;
  size?: "sm" | "md" | "lg";
}

/**
 * Unified EmptyState component — used across all list pages.
 * Provides consistent icon / title / description / CTA pattern.
 */
export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon = "ri-add-line",
  secondaryLabel,
  onSecondary,
  size = "md",
}: EmptyStateProps) {
  const sizeMap = {
    sm: { wrap: "py-12", iconBox: "w-12 h-12 rounded-xl", iconText: "text-xl", titleText: "text-sm", descText: "text-xs" },
    md: { wrap: "py-20", iconBox: "w-16 h-16 rounded-2xl", iconText: "text-2xl", titleText: "text-base", descText: "text-sm" },
    lg: { wrap: "py-28", iconBox: "w-20 h-20 rounded-2xl", iconText: "text-3xl", titleText: "text-lg", descText: "text-sm" },
  };
  const s = sizeMap[size];

  return (
    <div className={`flex flex-col items-center justify-center ${s.wrap} text-center`}>
      {/* Icon */}
      <div className={`${s.iconBox} flex items-center justify-center bg-white/[0.04] border border-white/[0.06] mx-auto mb-5`}>
        <i className={`${icon} ${s.iconText} text-[#475569]`} />
      </div>

      {/* Title */}
      <p className={`${s.titleText} font-semibold text-[#94A3B8] mb-2`}>{title}</p>

      {/* Description */}
      {description && (
        <p className={`${s.descText} text-[#475569] max-w-xs leading-relaxed mb-6`}>{description}</p>
      )}

      {/* Actions */}
      {(actionLabel || secondaryLabel) && (
        <div className="flex items-center gap-3">
          {actionLabel && onAction && (
            <button
              onClick={onAction}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00D4B8] text-[#080C1A] text-sm font-semibold hover:bg-[#00A896] transition-all cursor-pointer whitespace-nowrap"
            >
              <span className="w-4 h-4 flex items-center justify-center">
                <i className={actionIcon} />
              </span>
              {actionLabel}
            </button>
          )}
          {secondaryLabel && onSecondary && (
            <button
              onClick={onSecondary}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/[0.1] text-[#94A3B8] text-sm hover:border-[#00D4B8]/30 hover:text-[#00D4B8] transition-all cursor-pointer whitespace-nowrap"
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
