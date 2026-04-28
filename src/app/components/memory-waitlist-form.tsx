"use client";

import { useState } from "react";

export function MemoryWaitlistForm({
  variant = "light",
}: {
  variant?: "light" | "dark";
}) {
  const [form, setForm] = useState({ email: "", role: "", company: "" });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/memory-waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const isDark = variant === "dark";
  const inputClass = isDark
    ? "w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-accent/60 focus:border-accent transition-all"
    : "w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all placeholder:text-neutral-400";

  if (submitted) {
    return (
      <div
        className={`rounded-2xl p-6 text-center ${
          isDark
            ? "bg-white/5 border border-white/10"
            : "bg-secondary/5 border border-secondary/20"
        }`}
      >
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3 ${
            isDark ? "bg-accent/15" : "bg-secondary/10"
          }`}
        >
          <svg
            className={`w-5 h-5 ${isDark ? "text-accent" : "text-secondary"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h3
          className={`font-medium text-base mb-1 ${isDark ? "text-white" : ""}`}
        >
          You&apos;re on the list
        </h3>
        <p
          className={`text-sm ${isDark ? "text-white/60" : "text-neutral-500"}`}
        >
          We&apos;ll be in touch as we let executives in.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="email"
        placeholder="you@company.com"
        required
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        className={inputClass}
      />
      <div className="grid sm:grid-cols-2 gap-3">
        <input
          type="text"
          placeholder="Your role (e.g. CEO, CRO)"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
          className={inputClass}
        />
        <input
          type="text"
          placeholder="Company"
          value={form.company}
          onChange={(e) => setForm({ ...form, company: e.target.value })}
          className={inputClass}
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className={`w-full py-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
          isDark
            ? "bg-accent text-primary hover:bg-[#C4981F]"
            : "bg-primary text-surface hover:bg-neutral-800"
        }`}
      >
        {loading ? "Joining..." : "Request early access"}
      </button>
      {error && (
        <p
          className={`text-sm text-center ${
            isDark ? "text-[#E86B6B]" : "text-[#B33A3A]"
          }`}
        >
          {error}
        </p>
      )}
      <p
        className={`text-xs text-center ${
          isDark ? "text-white/40" : "text-neutral-400"
        }`}
      >
        No spam. Executive-only. We review every signup manually.
      </p>
    </form>
  );
}
