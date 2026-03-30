"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="w-16 h-16 bg-[#B33A3A]/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-[#B33A3A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="font-[family-name:var(--font-serif)] text-2xl mb-2">
          Something went wrong
        </h2>
        <p className="text-neutral-500 text-sm mb-6">
          We&apos;re having trouble loading your dashboard. This is usually a temporary issue with our servers.
        </p>
        {error.digest && (
          <p className="text-xs text-neutral-400 mb-4 font-mono">
            Error: {error.digest}
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-[#D4A853] text-[#0A0A0B] font-medium rounded-xl text-sm hover:opacity-90 transition-opacity"
          >
            Try again
          </button>
          <a
            href="/"
            className="px-6 py-3 bg-neutral-100 text-neutral-600 font-medium rounded-xl text-sm hover:bg-neutral-200 transition-colors"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
