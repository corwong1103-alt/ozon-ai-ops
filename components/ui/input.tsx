import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-9 w-full rounded-md border border-clay bg-parchment px-3 py-1 text-sm text-earth shadow-sm transition-colors placeholder:text-dust focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:border-accent disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
