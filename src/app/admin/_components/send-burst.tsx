"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckIcon, SparkleIcon } from "./icons";

export interface SendBurstPayload {
  /** Top headline. e.g. "Reminder sent" */
  headline: string;
  /** Subline shown beneath. e.g. "to Girish via Telegram" */
  detail: string;
  /** Optional small label at the very top. e.g. "Period 2026-W19" */
  eyebrow?: string;
}

interface SendBurstViewProps {
  payload: SendBurstPayload;
  onDone: () => void;
}

// 12 particles emitted radially around the card.
const PARTICLES = Array.from({ length: 12 }).map((_, i) => {
  const angle = (i / 12) * Math.PI * 2;
  const radius = 110 + ((i * 13) % 30);
  return {
    dx: Math.cos(angle) * radius,
    dy: Math.sin(angle) * radius,
    delay: (i % 6) * 40,
    size: 6 + (i % 3) * 2,
  };
});

function SendBurstView({ payload, onDone }: SendBurstViewProps) {
  useEffect(() => {
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-none"
      onClick={onDone}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] admin-burst-backdrop" />

      {/* Centred card */}
      <div className="relative admin-burst-card pointer-events-auto">
        {/* Expanding amber ring */}
        <span className="absolute inset-0 m-auto w-[180px] h-[180px] rounded-full border border-accent admin-burst-ring" />
        <span
          className="absolute inset-0 m-auto w-[180px] h-[180px] rounded-full border border-accent admin-burst-ring"
          style={{ animationDelay: "180ms" }}
        />

        {/* Sparkle particles */}
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 admin-burst-particle"
            style={
              {
                width: p.size,
                height: p.size,
                background:
                  i % 2 === 0
                    ? "rgba(212, 168, 83, 0.85)"
                    : "rgba(45, 90, 61, 0.7)",
                borderRadius: "50%",
                animationDelay: `${p.delay}ms`,
                ["--burst-dx" as string]: `${p.dx}px`,
                ["--burst-dy" as string]: `${p.dy}px`,
              } as React.CSSProperties
            }
          />
        ))}

        {/* Card */}
        <div className="relative bg-primary text-surface rounded-2xl shadow-[0_24px_72px_rgba(10,10,11,0.45)] px-12 py-10 min-w-[360px] flex flex-col items-center gap-5">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center admin-burst-check">
              <CheckIcon className="w-9 h-9 text-primary" />
            </div>
            <SparkleIcon className="absolute -top-1 -right-2 w-4 h-4 text-accent admin-cta-icon-sparkle" />
            <SparkleIcon className="absolute -bottom-1 -left-3 w-3 h-3 text-accent/70 admin-cta-icon-sparkle" />
          </div>

          {payload.eyebrow && (
            <span className="text-[11px] uppercase tracking-[0.18em] text-accent">
              {payload.eyebrow}
            </span>
          )}
          <div className="text-center">
            <h3 className="font-[family-name:var(--font-serif)] text-[28px] leading-tight">
              {payload.headline}
            </h3>
            <p className="text-[13.5px] text-neutral-300 mt-1.5">{payload.detail}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Imperatively-fireable burst, attached to the document via React state.
 * Consumers call `fire(payload)` from any client component.
 */
export function useSendBurst() {
  const [active, setActive] = useState<SendBurstPayload | null>(null);
  const fire = useCallback((payload: SendBurstPayload) => {
    setActive(payload);
  }, []);
  const dismiss = useCallback(() => setActive(null), []);
  const burst = active ? (
    <SendBurstView payload={active} onDone={dismiss} />
  ) : null;
  return { fire, burst };
}
