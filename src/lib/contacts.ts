/**
 * Contact-list domain logic for the broadcast agent (migration 009).
 *
 * A `contact` is a person at the firm who can receive broadcasts. Distinct
 * from `employees` (the timesheet roster): contacts are the firm-wide
 * audience, imported in bulk from CSV. Email is the upsert key; phone is
 * stored for a future WhatsApp channel.
 *
 * All functions are no-ops / empty when DATABASE_URL is missing, matching
 * the timesheets.ts pattern.
 */

import { randomUUID } from "crypto";

// ─── Types ─────────────────────────────────────────────────────────────

export interface Contact {
  id: string;
  companyId: string;
  name: string;
  email: string | null;
  phone: string | null;
  telegramChatId: number | null;
  active: boolean;
  createdAt: Date;
}

interface ContactRow {
  id: string;
  company_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  telegram_chat_id: string | number | null;
  active: boolean;
  created_at: Date;
}

function rowToContact(r: ContactRow): Contact {
  return {
    id: r.id,
    companyId: r.company_id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    telegramChatId:
      r.telegram_chat_id === null ? null : Number(r.telegram_chat_id),
    active: r.active,
    createdAt: r.created_at,
  };
}

async function getSql() {
  if (!process.env.DATABASE_URL) return null;
  const mod = await import("./db-postgres");
  return mod.sql;
}

// ─── CSV parsing (pure) ────────────────────────────────────────────────

/**
 * Minimal RFC-4180-ish CSV parser: handles quoted fields, embedded commas,
 * escaped quotes (""), CRLF/LF, and a leading BOM. Hand-rolled to avoid a
 * dependency (project convention: no casual new deps).
 */
export function parseCsv(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r") {
      // ignore — handled by the \n branch
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export interface ParsedContact {
  name: string;
  email: string | null;
  phone: string | null;
}

export interface CsvParseResult {
  contacts: ParsedContact[];
  /** Human-readable problems (skipped rows, missing columns). */
  warnings: string[];
}

/**
 * Turn raw CSV text into contact rows. Expects a header row containing at
 * least a `name` column and one of `email` / `phone`. Column order is free;
 * matching is case-insensitive; unknown columns are ignored.
 */
export function parseContactsCsv(text: string): CsvParseResult {
  const warnings: string[] = [];
  const grid = parseCsv(text.trim());
  if (grid.length === 0) {
    return { contacts: [], warnings: ["CSV is empty."] };
  }
  const header = grid[0]!.map((h) => h.trim().toLowerCase());
  const nameIdx = header.findIndex((h) => h === "name" || h === "full name");
  const emailIdx = header.findIndex((h) => h === "email" || h === "email address");
  const phoneIdx = header.findIndex(
    (h) => h === "phone" || h === "phone number" || h === "mobile"
  );
  if (nameIdx === -1) {
    return {
      contacts: [],
      warnings: ['CSV needs a "name" column in the header row.'],
    };
  }
  if (emailIdx === -1 && phoneIdx === -1) {
    return {
      contacts: [],
      warnings: ['CSV needs an "email" or "phone" column.'],
    };
  }

  const contacts: ParsedContact[] = [];
  const seenEmails = new Set<string>();
  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r]!;
    const name = (cells[nameIdx] ?? "").trim();
    const emailRaw = emailIdx === -1 ? "" : (cells[emailIdx] ?? "").trim();
    const phoneRaw = phoneIdx === -1 ? "" : (cells[phoneIdx] ?? "").trim();
    if (!name && !emailRaw && !phoneRaw) continue; // blank line
    if (!name) {
      warnings.push(`Row ${r + 1}: missing name — skipped.`);
      continue;
    }
    const email = emailRaw ? emailRaw.toLowerCase() : null;
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      warnings.push(`Row ${r + 1}: "${emailRaw}" is not a valid email — skipped.`);
      continue;
    }
    if (email && seenEmails.has(email)) {
      warnings.push(`Row ${r + 1}: duplicate email "${email}" in file — kept first.`);
      continue;
    }
    if (email) seenEmails.add(email);
    if (!email && !phoneRaw) {
      warnings.push(`Row ${r + 1}: no email or phone — skipped.`);
      continue;
    }
    contacts.push({ name, email, phone: phoneRaw || null });
  }
  return { contacts, warnings };
}

