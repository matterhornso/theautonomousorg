"use client";

import { useState } from "react";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || loading) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
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

  if (submitted) {
    return (
      <div className="flex items-center justify-center gap-2 px-4 py-3 bg-secondary/10 rounded-xl max-w-md mx-auto">
        <svg
          className="w-4 h-4 text-secondary"
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
        <p className="text-sm text-neutral-600">
          You&apos;re subscribed! We&apos;ll keep you posted.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          placeholder="your@email.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 px-4 py-3 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all placeholder:text-neutral-400"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-primary text-surface text-sm font-medium rounded-xl hover:bg-neutral-800 transition-colors whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Subscribing..." : "Subscribe"}
        </button>
      </form>
      {error && (
        <p className="text-sm text-[#B33A3A] mt-2 text-center">{error}</p>
      )}
    </div>
  );
}
