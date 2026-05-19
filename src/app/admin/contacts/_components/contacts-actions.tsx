"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../_components/primitives";
import { SparkleIcon, SpinnerIcon, FileIcon } from "../../_components/icons";
import { useToast } from "../../_components/toast";

/**
 * Admin actions for the Contacts page: CSV bulk import + single add.
 * Mirrors timesheet-actions.tsx (toast feedback, router.refresh on success).
 */
export function ContactsActions() {
  const router = useRouter();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/contacts/import", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) {
        toast({
          title: "Import failed",
          body:
            (json.error ?? `HTTP ${res.status}`) +
            (json.warnings?.length ? ` (${json.warnings[0]})` : ""),
          tone: "danger",
          durationMs: 9000,
        });
      } else {
        const warned = json.warnings?.length
          ? ` ${json.warnings.length} row(s) skipped — check the file.`
          : "";
        toast({
          title: `Imported ${json.written} contact(s)`,
          body: `Parsed ${json.parsed} row(s) from ${file.name}.${warned}`,
          tone: warned ? "warning" : "success",
          durationMs: 8000,
        });
        router.refresh();
      }
    } catch (err) {
      toast({
        title: "Upload error",
        body: err instanceof Error ? err.message : String(err),
        tone: "danger",
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleAdd() {
    if (!name.trim() || (!email.trim() && !phone.trim())) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({
          title: "Couldn't add contact",
          body: json.error ?? `HTTP ${res.status}`,
          tone: "danger",
        });
      } else {
        toast({
          title: `${name.trim()} added`,
          body: "They'll receive the next broadcast by email and Telegram.",
          tone: "success",
        });
        setName("");
        setEmail("");
        setPhone("");
        setShowAdd(false);
        router.refresh();
      }
    } catch (err) {
      toast({
        title: "Add failed",
        body: err instanceof Error ? err.message : String(err),
        tone: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-3">
      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          className="hidden"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdd((s) => !s)}
        >
          {showAdd ? "Close" : "Add contact"}
        </Button>
        <Button
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className={uploading ? "admin-cta-progress" : "admin-cta-idle"}
        >
          {uploading ? (
            <SpinnerIcon className="w-4 h-4 admin-spinner" />
          ) : (
            <FileIcon className="w-4 h-4" />
          )}
          {uploading ? "Importing…" : "Import CSV"}
        </Button>
      </div>

      {showAdd && (
        <div className="w-[420px] flex flex-col gap-2 p-4 bg-white border border-neutral-200 rounded-md">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="px-3 py-2 text-[14px] border border-neutral-200 rounded focus:outline-none focus:border-accent"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@firm.com (optional if phone given)"
            type="email"
            className="px-3 py-2 text-[14px] border border-neutral-200 rounded focus:outline-none focus:border-accent"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 99999 00000 (optional)"
            className="px-3 py-2 text-[14px] border border-neutral-200 rounded focus:outline-none focus:border-accent"
          />
          <Button
            onClick={handleAdd}
            disabled={submitting}
            size="sm"
            className={
              !submitting && name && (email || phone) ? "admin-cta-idle" : ""
            }
          >
            {submitting ? (
              <SpinnerIcon className="w-4 h-4 admin-spinner" />
            ) : (
              <SparkleIcon className="w-4 h-4 admin-cta-icon-sparkle" />
            )}
            {submitting ? "Adding…" : "Add contact"}
          </Button>
          <p className="text-[12px] text-neutral-500 leading-relaxed mt-1">
            Bulk import: a CSV with a <code className="text-[11px] font-mono bg-neutral-100 px-1 rounded">name</code> column and{" "}
            <code className="text-[11px] font-mono bg-neutral-100 px-1 rounded">email</code> /{" "}
            <code className="text-[11px] font-mono bg-neutral-100 px-1 rounded">phone</code> columns.
          </p>
        </div>
      )}
    </div>
  );
}
