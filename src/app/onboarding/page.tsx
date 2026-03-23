"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Logo } from "@/app/components/logo";

const steps = [
  { id: "welcome", label: "Welcome" },
  { id: "you", label: "About you" },
  { id: "company", label: "Your company" },
  { id: "context", label: "Your needs" },
  { id: "ready", label: "Ready" },
];

const companySizes = [
  { value: "Just me", label: "Just me", desc: "Solo founder or freelancer" },
  { value: "2-10", label: "2-10", desc: "Small team" },
  { value: "11-50", label: "11-50", desc: "Growing company" },
  { value: "51-200", label: "51-200", desc: "Mid-size" },
  { value: "201-1000", label: "201-1000", desc: "Large company" },
  { value: "1000+", label: "1000+", desc: "Enterprise" },
];

const industries = [
  { value: "Technology / SaaS", icon: "laptop" },
  { value: "E-commerce / Retail", icon: "cart" },
  { value: "Financial Services", icon: "bank" },
  { value: "Healthcare", icon: "heart" },
  { value: "Real Estate", icon: "building" },
  { value: "Education", icon: "book" },
  { value: "Media / Entertainment", icon: "play" },
  { value: "Manufacturing", icon: "factory" },
  { value: "Professional Services", icon: "briefcase" },
  { value: "Web3 / Blockchain", icon: "chain" },
  { value: "AI / Machine Learning", icon: "sparkle" },
  { value: "Other", icon: "dots" },
];

const roleTitles = [
  { value: "Founder / CEO", desc: "Running the whole show" },
  { value: "CTO / Technical Co-founder", desc: "Leading tech decisions" },
  { value: "COO / Operations", desc: "Keeping things running" },
  { value: "VP / Director of Sales", desc: "Driving revenue" },
  { value: "VP / Director of Marketing", desc: "Growing the brand" },
  { value: "Product Manager", desc: "Building the right thing" },
  { value: "Individual Contributor", desc: "Getting things done" },
  { value: "Other", desc: "Something else entirely" },
];

const challengeOptions = [
  "Not enough leads in the pipeline",
  "Spending too much time on manual tasks",
  "Can't keep up with content creation",
  "No visibility into financial health",
  "Hiring is slow and painful",
  "Customer churn is too high",
  "Competitors are moving faster",
  "Don't know where to focus",
  "Legal and compliance worries",
  "Data is scattered everywhere",
];

const automationOptions = [
  "Sales prospecting and outreach",
  "Marketing content and social media",
  "Financial reporting and bookkeeping",
  "Recruiting and HR tasks",
  "Customer support and success",
  "Strategy and competitive analysis",
  "Legal document review",
  "Product planning and roadmaps",
  "Data analysis and dashboards",
  "General admin and operations",
];

interface FormData {
  full_name: string;
  role_title: string;
  company_name: string;
  company_website: string;
  company_size: string;
  industry: string;
  current_tools: string;
  biggest_challenges: string;
  automation_goals: string;
}

