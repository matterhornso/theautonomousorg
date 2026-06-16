import Link from "next/link";
import { resolveTenant } from "../../_lib/resolve-tenant";
import {
  PageHeader,
  Section,
  Pill,
  EmptyState,
} from "../../_components/primitives";
import { ChevronRight } from "../../_components/icons";
import {
  listSubmissionHistory,
  aggregateHistory,
  currentPeriodKey,
  type PeriodSummary,
  type Employee,
  type TimesheetSubmission,
} from "@/lib/timesheets";

export const dynamic = "force-dynamic";

// ─── Mock fixture (used when DATABASE_URL is absent or the DB is unreachable),
// mirroring the admin mock-fallback convention so the page always renders.
function mockEmployee(id: string, name: string): Employee {
  return {
    id,
    companyId: "mock",
    name,
    email: `${id}@jaa-associates.com`,
    telegramHandle: null,
    telegramChatId: 1,
    timezone: "Asia/Kolkata",
    active: true,
    createdAt: new Date("2026-01-01"),
  };
}
function mockSub(
  employeeId: string,
  periodKey: string,
  submittedDay: string | null
): TimesheetSubmission {
  return {
    id: `sub_${employeeId}_${periodKey}`,
    companyId: "mock",
    employeeId,
    periodKey,
    submittedAt: submittedDay ? new Date(submittedDay) : null,
    source: submittedDay ? "telegram" : null,
    notes: null,
    remindersSent: submittedDay ? 1 : 3,
    lastReminderAt: null,
    createdAt: new Date("2026-05-01"),
  };
}
const MOCK_EMPLOYEES = [
  mockEmployee("e_girish", "Girish Kumar"),
  mockEmployee("e_asha", "Asha Nair"),
];
const MOCK_HISTORY: PeriodSummary[] = aggregateHistory([
  { submission: mockSub("e_girish", "2026-W18", "2026-05-02"), employee: MOCK_EMPLOYEES[0] },
  { submission: mockSub("e_asha", "2026-W18", "2026-05-02"), employee: MOCK_EMPLOYEES[1] },
  { submission: mockSub("e_girish", "2026-W17", "2026-04-25"), employee: MOCK_EMPLOYEES[0] },
  { submission: mockSub("e_asha", "2026-W17", null), employee: MOCK_EMPLOYEES[1] },
  { submission: mockSub("e_girish", "2026-W16", "2026-04-18"), employee: MOCK_EMPLOYEES[0] },
  { submission: mockSub("e_asha", "2026-W16", "2026-04-19"), employee: MOCK_EMPLOYEES[1] },
]);

function formatPeriod(key: string): string {
  const m = /^(\d{4})-W(\d{1,2})$/.exec(key);
  if (!m) return key;
  return `Week ${Number(m[2])} · ${m[1]}`;
}

function complianceTone(pct: number): "success" | "warning" | "danger" {
  if (pct >= 100) return "success";
  if (pct >= 60) return "warning";
  return "danger";
}

export default async function TimesheetHistoryPage() {
  const { firm } = await resolveTenant();
  const current = currentPeriodKey();

  let summaries: PeriodSummary[] = [];
  let usedMock = false;
  if (process.env.DATABASE_URL) {
    try {
      summaries = aggregateHistory(await listSubmissionHistory(firm.id));
    } catch {
      summaries = MOCK_HISTORY;
      usedMock = true;
    }
  } else {
    summaries = MOCK_HISTORY;
    usedMock = true;
  }

  return (
    <div className="flex flex-col gap-12">
      <PageHeader
        eyebrow={`${firm.name} · Timesheets`}
        title="Submission history"
        description="Past periods and per-employee compliance, drawn from every recorded timesheet submission."
        rail={
          <Link
            href="/admin/timesheets"
            className="flex items-center gap-1 text-[13px] text-neutral-600 hover:text-primary transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5 rotate-180" />
            Back to roster
          </Link>
        }
      />

      {usedMock && (
        <p className="text-[12px] text-[#7a5212] bg-[#C4891A]/10 border border-[#C4891A]/20 rounded-md px-3 py-2 -mt-6 w-fit">
          Sample data — live database unavailable.
        </p>
      )}

      {summaries.length === 0 ? (
        <Section title="History">
          <EmptyState
            title="No past periods yet"
            description="Once reminders run for a full period, each week's compliance will appear here."
          />
        </Section>
      ) : (
        summaries.map((p) => {
          const isCurrent = p.periodKey === current;
          return (
            <Section
              key={p.periodKey}
              title={formatPeriod(p.periodKey)}
              rail={
                <div className="flex items-center gap-2">
                  {isCurrent && <Pill tone="info">Current</Pill>}
                  <Pill tone={complianceTone(p.pct)}>
                    {p.submitted}/{p.total} · {p.pct}%
                  </Pill>
                </div>
              }
            >
              {/* compliance bar */}
              <div className="h-1.5 rounded-full bg-neutral-200/70 overflow-hidden mb-5">
                <div
                  className="h-full bg-[#2D5A3D] rounded-full"
                  style={{ width: `${p.pct}%` }}
                />
              </div>

              <div className="divide-y divide-neutral-200/60">
                <div className="hidden sm:grid grid-cols-[1.6fr_1fr_1fr] gap-4 py-2 text-[11px] uppercase tracking-[0.12em] text-neutral-500">
                  <span>Employee</span>
                  <span>Status</span>
                  <span>Submitted</span>
                </div>
                {p.rows.map(({ submission, employee }) => (
                  <div
                    key={submission.id}
                    className="grid grid-cols-1 sm:grid-cols-[1.6fr_1fr_1fr] gap-1 sm:gap-4 py-3 sm:items-center"
                  >
                    <span className="text-[14px] text-primary">
                      {employee.name}
                    </span>
                    <span>
                      {submission.submittedAt ? (
                        <Pill tone="success">Submitted</Pill>
                      ) : (
                        <Pill tone="warning">Missed</Pill>
                      )}
                    </span>
                    <span className="text-[13px] text-neutral-600 tabular">
                      {submission.submittedAt
                        ? new Date(submission.submittedAt).toLocaleDateString(
                            "en-IN",
                            { day: "numeric", month: "short", year: "numeric" }
                          )
                        : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          );
        })
      )}
    </div>
  );
}
