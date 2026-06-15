"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../_components/primitives";
import { SpinnerIcon, CheckIcon } from "../../_components/icons";
import { useToast } from "../../_components/toast";

type Phase = "idle" | "recording" | "uploading" | "done";

/** Pick a MediaRecorder mime the browser actually supports. */
function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  const candidates = ["audio/webm", "audio/webm;codecs=opus", "audio/mp4"];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "audio/webm";
}

function fmt(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function RecordCard() {
  const router = useRouter();
  const { toast } = useToast();

  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [title, setTitle] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mimeRef = useRef<string>("audio/webm");
  const mountedRef = useRef(true);

  // Guard against setState after unmount (an upload can outlive the component)
  // and release the mic + timer on teardown.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMime();
      mimeRef.current = mime;
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => void uploadClip();
      recorder.start();
      recorderRef.current = recorder;
      setSeconds(0);
      setPhase("recording");
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      toast({
        title: "Microphone blocked",
        body: "Grant mic access (or use HTTPS/localhost) to record.",
        tone: "danger",
      });
    }
  }

  function stopRecording() {
    stopTimer();
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  async function uploadClip() {
    const blob = new Blob(chunksRef.current, { type: mimeRef.current });
    if (blob.size === 0) {
      setPhase("idle");
      toast({ title: "Nothing recorded", tone: "warning" });
      return;
    }
    setPhase("uploading");
    const ext = mimeRef.current.includes("mp4") ? "mp4" : "webm";
    const form = new FormData();
    form.append("audio", blob, `recording.${ext}`);
    if (title.trim()) form.append("title", title.trim());
    form.append("visibility", isPrivate ? "private" : "company");

    try {
      const res = await fetch("/api/memory/ingest/audio-upload", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as {
        error?: string;
        conversationId?: string | null;
        personIds?: string[];
        decisionIds?: string[];
        commitmentIds?: string[];
      };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      const entities =
        (data.personIds?.length ?? 0) +
        (data.decisionIds?.length ?? 0) +
        (data.commitmentIds?.length ?? 0);
      if (!mountedRef.current) return;
      setPhase("done");
      toast({
        title: isPrivate ? "Saved privately" : "Added to the brain",
        body: `Transcribed and extracted ${entities} entit${
          entities === 1 ? "y" : "ies"
        }.`,
        tone: "success",
      });
      setTitle("");
      setSeconds(0);
      router.refresh();
      setTimeout(() => {
        if (mountedRef.current) setPhase("idle");
      }, 1600);
    } catch (err) {
      if (!mountedRef.current) return;
      setPhase("idle");
      toast({
        title: "Capture failed",
        body: err instanceof Error ? err.message : String(err),
        tone: "danger",
      });
    }
  }

  const busy = phase === "uploading";

  return (
    <div className="rounded-lg border border-neutral-200/80 bg-white p-6 flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-[family-name:var(--font-serif)] text-[22px] leading-tight text-primary">
            Record a meeting
          </h3>
          <p className="text-[13.5px] text-neutral-600 mt-1.5 leading-relaxed max-w-md">
            Capture audio in the browser. It&apos;s transcribed and woven into
            the company brain — people, decisions, and commitments extracted
            automatically.
          </p>
        </div>
        <RecPip active={phase === "recording"} />
      </div>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional) — e.g. 'Acme renewal call'"
        disabled={phase === "recording" || busy}
        className="w-full px-4 py-2.5 rounded-md border border-neutral-200 bg-white text-[14px] outline-none focus:border-neutral-400 placeholder:text-neutral-400 disabled:opacity-50"
      />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {phase === "recording" ? (
            <Button variant="outline" onClick={stopRecording}>
              <StopGlyph /> Stop · {fmt(seconds)}
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={startRecording}
              disabled={busy}
            >
              {busy ? (
                <>
                  <SpinnerIcon className="w-4 h-4 admin-spinner" /> Processing…
                </>
              ) : phase === "done" ? (
                <>
                  <CheckIcon className="w-4 h-4" /> Saved
                </>
              ) : (
                <>
                  <MicGlyph /> Start recording
                </>
              )}
            </Button>
          )}
        </div>

        <PrivateToggle
          on={isPrivate}
          disabled={phase === "recording" || busy}
          onChange={setIsPrivate}
        />
      </div>
    </div>
  );
}

function PrivateToggle({
  on,
  disabled,
  onChange,
}: {
  on: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="inline-flex items-center gap-2.5 text-[13px] text-neutral-600 disabled:opacity-50"
      title={
        on
          ? "Private: visible only to you — the transcript, decisions, commitments, and the people mentioned. Agents and teammates won't see it."
          : "Shared: every agent in the workspace can read it."
      }
    >
      <span
        className={`relative inline-flex h-[22px] w-[38px] items-center rounded-full transition-colors ${
          on ? "bg-accent" : "bg-neutral-300"
        }`}
      >
        <span
          className={`inline-block h-[16px] w-[16px] transform rounded-full bg-white shadow-sm transition-transform ${
            on ? "translate-x-[19px]" : "translate-x-[3px]"
          }`}
        />
      </span>
      Keep private to me
    </button>
  );
}

function RecPip({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-neutral-400">
      <span
        className={`h-2 w-2 rounded-full ${
          active ? "bg-red-500 admin-cta-idle" : "bg-neutral-300"
        }`}
      />
      {active ? "Live" : "Idle"}
    </span>
  );
}

function MicGlyph() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

function StopGlyph() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}