export default function OnboardingPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [selectedChallenges, setSelectedChallenges] = useState<string[]>([]);
  const [selectedAutomations, setSelectedAutomations] = useState<string[]>([]);

  const [form, setForm] = useState<FormData>({
    full_name: "",
    role_title: "",
    company_name: "",
    company_website: "",
    company_size: "",
    industry: "",
    current_tools: "",
    biggest_challenges: "",
    automation_goals: "",
  });

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      router.push("/");
      return;
    }
    setForm((f) => ({
      ...f,
      full_name: user.fullName || "",
    }));

    // Check if already onboarded
    fetch("/api/profile")
      .then((r) => r.json())
      .then((profile) => {
        if (profile?.company_name) {
          // Already has a profile, go to homepage
          router.push("/");
        }
      });
  }, [isLoaded, user, router]);

  const update = (field: keyof FormData, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const toggleChallenge = (c: string) => {
    setSelectedChallenges((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

  const toggleAutomation = (a: string) => {
    setSelectedAutomations((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    );
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return true; // welcome
      case 1:
        return form.full_name.trim() && form.role_title;
      case 2:
        return form.company_name.trim() && form.industry;
      case 3:
        return selectedChallenges.length > 0 || selectedAutomations.length > 0;
      case 4:
        return true;
      default:
        return true;
    }
  };

  const handleNext = async () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      // Final step — save and redirect
      setSaving(true);
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          biggest_challenges: selectedChallenges.join("; "),
          automation_goals: selectedAutomations.join("; "),
        }),
      });
      router.push("/");
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  };

  const progress = ((currentStep + 1) / steps.length) * 100;

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-neutral-200">
        <div
          className="h-full bg-accent transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Header */}
      <div className="pt-8 px-6 flex items-center justify-between max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <Logo size="small" />
          <span className="text-sm font-medium text-neutral-400">
            {steps[currentStep].label}
          </span>
        </div>
        <span className="text-xs text-neutral-400">
          {currentStep + 1} of {steps.length}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="max-w-lg w-full">
          {/* Step 0: Welcome */}
          {currentStep === 0 && (
            <div className="text-center">
              <div className="mx-auto mb-6">
                <Logo size="large" />
              </div>
              <h1 className="font-[family-name:var(--font-serif)] text-3xl tracking-tight mb-3">
                Welcome to The Autonomous
              </h1>
              <p className="text-neutral-500 leading-relaxed mb-2">
                Let&apos;s set up your AI workforce. We&apos;ll ask a few
                questions to understand your business so your agents can give
                you specific, actionable help — not generic advice.
              </p>
              <p className="text-sm text-neutral-400">
                Takes about 2 minutes.
              </p>
            </div>
          )}

          {/* Step 1: About You */}
          {currentStep === 1 && (
            <div>
              <h2 className="font-[family-name:var(--font-serif)] text-2xl tracking-tight mb-1">
                Tell us about yourself
              </h2>
              <p className="text-sm text-neutral-500 mb-8">
                This helps your agents understand who they&apos;re working with.
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    What&apos;s your name?
                  </label>
                  <input
                    type="text"
                    value={form.full_name}
                    onChange={(e) => update("full_name", e.target.value)}
                    placeholder="Jane Smith"
                    autoFocus
                    className="w-full px-4 py-3.5 bg-white border border-neutral-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-3">
                    What&apos;s your role?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {roleTitles.map((role) => (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() => update("role_title", role.value)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          form.role_title === role.value
                            ? "border-accent bg-accent/5 ring-2 ring-accent/20"
                            : "border-neutral-200 hover:border-neutral-300 bg-white"
                        }`}
                      >
                        <p className="text-sm font-medium">{role.value}</p>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          {role.desc}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Your Company */}
          {currentStep === 2 && (
            <div>
              <h2 className="font-[family-name:var(--font-serif)] text-2xl tracking-tight mb-1">
                Tell us about your company
              </h2>
              <p className="text-sm text-neutral-500 mb-8">
                Your agents will use this context for every recommendation.
              </p>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Company name
                    </label>
                    <input
                      type="text"
                      value={form.company_name}
                      onChange={(e) => update("company_name", e.target.value)}
                      placeholder="Acme Corp"
                      autoFocus
                      className="w-full px-4 py-3.5 bg-white border border-neutral-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Website
                    </label>
                    <input
                      type="url"
                      value={form.company_website}
                      onChange={(e) =>
                        update("company_website", e.target.value)
                      }
                      placeholder="acme.com"
                      className="w-full px-4 py-3.5 bg-white border border-neutral-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-3">
                    Industry
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {industries.map((ind) => (
                      <button
                        key={ind.value}
                        type="button"
                        onClick={() => update("industry", ind.value)}
                        className={`p-3 rounded-xl border text-center transition-all ${
                          form.industry === ind.value
                            ? "border-accent bg-accent/5 ring-2 ring-accent/20"
                            : "border-neutral-200 hover:border-neutral-300 bg-white"
                        }`}
                      >
                        <p className="text-xs font-medium">{ind.value}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-3">
                    Team size
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {companySizes.map((size) => (
                      <button
                        key={size.value}
                        type="button"
                        onClick={() => update("company_size", size.value)}
                        className={`p-3 rounded-xl border text-center transition-all ${
                          form.company_size === size.value
                            ? "border-accent bg-accent/5 ring-2 ring-accent/20"
                            : "border-neutral-200 hover:border-neutral-300 bg-white"
                        }`}
                      >
                        <p className="text-sm font-semibold">{size.label}</p>
                        <p className="text-[10px] text-neutral-400">
                          {size.desc}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    What tools do you use today?{" "}
                    <span className="text-neutral-400 font-normal">
                      (optional)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={form.current_tools}
                    onChange={(e) => update("current_tools", e.target.value)}
                    placeholder="e.g. HubSpot, Notion, Slack, QuickBooks..."
                    className="w-full px-4 py-3.5 bg-white border border-neutral-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Your Needs */}
          {currentStep === 3 && (
            <div>
              <h2 className="font-[family-name:var(--font-serif)] text-2xl tracking-tight mb-1">
                What do you need help with?
              </h2>
              <p className="text-sm text-neutral-500 mb-8">
                Select all that apply. This is fed directly to your agents so
                they focus on what matters most.
              </p>

              <div className="space-y-8">
                <div>
                  <label className="block text-sm font-medium mb-3">
                    Biggest challenges right now
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {challengeOptions.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleChallenge(c)}
                        className={`px-3.5 py-2 rounded-full text-sm transition-all ${
                          selectedChallenges.includes(c)
                            ? "bg-accent text-primary font-medium"
                            : "bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-300"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-3">
                    What would you most like to automate?
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {automationOptions.map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => toggleAutomation(a)}
                        className={`px-3.5 py-2 rounded-full text-sm transition-all ${
                          selectedAutomations.includes(a)
                            ? "bg-secondary text-surface font-medium"
                            : "bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-300"
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Ready */}
          {currentStep === 4 && (
            <div className="text-center">
              <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg
                  className="w-8 h-8 text-secondary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="font-[family-name:var(--font-serif)] text-3xl tracking-tight mb-3">
                You&apos;re all set, {form.full_name.split(" ")[0] || "there"}
              </h2>
              <p className="text-neutral-500 leading-relaxed mb-8">
                We&apos;ll use everything you told us to make your AI agents
                smarter and more relevant to{" "}
                <span className="font-medium text-primary">
                  {form.company_name || "your company"}
                </span>
                .
              </p>

              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-3 text-left mb-6">
                <div className="p-4 bg-white border border-neutral-200 rounded-xl">
                  <p className="text-xs text-neutral-400 uppercase tracking-wider mb-1">
                    Role
                  </p>
                  <p className="text-sm font-medium">
                    {form.role_title || "—"}
                  </p>
                </div>
                <div className="p-4 bg-white border border-neutral-200 rounded-xl">
                  <p className="text-xs text-neutral-400 uppercase tracking-wider mb-1">
                    Industry
                  </p>
                  <p className="text-sm font-medium">
                    {form.industry || "—"}
                  </p>
                </div>
                <div className="p-4 bg-white border border-neutral-200 rounded-xl">
                  <p className="text-xs text-neutral-400 uppercase tracking-wider mb-1">
                    Team size
                  </p>
                  <p className="text-sm font-medium">
                    {form.company_size || "—"}
                  </p>
                </div>
                <div className="p-4 bg-white border border-neutral-200 rounded-xl">
                  <p className="text-xs text-neutral-400 uppercase tracking-wider mb-1">
                    Focus areas
                  </p>
                  <p className="text-sm font-medium">
                    {selectedChallenges.length + selectedAutomations.length}{" "}
                    selected
                  </p>
                </div>
              </div>

              <p className="text-xs text-neutral-400">
                You can update this anytime from your profile.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer navigation */}
      <div className="px-6 py-6 border-t border-neutral-100">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            {currentStep > 0 ? (
              <button
                onClick={handleBack}
                className="text-sm text-neutral-500 hover:text-primary transition-colors"
              >
                &larr; Back
              </button>
            ) : (
              <button
                onClick={() => router.push("/")}
                className="text-sm text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                Skip for now
              </button>
            )}
          </div>

          <button
            onClick={handleNext}
            disabled={!canProceed() || saving}
            className="px-8 py-3 bg-accent text-primary font-medium rounded-xl text-sm hover:bg-accent-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Saving...
              </>
            ) : currentStep === steps.length - 1 ? (
              "Get started"
            ) : (
              "Continue"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
