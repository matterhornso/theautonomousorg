"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../_components/primitives";
import { useToast } from "../../_components/toast";

export function MarkSubmittedButton({
  submissionId,
  employeeName,
}: {
  submissionId: string;
  employeeName?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  async function handleClick() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/timesheets/mark-submitted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({
          title: "Couldn't mark submitted",
          body: json.error ?? `HTTP ${res.status}`,
          tone: "danger",
        });
      } else {
        toast({
          title: `${employeeName ?? "Submission"} marked as submitted`,
          body: "Period status updated. Reminders for this period will skip them now.",
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
      setSubmitting(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={submitting}
      title="Manually mark this employee's timesheet as submitted"
    >
      {submitting ? "…" : "Mark submitted"}
    </Button>
  );
}
