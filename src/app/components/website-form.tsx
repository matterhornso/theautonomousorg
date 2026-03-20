"use client";

import { useState } from "react";

export function WebsiteForm({ variant = "light" }: { variant?: "light" | "dark" }) {
  const [url, setUrl] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div
        className={`flex items-center gap-3 px-5 py-4 rounded-xl border ${
          variant === "dark"
            ? "bg-neutral-800 border-neutral-700"
            : "bg-white border-neutral-200"
        }`}
      >
        <span className="w-2 h-2 bg-secondary rounded-full shrink-0" />
        <p
          className={`text-sm ${
            variant === "dark" ? "text-neutral-300" : "text-neutral-600"
          }`}
        >
          Thanks! We&apos;ll analyze{" "}
          <span className="font-medium">{url}</span> and send your personalized
          agent recommendations shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
      <div className="flex-1 relative">
        <input
          type="url"
          placeholder="Enter your company website..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          className={`w-full px-5 py-4 rounded-xl text-base transition-all focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent ${
            variant === "dark"
              ? "bg-neutral-800 border border-neutral-700 text-surface placeholder:text-neutral-500"
              : "bg-white border border-neutral-200 placeholder:text-neutral-400"
          }`}
        />
      </div>
      <button
        type="submit"
        className={`px-8 py-4 font-medium rounded-xl transition-all hover:shadow-lg active:scale-[0.98] whitespace-nowrap ${
          variant === "dark"
            ? "bg-accent text-primary hover:bg-accent-hover hover:shadow-accent/10"
            : "bg-primary text-surface hover:bg-neutral-800 hover:shadow-primary/10"
        }`}
      >
        {variant === "dark" ? "Get started free" : "Get recommendations"}
      </button>
    </form>
  );
}
