"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertIcon } from "./icons";

/**
 * Promise-based confirm dialog for the admin portal — the in-house replacement
 * for the browser's blocking `window.confirm()`. Lives alongside the toast
 * system (see toast.tsx) and follows the same hand-rolled, no-dependency
 * convention: SVG icons + CSS keyframes, tokens from DESIGN.md.
 *
 * Usage:
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: "Remove employee?", tone: "danger" }))) return;
 */

export type ConfirmTone = "danger" | "warning" | "default";

export interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  /** Label for the affirmative button. Default "Confirm". */
  confirmLabel?: string;
  /** Label for the dismiss button. Default "Cancel". */
  cancelLabel?: string;
  tone?: ConfirmTone;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface ConfirmRequest extends ConfirmOptions {
  id: number;
}

const toneStyle: Record<
  ConfirmTone,
  { ring: string; iconBg: string; iconColor: string; confirmBtn: string }
> = {
  danger: {
    ring: "border-[#B33A3A]/30",
    iconBg: "bg-[#B33A3A]/10",
    iconColor: "text-[#B33A3A]",
    confirmBtn: "bg-[#B33A3A] hover:bg-[#9e3232] text-white",
  },
  warning: {
    ring: "border-[#C4891A]/30",
    iconBg: "bg-[#C4891A]/10",
    iconColor: "text-[#C4891A]",
    confirmBtn: "bg-[#C4891A] hover:bg-[#ab7716] text-white",
  },
  default: {
    ring: "border-neutral-200",
    iconBg: "bg-neutral-100",
    iconColor: "text-neutral-600",
    confirmBtn: "bg-primary hover:bg-neutral-800 text-white",
  },
};

let nextId = 1;

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [exiting, setExiting] = useState(false);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setExiting(false);
      setRequest({ ...opts, id: nextId++ });
    });
  }, []);

  const settle = useCallback((result: boolean) => {
    // Resolve immediately so the caller can act without waiting on the
    // exit animation, then play a brief fade-out before unmounting.
    const resolve = resolverRef.current;
    resolverRef.current = null;
    resolve?.(result);
    setExiting(true);
    setTimeout(() => {
      setRequest(null);
      setExiting(false);
    }, 180);
  }, []);

  // Keyboard: Escape cancels, Enter confirms. Move focus to the affirmative
  // button when a request opens.
  useEffect(() => {
    if (!request || exiting) return;
    confirmBtnRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        settle(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        settle(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [request, exiting, settle]);

  const styles = request ? toneStyle[request.tone ?? "default"] : null;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && styles && (
        <div
          className={`fixed inset-0 z-[210] flex items-center justify-center px-6 ${
            exiting ? "admin-overlay-out" : "admin-overlay-in"
          }`}
          onMouseDown={(e) => {
            // Backdrop click (outside the card) cancels.
            if (e.target === e.currentTarget) settle(false);
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`confirm-title-${request.id}`}
            className={`w-[420px] max-w-full rounded-lg bg-white border ${styles.ring} shadow-[0_24px_60px_rgba(10,10,11,0.22)] p-6 ${
              exiting ? "admin-confirm-out" : "admin-confirm-in"
            }`}
          >
            <div className="flex items-start gap-3.5">
              <div
                className={`shrink-0 w-9 h-9 rounded-full ${styles.iconBg} flex items-center justify-center mt-[1px]`}
              >
                <AlertIcon className={`w-5 h-5 ${styles.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h2
                  id={`confirm-title-${request.id}`}
                  className="text-[15px] text-primary font-medium leading-snug"
                >
                  {request.title}
                </h2>
                {request.body && (
                  <div className="text-[13px] text-neutral-600 leading-relaxed mt-1.5">
                    {request.body}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button
                type="button"
                onClick={() => settle(false)}
                className="px-4 py-2 rounded-md text-[13px] font-medium text-neutral-600 border border-neutral-200 hover:text-primary hover:bg-neutral-100 transition-colors"
              >
                {request.cancelLabel ?? "Cancel"}
              </button>
              <button
                ref={confirmBtnRef}
                type="button"
                onClick={() => settle(true)}
                className={`px-4 py-2 rounded-md text-[13px] font-medium transition-colors ${styles.confirmBtn}`}
              >
                {request.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    // Fallback to the native dialog if the provider isn't mounted, so callers
    // never silently lose their confirmation gate.
    return (opts) =>
      Promise.resolve(
        typeof window !== "undefined" ? window.confirm(opts.title) : true
      );
  }
  return ctx;
}
