import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "../../lib/utils";

const Tabs = TabsPrimitive.Root;

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex items-center gap-1 rounded-xl p-1",
        "bg-white/[0.04] border border-white/[0.06]",
        className
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2",
        "text-sm font-medium text-[#94A3B8] outline-none transition-all",
        "cursor-pointer select-none",
        "hover:text-[#F1F5F9] hover:bg-white/[0.05]",
        "disabled:pointer-events-none disabled:opacity-50",
        "data-[state=active]:bg-[#00D4B8] data-[state=active]:text-[#080C1A]",
        className
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn(
        "mt-4 outline-none",
        "data-[state=inactive]:hidden",
        className
      )}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
