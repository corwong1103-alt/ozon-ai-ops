"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function SubmitButton({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
}) {
  const { pending } = useFormStatus();
  const base = variant === "primary" ? "btn-primary" : variant === "danger" ? "btn-danger" : "btn-secondary";

  return (
    <button className={`${base} ${className}`} disabled={pending || props.disabled} {...props}>
      {pending && <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} />}
      {children}
      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </button>
  );
}
