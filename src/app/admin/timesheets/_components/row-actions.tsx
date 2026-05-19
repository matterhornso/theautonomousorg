"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "../../_components/toast";
import { TrashIcon, ResetIcon } from "../../_components/icons";

interface RowActionsProps {
  employeeId: string;
  employeeName: string;
  /** When provided, a "Reset submission" action appears (only meaningful for submitted rows). */
  resetSubmissionId?: string;
}

export function RowActions({
  employeeId,
  employeeName,
  resetSubmissionId,
}: RowActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<"delete" | "reset" | null>(null);
  const [removed, setRemoved] = useState(false);

  async function handleReset() {
    if (!resetSubmissionId) return;
    if (
      !confirm(
        `Reset ${employeeName}'s submission for this period? They'll appear Outstanding again and can be re-reminded.`
      )
    ) {
      return;
    }
    setBusy("reset");
    try {
      const res = await fetch("/api/timesheets/reset-submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: resetSubmissionId }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({
          title: "Couldn't reset submission",
          body: json.error ?? `HTTP ${res.status}`,
          tone: "danger",
        });
      } else {
        toast({
          title: `${employeeName}'s submission cleared`,
          body: "Status flipped back to Outstanding for this period.",
          tone: "success",
        });
        router.refresh();
      }
    } catch (err) {
      toast({
        title: "Network error",
        body: err instanceof Error ? err.message : String(err),
        tone: "danger",
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (
      !confirm(
        `Remove ${employeeName} from the roster? This deletes their record and all reminder history. They'll stop receiving Telegram reminders immediately.`
      )
    ) {
      return;
    }
    setBusy("delete");
    try {
      const res = await fetch(`/api/timesheets/employees/${employeeId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        toast({
          title: "Couldn't remove employee",
          body: json.error ?? `HTTP ${res.status}`,
          tone: "danger",
        });
        setBusy(null);
        return;
      }
      // Trigger the slide-out animation, then refresh.
      setRemoved(true);
      toast({
        title: `${employeeName} removed from roster`,
        body: "All their reminder history is gone. Re-add them anytime.",
        tone: "success",
      });
      // Wait for the slide animation before re-fetching the table.
      setTimeout(() => router.refresh(), 450);
    } catch (err) {
      toast({
        title: "Network error",
        body: err instanceof Error ? err.message : String(err),
        tone: "danger",
      });
      setBusy(null);
    }
  }

  // When `removed` is true the parent applies the row-remove class.
  // We export `removed` as a data attribute for the page to react to.
  return (
    <div className="flex items-center justify-end gap-1.5" data-removed={removed}>
      {resetSubmissionId && (
        <button
          type="button"
          onClick={handleReset}
          disabled={busy !== null}
          title="Reset submission to Outstanding"
          className="w-7 h-7 rounded-md flex items-center justify-center text-neutral-500 hover:text-[#7a5212] hover:bg-[#C4891A]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ResetIcon className="w-4 h-4" />
        </button>
      )}
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy !== null}
        title="Remove employee from roster"
        className="w-7 h-7 rounded-md flex items-center justify-center text-neutral-500 hover:text-[#7a2424] hover:bg-[#B33A3A]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
