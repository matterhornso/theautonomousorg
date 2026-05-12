"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { ChevronRight, SearchIcon, BellIcon } from "./icons";

const labels: Record<string, string> = {
  admin: "Overview",
  agents: "Agents",
  approvals: "Approvals",
  notifications: "Notifications",
  vault: "Vault",
  integrations: "Integrations",
  provisioning: "Provisioning",
};

function humanize(segment: string): string {
  if (labels[segment]) return labels[segment];
  // run id, agent id — keep monospace flavour
  return segment;
}

export function AdminTopbar() {
  const pathname = usePathname() ?? "/admin";
  const parts = pathname.split("/").filter(Boolean); // ["admin", ...rest]

  return (
    <div className="sticky top-0 z-30 flex items-center gap-6 px-10 h-14 border-b border-neutral-200/80 bg-surface/80 backdrop-blur-md">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-neutral-500 min-w-0">
        {parts.map((seg, i) => {
          const last = i === parts.length - 1;
          const href = "/" + parts.slice(0, i + 1).join("/");
          const label = humanize(seg);
          const isMono = !labels[seg] && seg !== "admin";
          return (
            <span key={href} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && (
                <ChevronRight className="w-3.5 h-3.5 text-neutral-300 shrink-0" />
              )}
              {last ? (
                <span
                  className={`truncate text-primary ${isMono ? "font-[family-name:var(--font-mono)] text-[12.5px]" : "font-medium"}`}
                >
                  {label}
                </span>
              ) : (
                <Link
                  href={href}
                  className="truncate hover:text-primary transition-colors"
                >
                  {label}
                </Link>
              )}
            </span>
          );
        })}
      </nav>

      <div className="flex-1" />

      {/* Search */}
      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md border border-neutral-200/80 bg-white/70 text-[13px] text-neutral-500 w-[280px]">
        <SearchIcon className="w-4 h-4" />
        <input
          type="search"
          placeholder="Search runs, vault, callbacks…"
          className="flex-1 bg-transparent outline-none placeholder:text-neutral-400"
        />
        <span className="text-[10.5px] font-[family-name:var(--font-mono)] text-neutral-400 border border-neutral-200 rounded px-1">
          ⌘K
        </span>
      </div>

      {/* Bell */}
      <button
        type="button"
        className="relative p-2 rounded-md text-neutral-600 hover:bg-neutral-100 hover:text-primary transition-colors"
        aria-label="Notifications"
      >
        <BellIcon className="w-5 h-5" />
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-accent admin-pulse" />
      </button>

      {/* Clerk user menu */}
      <UserButton
        appearance={{
          elements: {
            avatarBox: "w-8 h-8 ring-1 ring-neutral-200/80",
          },
        }}
      />
    </div>
  );
}
