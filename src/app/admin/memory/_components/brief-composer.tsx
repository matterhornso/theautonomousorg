"use client";

import { useState } from "react";
import { Button } from "../../_components/primitives";
import { SpinnerIcon, SparkleIcon, CheckIcon, ResetIcon } from "../../_components/icons";
import { useToast } from "../../_components/toast";

interface BriefResult {
  markdown: string;
  sources: {
    commitmentIds: string[];
    conversationIds: string[];
    decisionIds: string[];
  };
  llmRan: boolean;
}

/**
 * Pre-meeting brief composer. Calls POST /api/memory/brief, which synthesizes
 * everything the company brain knows about the attendees/topic into a briefing.
 */
export function BriefComposer() {
  const { toast } = useToast();
  const [eventTitle, setEventTitle] = useState("");
  const [attendeesRaw, setAttendeesRaw] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BriefResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    if (!eventTitle.trim()) {
      toast({ title: "Add an event title first", tone: "warning" });
      return;
    }
    setLoading(true);
    setResult(null);
    const attendees = attendeesRaw
      .split(/[,\n]/)
      .map((a) => a.trim())
      .filter(Boolean);
    try {
      const res = await fetch("/api/memory/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventTitle: eventTitle.trim(), attendees }),
      });
      const data = (await res.json()) as BriefResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResult(data);
      if (!data.llmRan) {
        toast({
          title: "Draft brief",
          body: "Generated without an LLM key — showing the raw graph context.",
          tone: "info",
        });
      }
    } catch (err) {
      toast({
        title: "Brief failed",
        body: err instanceof Error ? err.message : String(err),
        tone: "danger",
      });
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Couldn't copy to clipboard", tone: "warning" });
    }
  }

  function reset() {
    setResult(null);
    setEventTitle("");
    setAttendeesRaw("");
  }

  const sourceCount = result
    ? result.sources.commitmentIds.length +
      result.sources.conversationIds.length +
      result.sources.decisionIds.length
    : 0;

  return (
    <div className="rounded-lg border border-neutral-200/80 bg-white p-6 flex flex-col gap-5">
      <div>
        <h3 className="font-[family-name:var(--font-serif)] text-[22px] leading-tight text-primary">
          Pre-meeting brief
        </h3>
        <p className="text-[13.5px] text-neutral-600 mt-1.5 leading-relaxed max-w-md">
          Synthesize everything the brain knows about who you&apos;re meeting —
          past calls, open commitments, decisions — into a briefing.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <input
          type="text"
          value={eventTitle}
          onChange={(e) => setEventTitle(e.target.value)}
          placeholder="Event — e.g. 'Acme Q3 renewal'"
          disabled={loading}
          className="w-full px-4 py-2.5 rounded-md border border-neutral-200 bg-white text-[14px] outline-none focus:border-neutral-400 placeholder:text-neutral-400 disabled:opacity-50"
        />
        <textarea
          value={attendeesRaw}
          onChange={(e) => setAttendeesRaw(e.target.value)}
          placeholder="Attendees — comma or newline separated (names or emails)"
          rows={2}
          disabled={loading}
          className="w-full px-4 py-2.5 rounded-md border border-neutral-200 bg-white text-[14px] outline-none focus:border-neutral-400 placeholder:text-neutral-400 resize-none disabled:opacity-50"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={generate} disabled={loading}>
          {loading ? (
            <>
              <SpinnerIcon className="w-4 h-4 admin-spinner" /> Synthesizing…
            </>
          ) : (
            <>
              <SparkleIcon className="w-4 h-4" /> Generate brief
            </>
          )}
        </Button>
        {result && (
          <>
            <Button variant="outline" size="sm" onClick={copy}>
              {copied ? (
                <>
                  <CheckIcon className="w-3.5 h-3.5" /> Copied
                </>
              ) : (
                "Copy"
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={reset}>
              <ResetIcon className="w-3.5 h-3.5" /> Reset
            </Button>
          </>
        )}
      </div>

      {result && (
        <div className="mt-1 rounded-md border border-neutral-200/80 bg-neutral-50/60 p-5 animate-fade-up">
          <div className="mb-3 text-[11px] uppercase tracking-[0.14em] text-neutral-400">
            Brief · {sourceCount} source{sourceCount === 1 ? "" : "s"} from the brain
          </div>
          <pre className="whitespace-pre-wrap font-[family-name:var(--font-sans)] text-[13.5px] leading-relaxed text-neutral-800">
            {result.markdown}
          </pre>
        </div>
      )}
    </div>
  );
}
