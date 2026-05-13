"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../_components/primitives";
import { useToast } from "../../_components/toast";

interface ReembedResponse {
  totalChunks: number;
  embedded: number;
  skipped: number;
  failed: number;
  provider: string | null;
  error?: string;
}

/**
 * Re-embed action button. Defaults to mode='missing' (only chunks without
 * embeddings). Shift-click triggers mode='all' (re-embed everything;
 * useful when switching embedding model).
 */
export function ReembedButton() {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  async function run(mode: "missing" | "all") {
    setBusy(true);
    try {
      const res = await fetch("/api/vault/reembed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = (await res.json()) as ReembedResponse;
      if (!res.ok) {
        toast({
          title: "Re-embed failed",
          body: data.error ?? `HTTP ${res.status}`,
          tone: "danger",
        });
        return;
      }
      if (data.provider === null) {
        toast({
          title: "Embedding provider not configured",
          body: "Set COHERE_API_KEY or OPENAI_API_KEY in env to enable re-embedding.",
          tone: "warning",
        });
        return;
      }
      if (data.totalChunks === 0) {
        toast({
          title: "Nothing to re-embed",
          body: `No chunks ${mode === "missing" ? "were missing embeddings" : "in the workspace"}.`,
          tone: "info",
        });
        return;
      }
      toast({
        title: `Re-embedded ${data.embedded.toLocaleString()} chunks`,
        body: `${data.failed > 0 ? data.failed + " failed · " : ""}provider: ${data.provider}${mode === "all" ? " · mode: all" : ""}`,
        tone: data.failed > 0 ? "warning" : "success",
      });
      router.refresh();
    } catch (err) {
      toast({
        title: "Network error",
        body: err instanceof Error ? err.message : String(err),
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={(e) => {
        // Shift-click = re-embed everything (incl. existing embeddings).
        // Plain click = only chunks with NULL embedding.
        run(e.shiftKey ? "all" : "missing");
      }}
      title="Re-embed chunks missing an embedding. Shift-click to re-embed every chunk."
    >
      {busy ? "Re-embedding…" : "Re-embed"}
    </Button>
  );
}
