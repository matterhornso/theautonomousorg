import { resolveTenant } from "../_lib/resolve-tenant";
import {
  PageHeader,
  Section,
  Stat,
  Pill,
  DataRow,
  EmptyState,
  Code,
  RelativeTime,
} from "../_components/primitives";
import { isTelegramConfigured } from "@/lib/telegram";
import { listContacts, type Contact } from "@/lib/contacts";
import { recentBroadcasts, type BroadcastLogEntry } from "@/lib/broadcast";
import { ContactsActions } from "./_components/contacts-actions";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const { firm } = await resolveTenant();
  const dbConfigured = Boolean(process.env.DATABASE_URL);
  const telegramOk = isTelegramConfigured();

  // Mock-fallback pattern: every admin DB read tries Postgres, catches,
  // degrades gracefully so the page renders without a database.
  let contacts: Contact[] = [];
  let broadcasts: BroadcastLogEntry[] = [];
  if (dbConfigured) {
    try {
      [contacts, broadcasts] = await Promise.all([
        listContacts(firm.id),
        recentBroadcasts(firm.id, 8),
      ]);
    } catch {
      contacts = [];
      broadcasts = [];
    }
  }

  const withEmail = contacts.filter((c) => c.email).length;
  const linked = contacts.filter((c) => c.telegramChatId !== null).length;

  return (
    <div className="flex flex-col gap-12">
      <PageHeader
        eyebrow={`${firm.name} · Contacts`}
        title="One contact list, broadcast from Telegram."
        description={
          telegramOk
            ? "Import everyone at the firm via CSV. A registered admin can then message the bot in plain English and reach every contact by email and Telegram."
            : "Set TELEGRAM_BOT_TOKEN to enable broadcasting. You can still build the contact list now."
        }
        rail={<ContactsActions />}
      />

      <div className="grid grid-cols-3 gap-px bg-neutral-200/70 border border-neutral-200/70 rounded-md overflow-hidden">
        <div className="bg-surface px-6">
          <Stat label="Contacts" value={contacts.length} />
        </div>
        <div className="bg-surface px-6">
          <Stat
            label="Email-addressable"
            value={withEmail}
            hint={contacts.length ? `${contacts.length - withEmail} phone-only` : undefined}
          />
        </div>
        <div className="bg-surface px-6">
          <Stat
            label="Telegram-linked"
            value={linked}
            hint={linked < contacts.length ? `${contacts.length - linked} not linked` : undefined}
          />
        </div>
      </div>

      <Section
        title="Contacts"
        description="Imported from CSV or added individually. Email goes to anyone with an address; Telegram reaches contacts who've linked their chat."
      >
        {contacts.length === 0 ? (
          <EmptyState
            title="No contacts yet"
            description={
              dbConfigured
                ? "Import a CSV with name, email and phone columns, or add someone individually."
                : "Connect a database (DATABASE_URL) to store contacts."
            }
          />
        ) : (
          <div className="flex flex-col divide-y divide-neutral-200/60">
            {contacts.map((c) => (
              <DataRow key={c.id}>
                <span className="flex-1 text-[14px] text-primary font-medium">
                  {c.name}
                </span>
                <span className="flex-1 text-[13px] text-neutral-600">
                  {c.email ?? <span className="text-neutral-400">—</span>}
                </span>
                <span className="w-40 text-[13px] text-neutral-600">
                  {c.phone ?? <span className="text-neutral-400">—</span>}
                </span>
                <span className="w-32 flex justify-end">
                  {c.telegramChatId !== null ? (
                    <Pill tone="success">Telegram linked</Pill>
                  ) : (
                    <Pill tone="neutral">Email only</Pill>
                  )}
                </span>
              </DataRow>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Broadcasting from Telegram"
        description="No dashboard needed to send — drive it from your phone."
      >
        <ol className="flex flex-col gap-3 text-[14px] text-neutral-700 leading-relaxed pt-2">
          <li>
            <span className="text-neutral-400 mr-2">1.</span>
            Open the firm&apos;s Telegram bot and send{" "}
            <Code>/register YOUR_CODE</Code> once to enrol as a broadcast admin.
          </li>
          <li>
            <span className="text-neutral-400 mr-2">2.</span>
            Message it in plain English — e.g.{" "}
            <Code>tell everyone the office is closed Friday</Code>. The agent
            writes the message and sends it to every contact by email + Telegram.
          </li>
          <li>
            <span className="text-neutral-400 mr-2">3.</span>
            Say <Code>send timesheet reminders</Code> to trigger the weekly
            reminder pass without opening the dashboard.
          </li>
        </ol>
      </Section>

      {broadcasts.length > 0 && (
        <Section
          title="Recent broadcasts"
          description="Every command an admin ran, with delivery counts."
        >
          <div className="flex flex-col divide-y divide-neutral-200/60">
            {broadcasts.map((b) => (
              <DataRow key={b.id}>
                <span className="flex-1 text-[14px] text-primary">
                  {b.action === "broadcast"
                    ? b.message?.slice(0, 80) || b.instruction.slice(0, 80)
                    : b.instruction.slice(0, 80)}
                </span>
                <span className="w-36">
                  <Pill
                    tone={
                      b.action === "broadcast"
                        ? "info"
                        : b.action === "send_reminders"
                        ? "success"
                        : "neutral"
                    }
                  >
                    {b.action.replace("_", " ")}
                  </Pill>
                </span>
                <span className="w-44 text-[12px] text-neutral-600 text-right">
                  {b.emailSent} email · {b.telegramSent} Telegram
                  {b.failed > 0 ? ` · ${b.failed} failed` : ""}
                </span>
                <span className="w-24 text-[12px] text-neutral-500 text-right">
                  <RelativeTime ts={b.createdAt} />
                </span>
              </DataRow>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
