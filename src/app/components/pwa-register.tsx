"use client";
import { useEffect } from "react";
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // In dev, the service worker aggressively caches the JS bundle and
    // intercepts requests, so code changes don't take effect until the user
    // manually unregisters it. Skip registration in dev and proactively
    // unregister any leftover worker from a previous session.
    const isDev =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1");
    if (isDev) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .catch(() => {});
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
