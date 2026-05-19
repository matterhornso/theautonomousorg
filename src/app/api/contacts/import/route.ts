/**
 * POST /api/contacts/import — bulk-import contacts from CSV.
 *
 * Accepts either:
 *   - multipart/form-data with a `file` field (the admin UI upload), or
 *   - a raw text/csv request body (scripts, curl).
 *
 * The CSV needs a header row with a `name` column and at least one of
 * `email` / `phone`. Existing emails are updated, not duplicated.
 *
 * Requires a Clerk session (proxy.ts gates /api/contacts).
 */

import { NextRequest, NextResponse } from "next/server";
import { parseContactsCsv, bulkUpsertContacts } from "@/lib/contacts";
import { resolveTenant } from "@/app/admin/_lib/resolve-tenant";

const MAX_CSV_BYTES = 2_000_000; // 2 MB — generous for a contact list

export async function POST(request: NextRequest) {
  const { firm } = await resolveTenant();

  let csvText: string;
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: 'Upload a CSV file in the "file" field.' },
          { status: 400 }
        );
      }
      if (file.size > MAX_CSV_BYTES) {
        return NextResponse.json(
          { error: "CSV is too large (max 2 MB)." },
          { status: 413 }
        );
      }
      csvText = await file.text();
    } else {
      csvText = await request.text();
    }
  } catch {
    return NextResponse.json(
      { error: "Could not read the uploaded CSV." },
      { status: 400 }
    );
  }

  if (!csvText.trim()) {
    return NextResponse.json({ error: "The CSV is empty." }, { status: 400 });
  }
  if (csvText.length > MAX_CSV_BYTES) {
    return NextResponse.json(
      { error: "CSV is too large (max 2 MB)." },
      { status: 413 }
    );
  }

  const { contacts, warnings } = parseContactsCsv(csvText);
  if (contacts.length === 0) {
    return NextResponse.json(
      { error: "No valid contacts found in the CSV.", warnings },
      { status: 422 }
    );
  }

  try {
    const { written } = await bulkUpsertContacts(firm.id, contacts);
    return NextResponse.json({ written, parsed: contacts.length, warnings });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
