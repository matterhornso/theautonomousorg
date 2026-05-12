/**
 * Shared admin-portal primitives. Built directly on the design tokens in
 * globals.css — no shadcn, no headlessui, no extra deps. Each component is
 * a small, composable React function the admin pages reuse.
 */

import type { ReactNode } from "react";

// ─── Pill ─────────────────────────────────────────────────────────────────
// Use for status indicators in tables. Default is neutral; tones map to
// semantic colours from DESIGN.md.

export type PillTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info";

const pillStyles: Record<PillTone, string> = {
  neutral: "bg-neutral-100 text-neutral-700",
  accent: "bg-accent/15 text-[#7a5d1f]",
  success: "bg-[#2D5A3D]/10 text-[#1f4029]",
  warning: "bg-[#C4891A]/10 text-[#7a5212]",
  danger: "bg-[#B33A3A]/10 text-[#7a2424]",
  info: "bg-[#3A6B9B]/10 text-[#244a6e]",
};

export function Pill({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: PillTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase rounded-full ${pillStyles[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

// ─── StatusDot ─────────────────────────────────────────────────────────────
// Small circle for live state. Use `live` to add the breathing pulse
// animation (defined in globals.css). Idle = solid, no animation.

export function StatusDot({
  tone = "neutral",
  live = false,
  className = "",
}: {
  tone?: PillTone;
  live?: boolean;
  className?: string;
}) {
  const colors: Record<PillTone, string> = {
    neutral: "bg-neutral-400",
    accent: "bg-accent",
    success: "bg-[#2D5A3D]",
    warning: "bg-[#C4891A]",
    danger: "bg-[#B33A3A]",
    info: "bg-[#3A6B9B]",
  };
  return (
    <span className={`relative inline-flex w-2 h-2 ${className}`}>
      <span
        className={`absolute inset-0 rounded-full ${colors[tone]} ${live ? "admin-pulse" : ""}`}
      />
      <span className={`relative inline-block w-2 h-2 rounded-full ${colors[tone]}`} />
    </span>
  );
}

// ─── KeyValue ─────────────────────────────────────────────────────────────
// Vertical label/value pair. Used in detail panels and list rows.

export function KeyValue({
  label,
  children,
  align = "left",
}: {
  label: string;
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <div className={`flex flex-col gap-1 ${align === "right" ? "items-end text-right" : "items-start"}`}>
      <span className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">
        {label}
      </span>
      <span className="text-[15px] text-primary">{children}</span>
    </div>
  );
}

// ─── Stat ─────────────────────────────────────────────────────────────────
// Hero metric cell. Big serif number, label above. No card wrapping —
// admin-portal pattern uses dividers + spacing for grouping.

export function Stat({
  label,
  value,
  delta,
  hint,
}: {
  label: string;
  value: string | number;
  delta?: { value: string; tone: PillTone };
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-2 py-4">
      <span className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">
        {label}
      </span>
      <span className="font-[family-name:var(--font-serif)] text-5xl tabular leading-none text-primary">
        {value}
      </span>
      <div className="flex items-center gap-3 text-[13px] text-neutral-600">
        {delta && <Pill tone={delta.tone}>{delta.value}</Pill>}
        {hint && <span>{hint}</span>}
      </div>
    </div>
  );
}

// ─── PageHeader ───────────────────────────────────────────────────────────
// One per page. Large serif title, eyebrow above, optional right rail
// (action buttons / filters).

export function PageHeader({
  eyebrow,
  title,
  description,
  rail,
}: {
  eyebrow?: ReactNode;
  title: string;
  description?: string;
  rail?: ReactNode;
}) {
  return (
    <header className="flex items-end justify-between gap-8 pb-10 border-b border-neutral-200/80">
      <div className="flex flex-col gap-3 max-w-[640px]">
        {eyebrow && (
          <span className="text-[11px] uppercase tracking-[0.18em] text-accent font-medium">
            {eyebrow}
          </span>
        )}
        <h1 className="font-[family-name:var(--font-serif)] text-[44px] leading-[1.05] tracking-tight text-primary">
          {title}
        </h1>
        {description && (
          <p className="text-neutral-600 text-[15px] leading-relaxed max-w-[60ch]">
            {description}
          </p>
        )}
      </div>
      {rail && <div className="flex items-center gap-3 shrink-0">{rail}</div>}
    </header>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────
// Sectioned content with title + right-rail. Uses border-t pattern instead
// of card wrapping (per anti-card-overuse rule).

export function Section({
  title,
  description,
  rail,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  rail?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`pt-10 ${className}`}>
      <div className="flex items-end justify-between gap-6 pb-5 border-b border-neutral-200/60">
        <div>
          <h2 className="text-[13px] uppercase tracking-[0.16em] text-neutral-500 font-medium">
            {title}
          </h2>
          {description && (
            <p className="text-neutral-600 text-sm mt-1.5 max-w-[60ch]">
              {description}
            </p>
          )}
        </div>
        {rail && <div className="flex items-center gap-2">{rail}</div>}
      </div>
      <div className="pt-6">{children}</div>
    </section>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────

export function Button({
  variant = "primary",
  size = "md",
  children,
  ...rest
}: {
  variant?: "primary" | "ghost" | "outline";
  size?: "sm" | "md";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const sizes = {
    sm: "px-3 py-1.5 text-[13px]",
    md: "px-4 py-2 text-sm",
  };
  const variants = {
    primary:
      "bg-primary text-surface hover:bg-neutral-800 active:scale-[0.98]",
    ghost:
      "text-neutral-700 hover:bg-neutral-100 active:scale-[0.98]",
    outline:
      "border border-neutral-300 text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50 active:scale-[0.98]",
  };
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 font-medium rounded-md transition-all duration-200 ${sizes[size]} ${variants[variant]} ${rest.className ?? ""}`}
    >
      {children}
    </button>
  );
}

// ─── DataRow ──────────────────────────────────────────────────────────────
// Used inside a divide-y container for list rows. No internal card.

export function DataRow({
  children,
  className = "",
  href,
}: {
  children: ReactNode;
  className?: string;
  href?: string;
}) {
  const base =
    "group flex items-center gap-6 py-4 px-6 -mx-6 transition-colors hover:bg-[rgba(212,168,83,0.04)]";
  if (href) {
    return (
      <a href={href} className={`${base} ${className}`}>
        {children}
      </a>
    );
  }
  return <div className={`${base} ${className}`}>{children}</div>;
}

// ─── EmptyState ──────────────────────────────────────────────────────────
// Inline empty state for lists. Editorial composition — serif heading, soft
// hint text, optional CTA. No oversized illustration.

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="py-16 px-6 text-center max-w-md mx-auto">
      <h3 className="font-[family-name:var(--font-serif)] text-2xl text-primary tracking-tight">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-neutral-600 mt-3 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

// ─── SkeletonRow ──────────────────────────────────────────────────────────
// Loading skeleton matching the DataRow shape.

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-6 py-4 px-6 -mx-6">
      <div className="h-3 w-24 rounded bg-neutral-100 animate-pulse" />
      <div className="h-3 flex-1 rounded bg-neutral-100 animate-pulse" />
      <div className="h-3 w-16 rounded bg-neutral-100 animate-pulse" />
    </div>
  );
}

// ─── Code ─────────────────────────────────────────────────────────────────
// Inline + block code styled with JetBrains Mono. For agent IDs, hashes,
// JSON bodies in detail views.

export function Code({
  children,
  block = false,
}: {
  children: ReactNode;
  block?: boolean;
}) {
  if (block) {
    return (
      <pre className="font-[family-name:var(--font-mono)] text-[12.5px] leading-relaxed text-neutral-800 bg-neutral-50 border border-neutral-200/70 rounded-md p-4 overflow-x-auto">
        {children}
      </pre>
    );
  }
  return (
    <code className="font-[family-name:var(--font-mono)] text-[12.5px] text-neutral-700 bg-neutral-100 px-1.5 py-0.5 rounded">
      {children}
    </code>
  );
}

// ─── RelativeTime ────────────────────────────────────────────────────────
// Render a UTC timestamp as a "X ago" string with the absolute value in title.

export function RelativeTime({ ts }: { ts: number | Date }) {
  const date = typeof ts === "number" ? new Date(ts) : ts;
  const diffMs = Date.now() - date.getTime();
  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  let label: string;
  if (sec < 30) label = "just now";
  else if (min < 1) label = `${sec}s ago`;
  else if (hr < 1) label = `${min}m ago`;
  else if (day < 1) label = `${hr}h ago`;
  else if (day < 7) label = `${day}d ago`;
  else label = date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  return (
    <time
      dateTime={date.toISOString()}
      title={date.toLocaleString("en-IN")}
      className="text-neutral-500"
    >
      {label}
    </time>
  );
}