// ─── Contact CRUD ──────────────────────────────────────────────────────

export async function listContacts(companyId: string): Promise<Contact[]> {
  const sql = await getSql();
  if (!sql) return [];
  const rows = (await sql`
    SELECT * FROM contacts
    WHERE company_id = ${companyId}
    ORDER BY created_at DESC
  `) as ContactRow[];
  return rows.map(rowToContact);
}

export async function createContact(input: {
  companyId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
}): Promise<Contact> {
  const sql = await getSql();
  if (!sql) {
    throw new Error("DATABASE_URL is not configured. Cannot create contacts.");
  }
  const id = `con_${randomUUID()}`;
  const [row] = (await sql`
    INSERT INTO contacts (id, company_id, name, email, phone, active)
    VALUES (
      ${id},
      ${input.companyId},
      ${input.name},
      ${input.email ? input.email.toLowerCase() : null},
      ${input.phone ?? null},
      TRUE
    )
    RETURNING *
  `) as ContactRow[];
  if (!row) throw new Error("INSERT returned no row");
  return rowToContact(row);
}

/**
 * Bulk-import contacts from a parsed CSV. Upserts on (company_id, email):
 * an existing email refreshes name/phone and re-activates the row. Rows
 * without an email are always inserted (Postgres UNIQUE ignores NULLs).
 * Returns how many rows were written.
 */
export async function bulkUpsertContacts(
  companyId: string,
  rows: ParsedContact[]
): Promise<{ written: number }> {
  const sql = await getSql();
  if (!sql) {
    throw new Error("DATABASE_URL is not configured. Cannot import contacts.");
  }
  if (rows.length === 0) return { written: 0 };

  let written = 0;
  for (const c of rows) {
    await sql`
      INSERT INTO contacts (id, company_id, name, email, phone, active)
      VALUES (
        ${`con_${randomUUID()}`},
        ${companyId},
        ${c.name},
        ${c.email},
        ${c.phone},
        TRUE
      )
      ON CONFLICT (company_id, email) DO UPDATE SET
        name = EXCLUDED.name,
        phone = COALESCE(EXCLUDED.phone, contacts.phone),
        active = TRUE
    `;
    written++;
  }
  return { written };
}

export async function findContactByTelegramChatId(
  chatId: number
): Promise<Contact | null> {
  const sql = await getSql();
  if (!sql) return null;
  const rows = (await sql`
    SELECT * FROM contacts WHERE telegram_chat_id = ${chatId} LIMIT 1
  `) as ContactRow[];
  return rows[0] ? rowToContact(rows[0]) : null;
}

/**
 * Find a contact by email across all firms — used by the Telegram /link
 * command, which doesn't know the firm until the contact identifies itself.
 */
export async function findContactByEmailGlobal(
  email: string
): Promise<Contact | null> {
  const sql = await getSql();
  if (!sql) return null;
  const rows = (await sql`
    SELECT * FROM contacts
    WHERE email = ${email.toLowerCase()}
    ORDER BY created_at DESC
    LIMIT 1
  `) as ContactRow[];
  return rows[0] ? rowToContact(rows[0]) : null;
}

/** Bind a contact row to a Telegram chat_id. Idempotent. */
export async function linkContactTelegram(
  contactId: string,
  chatId: number
): Promise<void> {
  const sql = await getSql();
  if (!sql) throw new Error("DATABASE_URL is not configured.");
  await sql`
    UPDATE contacts SET telegram_chat_id = ${chatId} WHERE id = ${contactId}
  `;
}

export async function deactivateContact(contactId: string): Promise<void> {
  const sql = await getSql();
  if (!sql) throw new Error("DATABASE_URL is not configured.");
  await sql`UPDATE contacts SET active = FALSE WHERE id = ${contactId}`;
}
