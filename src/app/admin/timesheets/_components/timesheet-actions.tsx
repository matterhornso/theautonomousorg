"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../_components/primitives";
import { PlayIcon, SparkleIcon, SpinnerIcon } from "../../_components/icons";
import { useToast } from "../../_components/toast";
import { useSendBurst } from "../../_components/send-burst";

interface ReminderResult {
  submissionId: string;
  employeeId: string;
  employeeName: string;
  ok: boolean;
  error?: string;
}

interface RunPassResponse {
  periodKey: string;
  sent: number;
  failed: number;
  inserted: number;
  results: ReminderResult[];
}

export function TimesheetActions({ canRun }: { canRun: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const { fire: fireBurst, burst } = useSendBurst();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [telegramHandle, setTelegramHandle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [running, setRunning] = useState(false);

  async function handleAdd() {
    if (!name.trim() || !email.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/timesheets/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          telegramHandle: telegramHandle.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({
          title: "Couldn't add employee",
          body: json.error ?? `HTTP ${res.status}`,
          tone: "danger",
        });
      } else {
        toast({
          title: `${name.trim()} added to roster`,
          body: `Have them open Telegram and send /link ${email.trim()} to bind their chat.`,
          tone: "success",
        });
        setName("");
        setEmail("");
        setTelegramHandle("");
        setShowAdd(false);
        router.refresh();
      }
    } catch (err) {
      toast({
        title: "Add failed",
        body: err instanceof Error ? err.message : String(err),
        tone: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRun() {
    setRunning(true);
    try {
      const res = await fetch("/api/timesheets/run-pass", { method: "POST" });
      const json = (await res.json()) as RunPassResponse | { error?: string };
      if (!res.ok || "error" in json) {
        toast({
          title: "Reminder pass failed",
          body: ("error" in json && json.error) || `HTTP ${res.status}`,
          tone: "danger",
        });
      } else {
        const data = json as RunPassResponse;
        if (data.sent > 0 && data.failed === 0) {
          // Pure success — fire the celebratory burst.
          const names = data.results
            .filter((r) => r.ok)
            .map((r) => r.employeeName);
          const namesStr = names.join(", ");
          fireBurst({
            eyebrow: `Period ${data.periodKey}`,
            headline:
              data.sent === 1
                ? `Reminder sent to ${names[0]}`
                : `${data.sent} reminders delivered`,
            detail:
              data.sent === 1
                ? "via Telegram — they'll see it in seconds."
                : `Reached ${namesStr} on Telegram.`,
          });
          toast({
            title: `Telegram reminder sent to ${namesStr}`,
            body: `Period ${data.periodKey}. ${data.sent} message${data.sent === 1 ? "" : "s"} delivered.`,
            tone: "success",
            durationMs: 7000,
          });
        } else if (data.sent === 0 && data.failed > 0) {
          // All failed — most common cause is "not linked yet".
          const failures = data.results.filter((r) => !r.ok);
          const notLinked = failures.filter((r) =>
            (r.error ?? "").toLowerCase().includes("not linked")
          );
          if (notLinked.length === failures.length) {
            // Every failure is the same "not linked" reason — give the user the fix.
            const names = notLinked.map((r) => r.employeeName).join(", ");
            toast({
              title: `${names} hasn't linked Telegram yet`,
              body: (
                <>
                  Ask them to open Telegram, search for{" "}
                  <span className="font-mono text-[12px]">@timesheettrial_bot</span>,{" "}
                  send <span className="font-mono text-[12px]">/start</span>, then{" "}
                  <span className="font-mono text-[12px]">
                    /link {notLinked[0]?.employeeName.toLowerCase()}
                    @firm.com
                  </span>
                  . Once linked, click "Send reminders now" again.
                </>
              ),
              tone: "warning",
              durationMs: 10000,
            });
          } else {
            // Mixed failure reasons.
            toast({
              title: `0 sent · ${data.failed} failed`,
              body: failures
                .map((r) => `${r.employeeName}: ${r.error ?? "unknown error"}`)
                .join(" · "),
              tone: "warning",
              durationMs: 10000,
            });
          }
        } else if (data.sent > 0 && data.failed > 0) {
          // Mixed.
          const successNames = data.results
            .filter((r) => r.ok)
            .map((r) => r.employeeName)
            .join(", ");
          const failNames = data.results
            .filter((r) => !r.ok)
            .map((r) => r.employeeName)
            .join(", ");
          toast({
            title: `${data.sent} reminder${data.sent === 1 ? "" : "s"} sent · ${data.failed} failed`,
            body: (
              <>
                Sent: {successNames}. Couldn't reach: {failNames}.
              </>
            ),
            tone: "warning",
            durationMs: 9000,
          });
        } else {
          // Nothing to send.
          toast({
            title: "No reminders to send",
            body: "Everyone on the roster has already submitted, or there's nobody linked yet.",
            tone: "info",
          });
        }
        router.refresh();
      }
    } catch (err) {
      toast({
        title: "Network error",
        body: err instanceof Error ? err.message : String(err),
        tone: "danger",
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-3">
      {burst}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdd((s) => !s)}
        >
          {showAdd ? "Close" : "Add employee"}
        </Button>
        <Button
          size="sm"
          onClick={handleRun}
          disabled={!canRun || running}
          className={
            running
              ? "admin-cta-progress"
              : canRun
              ? "admin-cta-idle"
              : ""
          }
        >
          {running ? (
            <SpinnerIcon className="w-4 h-4 admin-spinner" />
          ) : (
            <PlayIcon className="w-4 h-4 admin-cta-icon-nudge" />
          )}
          {running ? "Sending…" : "Send reminders now"}
        </Button>
      </div>

      {showAdd && (
        <div className="w-[420px] flex flex-col gap-2 p-4 bg-white border border-neutral-200 rounded-md">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="px-3 py-2 text-[14px] border border-neutral-200 rounded focus:outline-none focus:border-accent"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@firm.com"
            type="email"
            className="px-3 py-2 text-[14px] border border-neutral-200 rounded focus:outline-none focus:border-accent"
          />
          <input
            value={telegramHandle}
            onChange={(e) => setTelegramHandle(e.target.value)}
            placeholder="@telegramhandle (optional)"
            className="px-3 py-2 text-[14px] border border-neutral-200 rounded focus:outline-none focus:border-accent"
          />
          <Button
            onClick={handleAdd}
            disabled={submitting}
            size="sm"
            className={!submitting && name && email ? "admin-cta-idle" : ""}
          >
            {submitting ? (
              <SpinnerIcon className="w-4 h-4 admin-spinner" />
            ) : (
              <SparkleIcon className="w-4 h-4 admin-cta-icon-sparkle" />
            )}
            {submitting ? "Adding…" : "Add to roster"}
          </Button>
          <p className="text-[12px] text-neutral-500 leading-relaxed mt-1">
            Have them open Telegram, search for your bot, send <code className="text-[11px] font-mono bg-neutral-100 px-1 rounded">/link {email || "their.email@firm.com"}</code> to bind.
          </p>
        </div>
      )}
    </div>
  );
}
