import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Sign in to TheAutonomous to manage your AI agents, view analytics, and automate your business workflows.",
  alternates: { canonical: "https://theautonomous.org/sign-in" },
  robots: { index: false, follow: true },
};

export default function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
