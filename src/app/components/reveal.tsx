"use client";

import { useRef, useState, useEffect, type ReactNode } from "react";

/**
 * Fade-up reveal wrapper for hero/marketing sections.
 *
 * Server-render: emits NO inline opacity/transform. Crawlers (AI and
 * traditional) see fully visible content in the initial HTML. This matters
 * because a non-trivial slice of AEO crawlers — including some passes of
 * Google AIO, Perplexity, and most third-party indexers — parse the raw HTML
 * without running JavaScript. If the server emits opacity:0, those crawlers
 * see a "blank" page and the content does not get cited.
 *
 * Client-render: after hydration, the wrapper starts at opacity:0 and animates
 * in on intersection. Real humans get the fade. Crawlers got the content.
 */
export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Until hydration runs, emit zero inline styling so SSR HTML is fully visible.
  // The first client paint then takes over and the IntersectionObserver fades in.
  const style = mounted
    ? {
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
      }
    : undefined;

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}
