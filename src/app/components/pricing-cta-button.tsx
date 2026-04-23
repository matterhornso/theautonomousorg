"use client";

import { SignUpButton } from "@clerk/nextjs";

export function PricingSignUpButton({
  label,
  featured = false,
}: {
  label: string;
  featured?: boolean;
}) {
  return (
    <SignUpButton mode="modal">
      <button
        className={`w-full py-3 rounded-xl text-sm font-medium transition-all ${
          featured
            ? "bg-accent text-primary hover:bg-[#C4981F]"
            : "bg-primary text-surface hover:bg-neutral-800"
        }`}
      >
        {label}
      </button>
    </SignUpButton>
  );
}
