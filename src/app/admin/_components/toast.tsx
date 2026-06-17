"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { CheckIcon, AlertIcon, XIcon } from "./icons";

export type ToastTone = "success" | "warning" | "danger" | "info";

export interface ToastOptions {
  title: string;
  body?: ReactNode;
  tone?: ToastTone;
  /** Milliseconds before auto-dismiss. 0 = stay until dismissed manually. */
  durationMs?: number;
}

interface ToastInstance extends Required<Omit<ToastOptions, "body">> {
  id: number;
  body: ReactNode;
  exiting: boolean;
}

interface ToastContextValue {
  toast: (opts: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

const toneStyle: Record<
  ToastTone,
  { ring: string; bg: string; iconColor: string; icon: typeof CheckIcon }
> = {
  success: {
    ring: "border-[#2D5A3D]/30",
    bg: "bg-[#2D5A3D]/10",
    iconColor: "text-[#2D5A3D]",
    icon: CheckIcon,
  },
  warning: {
    ring: "border-[#C4891A]/30",
    bg: "bg-[#C4891A]/10",
    iconColor: "text-[#C4891A]",
    icon: AlertIcon,
  },
  danger: {
    ring: "border-[#B33A3A]/30",
    bg: "bg-[#B33A3A]/10",
    iconColor: "text-[#B33A3A]",
    icon: AlertIcon,
  },
  info: {
    ring: "border-[#3A6B9B]/30",
    bg: "bg-[#3A6B9B]/10",
    iconColor: "text-[#3A6B9B]",
    icon: AlertIcon,
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastInstance[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 260);
  }, []);

  const toast = useCallback(
    (opts: ToastOptions) => {
      const id = nextId++;
      const instance: ToastInstance = {
        id,
        title: opts.title,
        body: opts.body ?? null,
        tone: opts.tone ?? "info",
        durationMs: opts.durationMs ?? 6000,
        exiting: false,
      };
      setToasts((prev) => [...prev, instance]);
      if (instance.durationMs > 0) {
        setTimeout(() => dismiss(id), instance.durationMs);
      }
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none">
        {toasts.map((t) => {
          const styles = toneStyle[t.tone];
          const Icon = styles.icon;
          return (
            <div
              key={t.id}
              className={`pointer-events-auto w-[380px] max-w-[calc(100vw-3rem)] flex items-start gap-3 px-4 py-3.5 rounded-lg bg-white border ${styles.ring} shadow-[0_8px_24px_rgba(10,10,11,0.10)] ${t.exiting ? "admin-toast-out" : "admin-toast-in"}`}
              role="status"
            >
              <div
                className={`shrink-0 w-7 h-7 rounded-full ${styles.bg} flex items-center justify-center mt-[1px]`}
              >
                <Icon className={`w-4 h-4 ${styles.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] text-primary font-medium leading-snug">
                  {t.title}
                </div>
                {t.body && (
                  <div className="text-[12.5px] text-neutral-600 leading-relaxed mt-1">
                    {t.body}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="shrink-0 text-neutral-400 hover:text-neutral-700 transition-colors"
                aria-label="Dismiss"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback so callers can still trigger something useful even if the
    // provider isn't mounted yet — won't render UI but avoids crashes.
    return {
      toast: (opts) => {
        if (typeof window !== "undefined") console.info("[toast]", opts.title, opts.body);
      },
    };
  }
  return ctx;
}

// Re-export so consumers don't have to import effects/state directly.
export { ToastContext };

// Hook into a per-element flash (used to highlight rows after action).
export function useFlash() {
  const [pulses, setPulses] = useState<Set<string>>(new Set());
  const flash = useCallback((id: string) => {
    setPulses((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setPulses((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 1700);
  }, []);
  return { pulses, flash };
}
