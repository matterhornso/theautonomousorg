import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Onboarding",
  description:
    "Set up your AI workforce on TheAutonomous. Tell us about your company and we will recommend the best AI agents for your business.",
  alternates: { canonical: "https://theautonomous.org/onboarding" },
  robots: { index: false, follow: true },
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
