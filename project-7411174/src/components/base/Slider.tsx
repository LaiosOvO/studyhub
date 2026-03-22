import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "../../lib/utils";

function Slider({
  className,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-white/[0.1]">
        <SliderPrimitive.Range className="absolute h-full bg-[#00D4B8]" />
      </SliderPrimitive.Track>
      {(props.value ?? props.defaultValue ?? [0]).map((_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          className={cn(
            "block h-4 w-4 rounded-full border-2 border-[#00D4B8] bg-[#080C1A]",
            "ring-offset-[#080C1A] transition-colors outline-none",
            "focus-visible:ring-2 focus-visible:ring-[#00D4B8] focus-visible:ring-offset-2",
            "disabled:pointer-events-none disabled:opacity-50",
            "hover:bg-[#00D4B8]/20 cursor-grab active:cursor-grabbing"
          )}
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
