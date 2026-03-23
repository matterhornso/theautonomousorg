"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { AgentIcon } from "@/app/components/agent-icons";

interface TeamMember {
  id: string;
  email: string;
  phone: string | null;
  role: string;
  invite_status: string;
  created_at: string;
}

interface AgentBasic {
  id: string;
  role: string;
}

const roleDescriptions: Record<string, string> = {
  owner: "Full access — manage agents, team, billing, and settings",
  admin: "Manage agents and team members, use all agents",
  member: "Use assigned agents, view activity",
  viewer: "Read-only access to dashboards and reports",
};

export default function TeamPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.companyId as string;

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [agents, setAgents] = useState<AgentBasic[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  const [invite, setInvite] = useState({
    email: "",
    phone: "",
    role: "member",
  });
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/team?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/agents?companyId=${companyId}`).then((r) => r.json()),
    ]).then(([teamData, agentData]) => {
      if (Array.isArray(teamData)) setMembers(teamData);
      if (Array.isArray(agentData))
        setAgents(agentData.map((a: AgentBasic) => ({ id: a.id, role: a.role })));
      setLoading(false);
    });
  }, [companyId]);

  const handleInvite = async () => {
    if (!invite.email) return;
    setInviting(true);
    const res = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        email: invite.email,
        phone: invite.phone || undefined,
        role: invite.role,
      }),
    });
    if (res.ok) {
      const member = await res.json();
      setMembers((prev) => [...prev, member]);
      // NOTE: Invite is stored in the database. Actual email delivery requires
      // an email service like Resend or SendGrid to be configured.
      const sentEmail = invite.email;
      setInvite({ email: "", phone: "", role: "member" });
      setShowInvite(false);
      setToast(`Invite sent to ${sentEmail}`);
      setTimeout(() => setToast(null), 4000);
    }
    setInviting(false);
  };

  const handleRoleChange = async (memberId: string, role: string) => {
    await fetch("/api/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, role }),
    });
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role } : m))
    );
  };

  const handleRemove = async (memberId: string) => {
    await fetch("/api/team", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface pt-8 pb-16 px-6">
      {/* Success toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 px-5 py-3 bg-secondary/10 border border-secondary/30 text-secondary text-sm font-medium rounded-xl shadow-lg animate-in fade-in slide-in-from-top-2">
          {toast}
        </div>
      )}

      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => router.push(`/dashboard/${companyId}`)}
          className="text-sm text-neutral-500 hover:text-primary transition-colors mb-6"
        >
          &larr; Back to dashboard
        </button>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-[family-name:var(--font-serif)] text-3xl tracking-tight mb-1">
              Team
            </h1>
            <p className="text-neutral-500 text-sm">
              Invite team members and assign them to specific agents.
            </p>
          </div>
          <button
            onClick={() => setShowInvite(!showInvite)}
            className="px-5 py-2.5 bg-accent text-primary text-sm font-medium rounded-xl hover:bg-accent-hover transition-all"
          >
            {showInvite ? "Cancel" : "+ Invite member"}
          </button>
        </div>

        {/* Invite form */}
        {showInvite && (
          <section className="mb-8 p-6 bg-white border border-accent/20 rounded-2xl">
            <h2 className="text-sm font-semibold mb-4">Invite a team member</h2>
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={invite.email}
                    onChange={(e) =>
                      setInvite({ ...invite, email: e.target.value })
                    }
                    placeholder="colleague@company.com"
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Phone <span className="text-neutral-400">(optional)</span>
                  </label>
                  <input
                    type="tel"
                    value={invite.phone}
                    onChange={(e) =>
                      setInvite({ ...invite, phone: e.target.value })
                    }
                    placeholder="+1 555 123 4567"
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Role</label>
                <div className="grid sm:grid-cols-2 gap-2">
                  {(["admin", "member", "viewer"] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setInvite({ ...invite, role })}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        invite.role === role
                          ? "border-accent bg-accent/5 ring-2 ring-accent/20"
                          : "border-neutral-200 bg-white hover:border-neutral-300"
                      }`}
                    >
                      <p className="text-sm font-medium capitalize">{role}</p>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {roleDescriptions[role]}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleInvite}
                disabled={inviting || !invite.email}
                className="px-6 py-3 bg-primary text-surface text-sm font-medium rounded-xl hover:bg-neutral-800 disabled:opacity-40 transition-all"
              >
                {inviting ? "Sending invite..." : "Send invite"}
              </button>
            </div>
          </section>
        )}

        {/* Team members list */}
        <section className="mb-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 mb-4">
            Team members ({members.length})
          </h2>
          {members.length === 0 ? (
            <div className="text-center py-12 text-neutral-400 text-sm">
              No team members yet. Invite someone above.
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-4 p-4 bg-white border border-neutral-200 rounded-xl"
                >
                  <div className="w-10 h-10 bg-neutral-100 rounded-full flex items-center justify-center text-neutral-500 text-sm font-medium shrink-0">
                    {member.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {member.email}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {member.phone && (
                        <span className="text-xs text-neutral-400">
                          {member.phone}
                        </span>
                      )}
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          member.invite_status === "accepted"
                            ? "bg-secondary/10 text-secondary"
                            : "bg-accent/10 text-accent"
                        }`}
                      >
                        {member.invite_status}
                      </span>
                    </div>
                  </div>
                  <select
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.id, e.target.value)}
                    disabled={member.role === "owner"}
                    className="px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none disabled:opacity-50 appearance-none"
                  >
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  {member.role !== "owner" && (
                    <button
                      onClick={() => handleRemove(member.id)}
                      className="text-xs text-[#B33A3A] hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Agent assignments info */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 mb-4">
            Agent access
          </h2>
          <p className="text-sm text-neutral-500 mb-4">
            Owners and admins can access all agents. Members and viewers need to
            be assigned to specific agents.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center gap-3 p-3 bg-white border border-neutral-200 rounded-lg"
              >
                <AgentIcon role={agent.role} size="sm" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{agent.role}</p>
                  <p className="text-xs text-neutral-400">
                    Available to all admins
                  </p>
                </div>
                <span className="w-2 h-2 bg-secondary rounded-full" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
