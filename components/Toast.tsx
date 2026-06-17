"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle, X, XCircle, AlertTriangle } from "lucide-react";

type ToastType = "success" | "error" | "warning";

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ContextValue {
  toast: (type: ToastType, message: string) => void;
}

const Ctx = createContext<ContextValue | null>(null);

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be inside <ToastProvider>");
  return ctx;
}

const iconMap: Record<ToastType, ReactNode> = {
  success: <CheckCircle size={16} />,
  error: <XCircle size={16} />,
  warning: <AlertTriangle size={16} />
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const toast = useCallback((type: ToastType, message: string) => {
    const id = ++idRef.current;
    setQueue((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setQueue((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);

  // auto-dismiss fallback
  useEffect(() => {
    if (queue.length === 0) return;
    const timer = setTimeout(() => setQueue((prev) => prev.slice(1)), 4500);
    return () => clearTimeout(timer);
  }, [queue]);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          maxWidth: 380
        }}
      >
        {queue.map((t) => (
          <div
            key={t.id}
            role="alert"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "0.85rem 1rem",
              borderRadius: 8,
              border: "1px solid",
              borderColor:
                t.type === "success"
                  ? "rgb(var(--sage) / 0.4)"
                  : t.type === "error"
                    ? "rgb(var(--terracotta) / 0.4)"
                    : "rgb(var(--amber) / 0.4)",
              background:
                t.type === "success"
                  ? "rgb(var(--sage) / 0.08)"
                  : t.type === "error"
                    ? "rgb(var(--terracotta) / 0.08)"
                    : "rgb(var(--amber) / 0.08)",
              color: "rgb(var(--earth))",
              fontSize: "0.88rem",
              fontWeight: 600,
              boxShadow: "0 4px 18px rgb(var(--earth) / 0.08)",
              backdropFilter: "blur(12px)",
              animation: "toast-in 0.3s ease"
            }}
          >
            <span style={{ flexShrink: 0, marginTop: 1 }}>
              {iconMap[t.type]}
            </span>
            <span style={{ flex: 1, lineHeight: 1.45 }}>{t.message}</span>
            <button
              onClick={() => setQueue((prev) => prev.filter((item) => item.id !== t.id))}
              style={{
                flexShrink: 0,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 2,
                color: "rgb(var(--dust))",
                marginTop: 1
              }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <style jsx global>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </Ctx.Provider>
  );
}
