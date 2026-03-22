import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all cursor-pointer select-none outline-none disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#00D4B8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080C1A]",
  {
    variants: {
      variant: {
        primary: "bg-[#00D4B8] text-[#080C1A] hover:bg-[#00A896]",
        secondary: "border border-white/[0.1] bg-white/[0.04] text-[#94A3B8] hover:border-white/[0.2] hover:text-[#F1F5F9]",
        ghost: "text-[#94A3B8] hover:bg-white/[0.06] hover:text-[#F1F5F9]",
        destructive: "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20",
        outline: "border border-[#00D4B8]/40 text-[#00D4B8] hover:bg-[#00D4B8]/10",
        link: "text-[#00D4B8] underline-offset-4 hover:underline",
      },
      size: {
        xs: "h-7 px-2.5 text-xs rounded-md",
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4",
        lg: "h-10 px-6 text-base",
        xl: "h-12 px-8 text-base",
        icon: "h-9 w-9",
        "icon-sm": "h-7 w-7 rounded-md",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
