import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { PwaRegister } from "./components/pwa-register";
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
  metadataBase: new URL("https://theautonomous.org"),
  openGraph: {
    title: "The Autonomous — Run Your Company with AI Agents",
    description:
      "AI agents for Sales, Marketing, Engineering, Strategy, and more. Enter your website, get recommended agents, communicate via WhatsApp.",
    url: "https://theautonomous.org",
    siteName: "The Autonomous",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Autonomous — Run Your Company with AI Agents",
    description:
      "AI agents for every role in your company. Enter your website, get recommended agents, communicate via WhatsApp.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0A0A0B" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
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
      <body className="antialiased">
        <ClerkProvider>
          {children}
        </ClerkProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
