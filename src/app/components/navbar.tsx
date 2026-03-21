"use client";

import { useState, useEffect } from "react";
import {
  SignInButton,
  SignUpButton,
  UserButton,
  Show,
} from "@clerk/nextjs";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-surface/90 backdrop-blur-xl border-b border-neutral-200"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-[1280px] mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
            <span className="text-surface text-xs font-bold tracking-tight font-[family-name:var(--font-sans)]">
              TA
            </span>
          </div>
          <span className="text-lg font-medium tracking-tight">
            The Autonomous
          </span>
        </a>

        <div className="hidden md:flex items-center gap-8 text-sm text-neutral-600">
          <a
            href="/#how-it-works"
            className="hover:text-primary transition-colors py-3"
          >
            How it works
          </a>
          <a
            href="/#agents"
            className="hover:text-primary transition-colors py-3"
          >
            Agents
          </a>
          <a
            href="/#pricing"
            className="hover:text-primary transition-colors py-3"
          >
            Pricing
          </a>
        </div>

        <div className="flex items-center gap-3">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="hidden sm:inline-flex px-4 py-2.5 text-sm text-neutral-600 hover:text-primary transition-colors">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="hidden sm:inline-flex px-5 py-2.5 bg-primary text-surface text-sm font-medium rounded-lg hover:bg-neutral-800 transition-colors">
                Get started
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <a
              href="/profile"
              className="hidden sm:inline-flex px-4 py-2.5 text-sm text-neutral-600 hover:text-primary transition-colors"
            >
              Profile
            </a>
            <a
              href="/dashboard"
              className="hidden sm:inline-flex px-4 py-2.5 text-sm text-neutral-600 hover:text-primary transition-colors"
            >
              Dashboard
            </a>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-8 h-8",
                },
              }}
            />
          </Show>
        </div>
      </div>
    </nav>
  );
}
