"use client";

import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastItem = {
  id: number;
  title: string;
  description?: string;
  tone?: "neutral" | "success" | "danger";
  action?: { label: string; onClick: () => void };
};

type ToastContextValue = {
  toast: (t: Omit<ToastItem, "id">) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) return { toast: () => {} };
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const idRef = React.useRef(0);

  const toast = React.useCallback((t: Omit<ToastItem, "id">) => {
    const id = ++idRef.current;
    setItems((cur) => [...cur, { ...t, id }]);
  }, []);

  const remove = (id: number) => setItems((cur) => cur.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastPrimitive.Provider swipeDirection="right" duration={4500}>
        {children}
        {items.map((t) => (
          <ToastPrimitive.Root
            key={t.id}
            onOpenChange={(open) => !open && remove(t.id)}
            className={cn(
              "pointer-events-auto flex w-[360px] max-w-[92vw] items-start gap-3 rounded-card border bg-canvas p-3.5 shadow-overlay",
              "data-[state=open]:animate-fade-in",
              t.tone === "danger" ? "border-danger/30" : t.tone === "success" ? "border-success/30" : "border-line"
            )}
          >
            <div className="min-w-0 flex-1">
              <ToastPrimitive.Title className="text-sm font-semibold text-ink">{t.title}</ToastPrimitive.Title>
              {t.description && (
                <ToastPrimitive.Description className="mt-0.5 text-sm text-ink/75">
                  {t.description}
                </ToastPrimitive.Description>
              )}
            </div>
            {t.action && (
              <ToastPrimitive.Action altText={t.action.label} asChild>
                <button
                  onClick={t.action.onClick}
                  className="shrink-0 rounded-btn px-2.5 py-1 text-sm font-medium text-ink underline underline-offset-2 hover:opacity-80"
                >
                  {t.action.label}
                </button>
              </ToastPrimitive.Action>
            )}
            <ToastPrimitive.Close aria-label="Dismiss" className="shrink-0 rounded p-1 text-muted hover:text-ink">
              <X className="h-4 w-4" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
