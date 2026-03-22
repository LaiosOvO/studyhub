import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-white/[0.1] bg-white/[0.06] text-[#94A3B8]",
        cyan: "border-[#00D4B8]/30 bg-[#00D4B8]/10 text-[#00D4B8]",
        green: "border-green-400/30 bg-green-400/10 text-green-400",
        amber: "border-amber-400/30 bg-amber-400/10 text-amber-400",
        red: "border-red-400/30 bg-red-400/10 text-red-400",
        solid: "border-transparent bg-[#00D4B8] text-[#080C1A]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
