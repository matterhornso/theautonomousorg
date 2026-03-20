import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Autonomous — Run Your Company with AI Agents",
  description:
    "AI agents for every role in your company. Sales, Marketing, Engineering, Strategy, and more. Enter your website, get recommended agents, communicate via WhatsApp.",
  keywords: [
    "AI agents",
    "business automation",
    "AI workforce",
    "autonomous company",
    "AI sales agent",
    "AI marketing agent",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..700;1,9..40,300..700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
