import { useState, useEffect, createContext, useContext, useCallback } from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { cn } from "../../lib/utils";

// Toast context
interface ToastItem {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "success" | "warning" | "error";
  duration?: number;
}

interface ToastContextValue {
  toast: (item: Omit<ToastItem, "id">) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

function ToastItem({ item, onRemove }: { item: ToastItem; onRemove: (id: string) => void }) {
  const variantStyles = {
    default: "border-white/[0.1] bg-[#131929]",
    success: "border-green-400/30 bg-[#131929]",
    warning: "border-amber-400/30 bg-[#131929]",
    error: "border-red-400/30 bg-[#131929]",
  };

  const iconMap = {
    default: <i className="ri-information-line text-[#94A3B8]" />,
    success: <i className="ri-check-circle-line text-green-400" />,
    warning: <i className="ri-alert-line text-amber-400" />,
    error: <i className="ri-close-circle-line text-red-400" />,
  };

  return (
    <ToastPrimitive.Root
      className={cn(
        "group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-xl p-4",
        "border transition-all",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full",
        "data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
        variantStyles[item.variant ?? "default"]
      )}
      duration={item.duration ?? 4000}
      onOpenChange={(open) => { if (!open) onRemove(item.id); }}
    >
      <span className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
        {iconMap[item.variant ?? "default"]}
      </span>
      <div className="flex-1 min-w-0">
        {item.title && (
          <ToastPrimitive.Title className="text-sm font-semibold text-[#F1F5F9] mb-0.5">
            {item.title}
          </ToastPrimitive.Title>
        )}
        {item.description && (
          <ToastPrimitive.Description className="text-xs text-[#94A3B8] leading-relaxed">
            {item.description}
          </ToastPrimitive.Description>
        )}
      </div>
      <ToastPrimitive.Close className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-[#475569] hover:text-[#F1F5F9] transition-colors cursor-pointer">
        <i className="ri-close-line text-xs" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((item: Omit<ToastItem, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...item, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        <ToastPrimitive.Viewport
          className="fixed bottom-6 right-6 z-[200] flex max-h-screen w-full max-w-sm flex-col gap-2 outline-none"
        />
        {toasts.map((t) => (
          <ToastItem key={t.id} item={t} onRemove={removeToast} />
        ))}
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
