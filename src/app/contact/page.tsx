"use client";

import { useState } from "react";
import { Navbar } from "../components/navbar";

export default function ContactPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 lg:px-8 pt-28 pb-20">
        <h1 className="font-[family-name:var(--font-serif)] text-4xl tracking-tight mb-2">
          Contact Us
        </h1>
        <p className="text-neutral-500 text-sm mb-10">
          Have a question, partnership inquiry, or need support? We&apos;d love
          to hear from you.
        </p>

        <div className="grid lg:grid-cols-[1fr,280px] gap-12">
          {submitted ? (
            <div className="bg-secondary/5 border border-secondary/20 rounded-2xl p-8 text-center">
              <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-6 h-6 text-secondary"
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
              <h3 className="font-semibold text-lg mb-2">Message sent</h3>
              <p className="text-sm text-neutral-500">
                Thanks for reaching out. We&apos;ll get back to you within 24
                hours.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Name
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                    placeholder="Jane Smith"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                    placeholder="jane@company.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Subject
                </label>
                <select
                  value={form.subject}
                  onChange={(e) =>
                    setForm({ ...form, subject: e.target.value })
                  }
                  required
                  className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all appearance-none"
                >
                  <option value="">Select a topic</option>
                  <option value="general">General inquiry</option>
                  <option value="support">Technical support</option>
                  <option value="enterprise">Enterprise plan</option>
                  <option value="partnership">Partnership</option>
                  <option value="press">Press / media</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Message
                </label>
                <textarea
                  required
                  rows={5}
                  value={form.message}
                  onChange={(e) =>
                    setForm({ ...form, message: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all resize-none"
                  placeholder="Tell us how we can help..."
                />
              </div>

              <button
                type="submit"
                className="px-8 py-3 bg-primary text-surface font-medium rounded-xl text-sm hover:bg-neutral-800 transition-colors"
              >
                Send message
              </button>
            </form>
          )}

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold mb-2">Email</h3>
              <a
                href="mailto:hello@theautonomous.org"
                className="text-sm text-accent hover:underline"
              >
                hello@theautonomous.org
              </a>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Support</h3>
              <a
                href="mailto:support@theautonomous.org"
                className="text-sm text-accent hover:underline"
              >
                support@theautonomous.org
              </a>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Enterprise sales</h3>
              <a
                href="mailto:enterprise@theautonomous.org"
                className="text-sm text-accent hover:underline"
              >
                enterprise@theautonomous.org
              </a>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Built by</h3>
              <p className="text-sm text-neutral-500">
                Chainflux
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
