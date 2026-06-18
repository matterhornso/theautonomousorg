import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with TheAutonomous team. Questions about AI agents, enterprise plans, partnerships, or technical support — we respond within 24 hours.",
  alternates: { canonical: "https://www.theautonomous.org/contact" },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
