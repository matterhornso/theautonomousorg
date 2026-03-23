"use client";

import { useState } from "react";

export function ComingSoonButton({
  label,
  featured = false,
}: {
  label: string;
  featured?: boolean;
}) {
  const [showToast, setShowToast] = useState(false);

  const handleClick = () => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className={`w-full py-3 rounded-xl text-sm font-medium transition-all ${
          featured
            ? "bg-accent text-primary hover:bg-accent-hover"
            : "bg-primary text-surface hover:bg-neutral-800"
        }`}
      >
        {label}
      </button>
      {showToast && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 px-4 py-2 bg-primary text-surface text-xs font-medium rounded-lg shadow-lg whitespace-nowrap animate-fade-in">
          Coming soon!
        </div>
      )}
    </div>
  );
}
