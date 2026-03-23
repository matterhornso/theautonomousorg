"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { AgentIcon } from "../agent-icons";

interface AgentInfo {
  id: string;
  role: string;
  status: string;
  skills: string[];
  connectors: string[];
  starters: string[];
}

interface CompanyInfo {
  id: string;
  name: string;
  industry: string | null;
  stage: string | null;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  relayFrom?: string;
}

interface ActivityItem {
  type: string;
  agent_role: string;
  agent_id: string;
  title: string;
  detail: string | null;
  status: string;
  created_at: string;
}

interface TaskItem {
  id: string;
  agent_id: string;
  type: string;
  title: string;
  status: string;
  result: string | null;
  error: string | null;
  created_at: string;
}

export function DashboardClient({
  company,
  agents,
  initialActivity = [],
  initialTasks = [],
}: {
  company: CompanyInfo;
  agents: AgentInfo[];
  initialActivity?: ActivityItem[];
  initialTasks?: TaskItem[];
}) {
  const [activeAgent, setActiveAgent] = useState<AgentInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [activity] = useState<ActivityItem[]>(initialActivity);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [tasks] = useState<TaskItem[]>(initialTasks);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  useEffect(() => {
    if (activeAgent) inputRef.current?.focus();
  }, [activeAgent]);

  // Fetch credit balance
  useEffect(() => {
    fetch("/api/credits")
      .then((r) => r.json())
      .then((data) => {
        if (data.balance !== undefined) setCreditBalance(data.balance);
      })
      .catch(() => {});
  }, []);

  // Poll for task updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Trigger task processing
      fetch("/api/tasks/process", { method: "POST" }).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const selectAgent = (agent: AgentInfo) => {
    setActiveAgent(agent);
    setMessages([]);
    setConversationId(null);
    setStreamingText("");
  };

  const sendMessage = useCallback(
    async (text?: string) => {
      const userMessage = (text || input).trim();
      if (!userMessage || !activeAgent || loading) return;

      setInput("");
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", content: userMessage },
      ]);
      setLoading(true);
      setStreamingText("");

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: activeAgent.id,
            conversationId,
            message: userMessage,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => null);
          if (errData?.code === "INSUFFICIENT_CREDITS") {
            setMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: "system",
                content: "You're out of credits. Top up to continue chatting with your agents.",
              },
            ]);
            setLoading(false);
            return;
          }
          throw new Error("Chat failed");
        }
        if (!response.body) throw new Error("Chat failed");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);

            if (data === "[DONE]") {
              setMessages((prev) => [
                ...prev,
                {
                  id: crypto.randomUUID(),
                  role: "assistant",
                  content: accumulated,
                },
              ]);
              setStreamingText("");
              accumulated = "";
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.conversationId) {
                setConversationId(parsed.conversationId);
              } else if (parsed.text) {
                accumulated += parsed.text;
                setStreamingText(accumulated);
              } else if (parsed.interAgent) {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: crypto.randomUUID(),
                    role: "system",
                    content: `Asking @${parsed.interAgent.to}...`,
                  },
                ]);
              } else if (parsed.relay) {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: crypto.randomUUID(),
                    role: "system",
                    content: parsed.relay.response,
                    relayFrom: parsed.relay.from,
                  },
                ]);
              } else if (parsed.credits) {
                setCreditBalance(parsed.credits.balance);
              }
            } catch {
              /* skip */
            }
          }
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "system",
            content: "Connection lost. Please try again.",
          },
        ]);
        setStreamingText("");
      } finally {
        setLoading(false);
      }
    },
    [activeAgent, conversationId, input, loading]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const agentTasks = activeAgent
    ? tasks.filter((t) => t.agent_id === activeAgent.id)
    : [];

  return (
    <div className="h-screen flex bg-surface">
      {/* ─── Sidebar ────────────────────────────────────── */}
      <aside className="w-72 bg-primary text-surface flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-neutral-800">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 bg-accent rounded-md flex items-center justify-center text-primary text-xs font-bold">
              {company.name.charAt(0)}
            </div>
            <h2 className="font-semibold text-sm truncate">{company.name}</h2>
          </div>
          <p className="text-xs text-neutral-500">
            {company.industry} &middot; {company.stage}
          </p>
          {creditBalance !== null && (
            <div className="mt-2 flex items-center gap-1.5">
              <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    creditBalance > 500
                      ? "bg-secondary"
                      : creditBalance > 100
                        ? "bg-accent"
                        : "bg-red-400"
                  }`}
                  style={{ width: `${Math.min((creditBalance / 1000) * 100, 100)}%` }}
                />
              </div>
              <span className="text-xs text-neutral-500">{creditBalance} credits</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-3">
          {/* Activity feed button */}
          <button
            onClick={() => setActiveAgent(null)}
            className={`w-full px-5 py-3 flex items-center gap-3 text-left transition-colors ${
              !activeAgent ? "bg-neutral-800" : "hover:bg-neutral-800/50"
            }`}
          >
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs shrink-0 ${
                !activeAgent
                  ? "bg-accent text-primary"
                  : "bg-neutral-800 text-neutral-400"
              }`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">Activity</p>
              <p className="text-xs text-neutral-500">
                {activity.filter((a) => a.status === "done").length} completed
              </p>
            </div>
          </button>

          <p className="px-5 mt-3 text-xs text-neutral-500 uppercase tracking-wider mb-2">
            Agents
          </p>
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => selectAgent(agent)}
              className={`w-full px-5 py-3 flex items-center gap-3 text-left transition-colors ${
                activeAgent?.id === agent.id
                  ? "bg-neutral-800"
                  : "hover:bg-neutral-800/50"
              }`}
            >
              <AgentIcon
                role={agent.role}
                size="sm"
                variant={activeAgent?.id === agent.id ? "accent" : "dark"}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{agent.role}</p>
                <p className="text-xs text-neutral-500 truncate">
                  {tasks.filter(
                    (t) => t.agent_id === agent.id && t.status === "done"
                  ).length || 0}{" "}
                  tasks done
                </p>
              </div>
              <div className="ml-auto w-2 h-2 bg-secondary rounded-full shrink-0" />
            </button>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-neutral-800 space-y-1">
          <p className="text-[9px] text-neutral-600 uppercase tracking-widest mb-1">Work</p>
          <a href={`/dashboard/${company.id}/schedule`} className="flex items-center gap-2 text-xs text-neutral-400 hover:text-neutral-200 transition-colors py-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Schedule
          </a>
          <a href={`/dashboard/${company.id}/debrief`} className="flex items-center gap-2 text-xs text-neutral-400 hover:text-neutral-200 transition-colors py-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
            Debrief
          </a>
          <a href={`/dashboard/${company.id}/agents`} className="flex items-center gap-2 text-xs text-neutral-400 hover:text-neutral-200 transition-colors py-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /></svg>
            Agent Status
          </a>

          <p className="text-[9px] text-neutral-600 uppercase tracking-widest mt-3 mb-1">Manage</p>
          <a href={`/dashboard/${company.id}/team`} className="flex items-center gap-2 text-xs text-neutral-400 hover:text-neutral-200 transition-colors py-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
            Team
          </a>
          <a href={`/dashboard/${company.id}/skills`} className="flex items-center gap-2 text-xs text-neutral-400 hover:text-neutral-200 transition-colors py-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
            Skills
          </a>
          <a href={`/dashboard/${company.id}/analytics`} className="flex items-center gap-2 text-xs text-neutral-400 hover:text-neutral-200 transition-colors py-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
            Analytics
          </a>
          <a href={`/dashboard/${company.id}/settings`} className="flex items-center gap-2 text-xs text-neutral-400 hover:text-neutral-200 transition-colors py-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Settings
          </a>
          <a href={`/dashboard/${company.id}/telegram`} className="flex items-center gap-2 text-xs text-neutral-400 hover:text-neutral-200 transition-colors py-1">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" /></svg>
            Telegram
          </a>
          <a
            href={`/dashboard/${company.id}/builder`}
            className="flex items-center gap-2 text-xs text-accent hover:text-accent-hover transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create custom agent
          </a>
          <a
            href="/"
            className="block text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            &larr; Back to home
          </a>
        </div>
      </aside>

      {/* ─── Main area ──────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0">
        {activeAgent ? (
          <>
            {/* Agent header */}
            <header className="px-6 py-4 border-b border-neutral-200 bg-white flex items-center gap-4">
              <AgentIcon role={activeAgent.role} size="md" />
              <div className="flex-1">
                <h3 className="font-semibold">{activeAgent.role} Agent</h3>
                <div className="flex items-center gap-3 text-xs text-neutral-500">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-secondary rounded-full" />
                    Active
                  </span>
                  <span>
                    {agentTasks.filter((t) => t.status === "done").length} tasks
                    completed
                  </span>
                </div>
              </div>
              {/* Task results toggle */}
              {agentTasks.length > 0 && (
                <button
                  onClick={() =>
                    setExpandedTask(expandedTask ? null : "all")
                  }
                  className="px-3 py-1.5 text-xs bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors"
                >
                  {expandedTask ? "Hide tasks" : `View ${agentTasks.length} tasks`}
                </button>
              )}
            </header>

            {/* Task results panel */}
            {expandedTask && agentTasks.length > 0 && (
              <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50 max-h-80 overflow-y-auto">
                <p className="text-xs text-neutral-400 uppercase tracking-wider mb-3">
                  Proactive Task Results
                </p>
                <div className="space-y-2">
                  {agentTasks.map((task) => (
                    <div
                      key={task.id}
                      className="bg-white rounded-lg border border-neutral-200 overflow-hidden"
                    >
                      <button
                        onClick={() =>
                          setExpandedTask(
                            expandedTask === task.id ? "all" : task.id
                          )
                        }
                        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-neutral-50"
                      >
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            task.status === "done"
                              ? "bg-secondary"
                              : task.status === "running"
                                ? "bg-accent animate-pulse"
                                : task.status === "failed"
                                  ? "bg-red-500"
                                  : "bg-neutral-300"
                          }`}
                        />
                        <span className="text-sm font-medium flex-1">
                          {task.title}
                        </span>
                        <span className="text-xs text-neutral-400 uppercase">
                          {task.status}
                        </span>
                      </button>
                      {expandedTask === task.id && task.result && (
                        <div className="px-4 pb-4 pt-0 text-sm text-neutral-600 leading-relaxed whitespace-pre-wrap border-t border-neutral-100">
                          {task.result}
                        </div>
                      )}
                      {expandedTask === task.id && task.error && (
                        <div className="px-4 pb-4 pt-0 text-sm text-red-600">
                          Error: {task.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
              {messages.length === 0 && !streamingText && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="mb-4">
                    <AgentIcon role={activeAgent.role} size="lg" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1">
                    {activeAgent.role} Agent
                  </h3>
                  <p className="text-sm text-neutral-500 max-w-md mb-6">
                    Ready to help with{" "}
                    {activeAgent.skills.slice(0, 3).join(", ").toLowerCase()},
                    and more.
                  </p>
                  {/* Conversation starters */}
                  {activeAgent.starters.length > 0 && (
                    <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                      {activeAgent.starters.map((starter) => (
                        <button
                          key={starter}
                          onClick={() => sendMessage(starter)}
                          className="px-4 py-2 bg-white border border-neutral-200 rounded-full text-sm text-neutral-600 hover:border-accent hover:text-primary transition-all"
                        >
                          {starter}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.role === "system" ? (
                    <div
                      className={`max-w-[80%] px-4 py-3 rounded-xl text-sm ${
                        msg.relayFrom
                          ? "bg-accent/10 border border-accent/20"
                          : "bg-neutral-100"
                      }`}
                    >
                      {msg.relayFrom && (
                        <p className="text-xs text-accent font-medium uppercase tracking-wider mb-1">
                          @{msg.relayFrom} responded
                        </p>
                      )}
                      <p
                        className={
                          msg.relayFrom
                            ? "text-neutral-700 whitespace-pre-wrap"
                            : "text-neutral-500 italic"
                        }
                      >
                        {msg.content}
                      </p>
                    </div>
                  ) : (
                    <div
                      className={`max-w-[70%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-primary text-surface rounded-br-md"
                          : "bg-neutral-100 text-primary rounded-bl-md"
                      }`}
                    >
                      {msg.content}
                    </div>
                  )}
                </div>
              ))}

              {streamingText && (
                <div className="flex justify-start">
                  <div className="max-w-[70%] px-4 py-3 rounded-2xl rounded-bl-md bg-neutral-100 text-primary text-sm leading-relaxed whitespace-pre-wrap">
                    {streamingText}
                    <span className="inline-block w-1.5 h-4 bg-accent/60 ml-0.5 animate-pulse" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-6 py-4 border-t border-neutral-200 bg-white">
              <div className="flex gap-3 items-end max-w-4xl mx-auto">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message ${activeAgent.role} Agent...`}
                  rows={1}
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent disabled:opacity-60 placeholder:text-neutral-400"
                  style={{ minHeight: "44px", maxHeight: "120px" }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = "44px";
                    target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                  }}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={loading || !input.trim()}
                  className="px-4 py-3 bg-primary text-surface rounded-xl text-sm font-medium hover:bg-neutral-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  {loading ? (
                    <svg
                      className="w-4 h-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                      />
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-xs text-neutral-400 text-center mt-2">
                Enter to send &middot; Shift+Enter for new line &middot; Use
                @Role to mention other agents
              </p>
            </div>
          </>
        ) : (
          /* ─── Activity Feed (default view) ──────────── */
          <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-3xl mx-auto">
              <h2 className="font-[family-name:var(--font-serif)] text-2xl tracking-tight mb-1">
                Activity
              </h2>
              <p className="text-sm text-neutral-500 mb-6">
                Your agents are working. Here&apos;s what&apos;s happening.
              </p>

              {activity.length === 0 && tasks.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-6 h-6 text-accent animate-pulse"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                      />
                    </svg>
                  </div>
                  <h3 className="font-semibold mb-1">
                    Your agents are thinking...
                  </h3>
                  <p className="text-sm text-neutral-500">
                    Proactive tasks are being processed. Check back in a moment.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Show tasks as primary activity */}
                  {tasks.map((task) => {
                    const agent = agents.find((a) => a.id === task.agent_id);
                    return (
                      <div
                        key={task.id}
                        className="bg-white border border-neutral-200 rounded-xl overflow-hidden hover:border-neutral-300 transition-colors"
                      >
                        <button
                          onClick={() => {
                            if (task.status === "done") {
                              setExpandedTask(
                                expandedTask === task.id ? null : task.id
                              );
                            }
                            if (agent) {
                              // Don't navigate, just expand
                            }
                          }}
                          className="w-full px-5 py-4 flex items-start gap-4 text-left"
                        >
                          {agent && (
                            <AgentIcon role={agent.role} size="sm" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs text-neutral-400">
                                {agent?.role} Agent
                              </span>
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                  task.status === "done"
                                    ? "bg-secondary/10 text-secondary"
                                    : task.status === "running"
                                      ? "bg-accent/10 text-accent"
                                      : task.status === "failed"
                                        ? "bg-red-50 text-red-600"
                                        : "bg-neutral-100 text-neutral-500"
                                }`}
                              >
                                {task.status}
                              </span>
                            </div>
                            <p className="text-sm font-medium">{task.title}</p>
                            {task.status === "done" &&
                              task.result &&
                              expandedTask !== task.id && (
                                <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                                  {task.result.slice(0, 150)}...
                                </p>
                              )}
                          </div>
                          {task.status === "done" && (
                            <svg
                              className={`w-4 h-4 text-neutral-400 shrink-0 mt-1 transition-transform ${
                                expandedTask === task.id ? "rotate-180" : ""
                              }`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          )}
                        </button>
                        {expandedTask === task.id && task.result && (
                          <div className="px-5 pb-5 pt-0 border-t border-neutral-100">
                            <div className="text-sm text-neutral-600 leading-relaxed whitespace-pre-wrap mt-3">
                              {task.result}
                            </div>
                            <button
                              onClick={() => {
                                const agent = agents.find(
                                  (a) => a.id === task.agent_id
                                );
                                if (agent) selectAgent(agent);
                              }}
                              className="mt-3 text-xs text-accent hover:underline"
                            >
                              Chat with {agents.find((a) => a.id === task.agent_id)?.role} Agent about this &rarr;
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
