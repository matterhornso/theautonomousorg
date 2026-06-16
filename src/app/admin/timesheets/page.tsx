import { resolveTenant } from "../_lib/resolve-tenant";
import {
  PageHeader,
  Section,
  Stat,
  Pill,
  EmptyState,
  Code,
} from "../_components/primitives";
import {
  currentPeriodKey,
  ensurePeriodSubmissions,
  listEmployees,
  listSubmissionsForPeriod,
} from "@/lib/timesheets";
import { isTelegramConfigured } from "@/lib/telegram";
import { TimesheetActions } from "./_components/timesheet-actions";
import { MarkSubmittedButton } from "./_components/mark-submitted-button";
import { RowActions } from "./_components/row-actions";
import { ScheduleCard } from "./_components/schedule-card";
import {
  getOrCreateSchedule,
  describeCron,
} from "@/lib/reminder-schedule";

export const dynamic = "force-dynamic";

export default async function TimesheetsPage() {
  const { firm } = await resolveTenant();
  const periodKey = currentPeriodKey();
  const telegramOk = isTelegramConfigured();
  const dbConfigured = Boolean(process.env.DATABASE_URL);

  let employees: Awaited<ReturnType<typeof listEmployees>> = [];
  let rows: Awaited<ReturnType<typeof listSubmissionsForPeriod>> = [];

  if (dbConfigured) {
    employees = await listEmployees(firm.id);
    if (employees.length > 0) {
      // Idempotent: only inserts new period rows on the first call this week.
      await ensurePeriodSubmissions(firm.id, periodKey);
    }
    rows = await listSubmissionsForPeriod(firm.id, periodKey);
  }

  const scheduleData = dbConfigured ? await getOrCreateSchedule(firm.id) : null;
  const scheduleDescription = scheduleData
    ? describeCron(scheduleData.cron)
    : "Daily at 5:00 PM";

  const linkedCount = employees.filter((e) => e.telegramChatId !== null).length;
  const submitted = rows.filter((r) => r.submission.submittedAt !== null).length;
  const outstanding = rows.length - submitted;
  const submitPct =
    rows.length === 0 ? 0 : Math.round((submitted / rows.length) * 100);

  return (
    <div className="flex flex-col gap-12">
      <PageHeader
        eyebrow={`${firm.name} · Timesheets · ${periodKey}`}
        title="Quiet weekly timesheet nudges, on Telegram."
        description={
          telegramOk
            ? `${employees.length} employees on the roster · ${linkedCount} linked to Telegram. The reminder bot pings outstanding submissions on schedule and accepts DONE / HELP replies.`
            : `Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET in your environment to enable the reminder bot.`
        }
      />

      {!dbConfigured && (
        <Section title="Setup">
          <EmptyState
            title="DATABASE_URL is not configured"
            description="Set DATABASE_URL in .env.local and apply migrations 001-005 before adding employees."
            action={
              <div className="text-left max-w-lg mx-auto mt-4">
                <Code block>
                  {`# 1. Set DATABASE_URL in .env.local
# 2. Apply migrations
psql "$DATABASE_URL" -f migrations/001_rls_policies.sql
psql "$DATABASE_URL" -f migrations/002_vault.sql
psql "$DATABASE_URL" -f migrations/003_lessons.sql
psql "$DATABASE_URL" -f migrations/004_tenant_provisioning.sql
psql "$DATABASE_URL" -f migrations/005_timesheets.sql`}
                </Code>
              </div>
            }
          />
        </Section>
      )}

      {dbConfigured && (
        <>
          <Section title="This week">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 divide-x divide-neutral-200/60">
              <Stat label="Submitted" value={submitted} hint={`of ${rows.length}`} />
              <Stat
                label="Outstanding"
                value={outstanding}
                delta={
                  outstanding === 0
                    ? { value: "all in", tone: "success" }
                    : { value: "follow up", tone: "warning" }
                }
              />
              <Stat label="Roster" value={employees.length} />
              <Stat label="Telegram-linked" value={linkedCount} />
            </div>
          </Section>

          {scheduleData && (
            <Section
              title="Schedule"
              description="Reminders fire on this cadence automatically once the cron worker is wired up. Run-pass button below works regardless."
            >
              <ScheduleCard
                schedule={{
                  cron: scheduleData.cron,
                  timezone: scheduleData.timezone,
                  paused: scheduleData.paused,
                  lastRunAt: scheduleData.lastRunAt
                    ? scheduleData.lastRunAt.toISOString()
                    : null,
                  nextRunAt: scheduleData.nextRunAt
                    ? scheduleData.nextRunAt.toISOString()
                    : null,
                }}
                description={scheduleDescription}
              />
            </Section>
          )}

          <Section
            title="Roster"
            description="Add employees here. Each one runs `/link <email>` in Telegram once to bind their chat."
            rail={<TimesheetActions canRun={linkedCount > 0} />}
          >
            {employees.length === 0 ? (
              <EmptyState
                title="No employees yet"
                description="Add your first employee using the button above."
              />
            ) : (
              <div className="overflow-x-auto -mx-6 px-6">
              <div className="divide-y divide-neutral-200/60 min-w-[760px]">
                <div className="grid grid-cols-[1.4fr_1.4fr_0.9fr_1fr_0.5fr_1fr_0.5fr] gap-4 py-3 text-[11px] uppercase tracking-[0.12em] text-neutral-500">
                  <span>Name</span>
                  <span>Email</span>
                  <span>Telegram</span>
                  <span>Status · {periodKey}</span>
                  <span className="text-right">Reminders</span>
                  <span className="text-right">Action</span>
                  <span className="text-right">Manage</span>
                </div>
                {rows.length === 0 &&
                  employees.map((e) => (
                    <div
                      key={e.id}
                      className="grid grid-cols-[1.4fr_1.4fr_0.9fr_1fr_0.5fr_1fr_0.5fr] gap-4 py-4 items-center"
                    >
                      <span className="text-[14px] text-primary">{e.name}</span>
                      <span className="text-[13px] text-neutral-600">{e.email}</span>
                      <span className="text-[13px]">
                        {e.telegramChatId ? (
                          <Pill tone="success">Linked</Pill>
                        ) : (
                          <Pill tone="neutral">Awaiting /link</Pill>
                        )}
                      </span>
                      <span className="text-[13px] text-neutral-500">No row yet</span>
                      <span></span>
                      <span></span>
                      <RowActions employeeId={e.id} employeeName={e.name} />
                    </div>
                  ))}
                {rows.map(({ submission, employee }) => (
                  <div
                    key={submission.id}
                    className="grid grid-cols-[1.4fr_1.4fr_0.9fr_1fr_0.5fr_1fr_0.5fr] gap-4 py-4 items-center"
                  >
                    <span className="text-[14px] text-primary">{employee.name}</span>
                    <span className="text-[13px] text-neutral-600">{employee.email}</span>
                    <span className="text-[13px]">
                      {employee.telegramChatId ? (
                        <Pill tone="success">Linked</Pill>
                      ) : (
                        <Pill tone="neutral">Awaiting /link</Pill>
                      )}
                    </span>
                    <span className="text-[13px]">
                      {submission.submittedAt ? (
                        <Pill tone="success">
                          Submitted ·{" "}
                          {new Date(submission.submittedAt).toLocaleDateString("en-IN", {
                            weekday: "short",
                          })}
                        </Pill>
                      ) : (
                        <Pill tone="warning">Outstanding</Pill>
                      )}
                    </span>
                    <span className="text-[13px] tabular text-neutral-600 text-right">
                      {submission.remindersSent}
                    </span>
                    <span className="text-right">
                      {submission.submittedAt ? (
                        <span className="text-[12px] text-neutral-400">—</span>
                      ) : (
                        <MarkSubmittedButton
                          submissionId={submission.id}
                          employeeName={employee.name}
                        />
                      )}
                    </span>
                    <RowActions
                      employeeId={employee.id}
                      employeeName={employee.name}
                      resetSubmissionId={
                        submission.submittedAt ? submission.id : undefined
                      }
                    />
                  </div>
                ))}
              </div>
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
