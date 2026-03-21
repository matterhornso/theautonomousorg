"use client";

import { useState, useRef, useEffect } from "react";

interface AgentInfo {
  id: string;
  role: string;
  status: string;
  skills: string[];
  connectors: string[];
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
}

const roleIcons: Record<string, string> = {
  Sales: "S",
  Marketing: "M",
  Accounting: "A",
  Strategy: "St",
  Product: "P",
  "Front-End Engineering": "FE",
  "Back-End Engineering": "BE",
  "AI Expert": "AI",
};

export function DashboardClient({
  company,
  agents,
}: {
  company: CompanyInfo;
  agents: AgentInfo[];
}) {
  const [activeAgent, setActiveAgent] = useState<AgentInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  useEffect(() => {
    if (activeAgent) {
      inputRef.current?.focus();
    }
  }, [activeAgent]);

  const selectAgent = (agent: AgentInfo) => {
    setActiveAgent(agent);
    setMessages([]);
    setConversationId(null);
    setStreamingText("");
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeAgent || loading) return;

    const userMessage = input.trim();
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

      if (!response.ok || !response.body) {
        throw new Error("Chat request failed");
      }

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
              // Show inter-agent communication indicator
              setMessages((prev) => [
                ...prev,
                {
                  id: crypto.randomUUID(),
                  role: "system",
                  content: `${parsed.interAgent.from} mentioned @${parsed.interAgent.to}`,
                },
              ]);
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "system",
          content: "Failed to get a response. Please try again.",
        },
      ]);
      setStreamingText("");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="h-screen flex bg-surface">
      {/* ─── Sidebar ────────────────────────────────────── */}
      <aside className="w-72 bg-primary text-surface flex flex-col shrink-0">
        {/* Company header */}
        <div className="px-5 py-5 border-b border-neutral-800">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 bg-accent rounded-md flex items-center justify-center text-primary text-[10px] font-bold">
              {company.name.charAt(0)}
            </div>
            <h2 className="font-semibold text-sm truncate">{company.name}</h2>
          </div>
          <p className="text-xs text-neutral-500">
            {company.industry} &middot; {company.stage}
          </p>
        </div>

        {/* Agent list */}
        <div className="flex-1 overflow-y-auto py-3">
          <p className="px-5 text-[10px] text-neutral-500 uppercase tracking-wider mb-2">
            Your Agents
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
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                  activeAgent?.id === agent.id
                    ? "bg-accent text-primary"
                    : "bg-neutral-800 text-neutral-400"
                }`}
              >
                {roleIcons[agent.role] || agent.role.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{agent.role}</p>
                <p className="text-xs text-neutral-500 truncate">
                  {agent.connectors.slice(0, 2).join(", ")}
                </p>
              </div>
              <div className="ml-auto w-2 h-2 bg-secondary rounded-full shrink-0" />
            </button>
          ))}
        </div>

        {/* Back to home */}
        <div className="px-5 py-4 border-t border-neutral-800">
          <a
            href="/"
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
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
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-surface text-xs font-bold">
                {roleIcons[activeAgent.role] || activeAgent.role.charAt(0)}
              </div>
              <div>
                <h3 className="font-semibold">{activeAgent.role} Agent</h3>
                <div className="flex items-center gap-3 text-xs text-neutral-500">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-secondary rounded-full" />
                    Active
                  </span>
                  <span>
                    {activeAgent.skills.length} skills &middot;{" "}
                    {activeAgent.connectors.length} connectors
                  </span>
                </div>
              </div>
              <div className="ml-auto flex gap-1.5">
                {activeAgent.connectors.map((c) => (
                  <span
                    key={c}
                    className="px-2 py-0.5 bg-neutral-100 rounded text-[10px] text-neutral-500"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
              {messages.length === 0 && !streamingText && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-surface text-xl font-bold mb-4">
                    {roleIcons[activeAgent.role] ||
                      activeAgent.role.charAt(0)}
                  </div>
                  <h3 className="text-lg font-semibold mb-1">
                    {activeAgent.role} Agent
                  </h3>
                  <p className="text-sm text-neutral-500 max-w-md">
                    Ready to help with{" "}
                    {activeAgent.skills.slice(0, 3).join(", ").toLowerCase()},
                    and more. What would you like to work on?
                  </p>
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
                    <div className="px-3 py-1.5 bg-accent/10 rounded-lg text-xs text-accent italic">
                      {msg.content}
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

              {/* Streaming indicator */}
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
                  onClick={sendMessage}
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
              <p className="text-[10px] text-neutral-400 text-center mt-2">
                Press Enter to send &middot; Shift+Enter for new line &middot;
                Use @Role to mention other agents
              </p>
            </div>
          </>
        ) : (
          /* ─── No agent selected — overview ──────────── */
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-lg">
              <h2 className="font-[family-name:var(--font-serif)] text-3xl tracking-tight mb-3">
                Welcome to {company.name}&apos;s AI workforce
              </h2>
              <p className="text-neutral-500 text-sm mb-8">
                Select an agent from the sidebar to start chatting. Each agent
                has specialized skills and connectors for their role.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => selectAgent(agent)}
                    className="p-4 border border-neutral-200 rounded-xl text-left hover:border-accent hover:shadow-sm transition-all bg-white"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center text-surface text-xs font-bold">
                        {roleIcons[agent.role] || agent.role.charAt(0)}
                      </div>
                      <span className="font-medium text-sm">{agent.role}</span>
                    </div>
                    <p className="text-xs text-neutral-500">
                      {agent.skills.slice(0, 3).join(" · ")}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
