"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

const companySizes = [
  "Just me",
  "2-10",
  "11-50",
  "51-200",
  "201-1000",
  "1000+",
];

const industries = [
  "Technology / SaaS",
  "E-commerce / Retail",
  "Financial Services",
  "Healthcare",
  "Real Estate",
  "Education",
  "Media / Entertainment",
  "Manufacturing",
  "Professional Services",
  "Web3 / Blockchain",
  "AI / Machine Learning",
  "Other",
];

const roleTitles = [
  "Founder / CEO",
  "CTO / Technical Co-founder",
  "COO / Operations",
  "VP / Director of Engineering",
  "VP / Director of Sales",
  "VP / Director of Marketing",
  "Product Manager",
  "Individual Contributor",
  "Other",
];

interface ProfileData {
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

export default function ProfilePage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [form, setForm] = useState<ProfileData>({
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

    // Load existing profile
    fetch("/api/profile")
      .then((r) => r.json())
      .then((profile) => {
        if (profile) {
          setForm({
            full_name: profile.full_name || user.fullName || "",
            role_title: profile.role_title || "",
            company_name: profile.company_name || "",
            company_website: profile.company_website || "",
            company_size: profile.company_size || "",
            industry: profile.industry || "",
            current_tools: profile.current_tools || "",
            biggest_challenges: profile.biggest_challenges || "",
            automation_goals: profile.automation_goals || "",
          });
        } else {
          setForm((f) => ({
            ...f,
            full_name: user.fullName || "",
          }));
        }
        setLoaded(true);
      });
  }, [isLoaded, user, router]);

  const update = (field: keyof ProfileData, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setSaved(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-neutral-400 text-sm">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface pt-24 pb-16 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="font-[family-name:var(--font-serif)] text-3xl tracking-tight mb-2">
            Your profile
          </h1>
          <p className="text-neutral-500 text-sm">
            Help us understand your business so our AI agents can give you
            better, more specific recommendations.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-8">
          {/* ─── About you ──────────────────────────────── */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 mb-4">
              About you
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Full name
                </label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => update("full_name", e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                  placeholder="Jane Smith"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Your role
                </label>
                <select
                  value={form.role_title}
                  onChange={(e) => update("role_title", e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all appearance-none"
                >
                  <option value="">Select your role</option>
                  {roleTitles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* ─── Your company ───────────────────────────── */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 mb-4">
              Your company
            </h2>
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Company name
                  </label>
                  <input
                    type="text"
                    value={form.company_name}
                    onChange={(e) => update("company_name", e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                    placeholder="Acme Corp"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Website
                  </label>
                  <input
                    type="url"
                    value={form.company_website}
                    onChange={(e) => update("company_website", e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                    placeholder="https://acme.com"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Company size
                  </label>
                  <select
                    value={form.company_size}
                    onChange={(e) => update("company_size", e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all appearance-none"
                  >
                    <option value="">Select size</option>
                    {companySizes.map((s) => (
                      <option key={s} value={s}>
                        {s} people
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Industry
                  </label>
                  <select
                    value={form.industry}
                    onChange={(e) => update("industry", e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all appearance-none"
                  >
                    <option value="">Select industry</option>
                    {industries.map((i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* ─── Context for AI ─────────────────────────── */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 mb-1">
              Help our AI understand you
            </h2>
            <p className="text-xs text-neutral-400 mb-4">
              These answers are fed directly to your agents as context, so they
              can give you specific, actionable recommendations instead of
              generic advice.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  What tools do you currently use?
                </label>
                <textarea
                  value={form.current_tools}
                  onChange={(e) => update("current_tools", e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all resize-none"
                  placeholder="e.g. HubSpot for CRM, Notion for docs, Slack for comms, QuickBooks for accounting..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  What are your biggest challenges right now?
                </label>
                <textarea
                  value={form.biggest_challenges}
                  onChange={(e) =>
                    update("biggest_challenges", e.target.value)
                  }
                  rows={3}
                  className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all resize-none"
                  placeholder="e.g. Not enough leads in the pipeline, spending too much time on manual bookkeeping, can't keep up with content creation..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  What would you most like to automate?
                </label>
                <textarea
                  value={form.automation_goals}
                  onChange={(e) => update("automation_goals", e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all resize-none"
                  placeholder="e.g. Outbound sales prospecting, weekly financial reports, social media posting, competitor monitoring..."
                />
              </div>
            </div>
          </section>

          {/* ─── Actions ────────────────────────────────── */}
          <div className="flex items-center gap-4 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-8 py-3 bg-primary text-surface font-medium rounded-xl text-sm hover:bg-neutral-800 transition-all disabled:opacity-60 flex items-center gap-2"
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
              ) : (
                "Save profile"
              )}
            </button>
            {saved && (
              <span className="text-sm text-secondary flex items-center gap-1.5">
                <svg
                  className="w-4 h-4"
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
                Saved
              </span>
            )}
            <a
              href="/"
              className="text-sm text-neutral-500 hover:text-primary transition-colors ml-auto"
            >
              Back to home
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
