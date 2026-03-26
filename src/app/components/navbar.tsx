"use client";

import { useState, useEffect } from "react";
import {
  SignInButton,
  SignUpButton,
  UserButton,
  Show,
} from "@clerk/nextjs";
import { Logo } from "./logo";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled || mobileOpen
            ? "bg-surface/90 backdrop-blur-xl border-b border-neutral-200"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center">
            <Logo />
          </a>

          {/* Desktop nav */}
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
            <a
              href="/blog"
              className="hover:text-primary transition-colors py-3"
            >
              Blog
            </a>
          </div>

          <div className="flex items-center gap-3">
            {/* Desktop auth */}
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

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 -mr-2"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 pt-16 bg-surface/95 backdrop-blur-xl md:hidden">
          <div className="px-6 py-6 space-y-1">
            <a
              href="/#how-it-works"
              onClick={() => setMobileOpen(false)}
              className="block py-3 text-lg text-neutral-700 hover:text-primary transition-colors"
            >
              How it works
            </a>
            <a
              href="/#agents"
              onClick={() => setMobileOpen(false)}
              className="block py-3 text-lg text-neutral-700 hover:text-primary transition-colors"
            >
              Agents
            </a>
            <a
              href="/#pricing"
              onClick={() => setMobileOpen(false)}
              className="block py-3 text-lg text-neutral-700 hover:text-primary transition-colors"
            >
              Pricing
            </a>
            <a
              href="/blog"
              onClick={() => setMobileOpen(false)}
              className="block py-3 text-lg text-neutral-700 hover:text-primary transition-colors"
            >
              Blog
            </a>

            <div className="pt-4 border-t border-neutral-200 mt-4 space-y-3">
              <Show when="signed-out">
                <SignInButton mode="modal">
                  <button
                    onClick={() => setMobileOpen(false)}
                    className="block w-full py-3 text-center text-sm text-neutral-600 border border-neutral-200 rounded-xl hover:bg-neutral-50"
                  >
                    Sign in
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button
                    onClick={() => setMobileOpen(false)}
                    className="block w-full py-3 text-center text-sm font-medium bg-primary text-surface rounded-xl hover:bg-neutral-800"
                  >
                    Get started
                  </button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                <a
                  href="/profile"
                  className="block py-3 text-lg text-neutral-700 hover:text-primary transition-colors"
                >
                  Profile
                </a>
                <a
                  href="/dashboard"
                  className="block py-3 text-lg text-neutral-700 hover:text-primary transition-colors"
                >
                  Dashboard
                </a>
              </Show>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
