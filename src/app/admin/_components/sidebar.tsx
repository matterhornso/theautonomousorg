"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  HomeIcon,
  AgentsIcon,
  ApprovalsIcon,
  BellIcon,
  VaultIcon,
  FlowIcon,
  ProvisionIcon,
  ShopIcon,
  TimesheetIcon,
  CheckIcon,
  XIcon,
} from "./icons";
import { useState, type ComponentType, type SVGProps } from "react";
import { useToast } from "./toast";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Numeric badge (e.g. open approvals count). */
  badge?: number;
}

const items: NavItem[] = [
  { href: "/admin", label: "Overview", icon: HomeIcon },
  { href: "/admin/agents", label: "Agents", icon: AgentsIcon },
  { href: "/admin/timesheets", label: "Timesheets", icon: TimesheetIcon },
  { href: "/admin/shopify", label: "Shopify Editor", icon: ShopIcon },
  { href: "/admin/approvals", label: "Approvals", icon: ApprovalsIcon, badge: 4 },
  { href: "/admin/notifications", label: "Notifications", icon: BellIcon, badge: 4 },
  { href: "/admin/vault", label: "Vault", icon: VaultIcon },
  { href: "/admin/integrations", label: "Integrations", icon: FlowIcon },
  { href: "/admin/provisioning", label: "Provisioning", icon: ProvisionIcon },
];

interface AdminSidebarProps {
  firmName: string;
  firmInitials: string;
  /** Stable id of the active workspace; required for inline rename. */
  firmId?: string;
  userInitials: string;
  userLabel: string;
  /** Total number of workspaces this user has access to. Drives the dropdown caret. */
  workspaceCount?: number;
}

export function AdminSidebar({
  firmName,
  firmInitials,
  firmId,
  userInitials,
  userLabel,
  workspaceCount = 1,
}: AdminSidebarProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(firmName);
  const [saving, setSaving] = useState(false);

  async function saveName() {
    const trimmed = draft.trim();
    if (!firmId) {
      setEditing(false);
      return;
    }
    if (!trimmed || trimmed === firmName) {
      setEditing(false);
      setDraft(firmName);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/companies/${firmId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({
          title: "Couldn't rename workspace",
          body: json.error ?? `HTTP ${res.status}`,
          tone: "danger",
        });
      } else {
        toast({
          title: "Workspace renamed",
          body: `Now displayed as "${trimmed}".`,
          tone: "success",
        });
        setEditing(false);
        router.refresh();
      }
    } catch (err) {
      toast({
        title: "Network error",
        body: err instanceof Error ? err.message : String(err),
        tone: "danger",
      });
    } finally {
      setSaving(false);
    }
  }
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col w-[244px] shrink-0 border-r border-neutral-200/80 bg-surface-mid/40 sticky top-0 h-[100dvh]">
      {/* Brand */}
      <Link
        href="/admin"
        className="flex items-baseline gap-2 px-7 pt-9 pb-10 group"
      >
        <span className="font-[family-name:var(--font-serif)] text-[26px] tracking-tight text-primary group-hover:text-neutral-700 transition-colors">
          The Autonomous
        </span>
      </Link>

      {/* Active workspace — click to rename inline. Saves via PATCH /api/companies/[id]. */}
      <div className="px-5 pb-7">
        {editing ? (
          <div className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-white border border-accent/50 shadow-sm">
            <div className="w-7 h-7 rounded-md bg-primary text-surface flex items-center justify-center font-[family-name:var(--font-serif)] text-[13px] shrink-0">
              {firmInitials}
            </div>
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveName();
                } else if (e.key === "Escape") {
                  setEditing(false);
                  setDraft(firmName);
                }
              }}
              autoFocus
              disabled={saving}
              className="flex-1 min-w-0 bg-transparent text-[13px] font-medium text-primary focus:outline-none"
              maxLength={120}
            />
            <button
              type="button"
              onClick={saveName}
              disabled={saving}
              title="Save (Enter)"
              className="w-6 h-6 rounded flex items-center justify-center text-[#1f4029] hover:bg-[#2D5A3D]/10 disabled:opacity-50"
            >
              <CheckIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setDraft(firmName);
              }}
              disabled={saving}
              title="Cancel (Esc)"
              className="w-6 h-6 rounded flex items-center justify-center text-neutral-500 hover:bg-neutral-100 disabled:opacity-50"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => firmId && setEditing(true)}
            disabled={!firmId}
            title={firmId ? "Click to rename workspace" : "Active workspace"}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md bg-white/70 border border-neutral-200/70 hover:border-neutral-300 transition-colors text-left disabled:cursor-default"
          >
            <div className="w-7 h-7 rounded-md bg-primary text-surface flex items-center justify-center font-[family-name:var(--font-serif)] text-[13px] shrink-0">
              {firmInitials}
            </div>
            <div className="flex flex-col leading-tight min-w-0 flex-1">
              <span className="text-[13px] font-medium text-primary truncate">
                {firmName}
              </span>
              <span className="text-[10.5px] uppercase tracking-[0.12em] text-neutral-500">
                Workspace
              </span>
            </div>
            {workspaceCount > 1 && (
              <span className="text-neutral-400 text-[10px]">▾</span>
            )}
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 overflow-y-auto">
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href} className="relative">
                {active && (
                  <span className="admin-enter origin-center absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[2px] rounded-r bg-accent" />
                )}
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-2 rounded-md text-[13.5px] transition-colors ${
                    active
                      ? "bg-white text-primary"
                      : "text-neutral-600 hover:text-primary hover:bg-white/60"
                  }`}
                >
                  <Icon
                    className={`w-[18px] h-[18px] ${active ? "text-accent" : "text-neutral-500 group-hover:text-neutral-700"}`}
                  />
                  <span className="flex-1">{item.label}</span>
                  {item.badge ? (
                    <span className="text-[10.5px] tabular font-medium text-neutral-700 bg-neutral-100 px-1.5 py-0.5 rounded">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer: signed-in human */}
      <div className="px-5 pb-6 pt-3 border-t border-neutral-200/70 mt-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#2D5A3D] text-surface flex items-center justify-center text-[12px] font-medium">
            {userInitials}
          </div>
          <div className="flex flex-col leading-tight min-w-0">
            <span className="text-[13px] text-primary truncate">{userLabel}</span>
            <span className="text-[11px] text-neutral-500">Signed in</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
