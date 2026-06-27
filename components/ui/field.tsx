"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn("block text-sm font-medium text-ink", className)} {...props} />
));
Label.displayName = "Label";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-btn border border-line bg-surface px-3.5 py-2.5 text-base text-ink placeholder:text-muted",
        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70 focus-visible:border-ink/40",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-card border border-line bg-surface px-3.5 py-3 text-base text-ink placeholder:text-muted leading-relaxed",
        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70 focus-visible:border-ink/40 resize-y",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export function HelperText({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-sm text-muted", className)}>{children}</p>;
}
