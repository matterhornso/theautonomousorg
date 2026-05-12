import {
  PageHeader,
  Section,
  Pill,
  Code,
  RelativeTime,
  EmptyState,
} from "../_components/primitives";
import { BillingIcon, ArrowUpRight } from "../_components/icons";
import { resolveTenant } from "../_lib/resolve-tenant";
import {
  getCredits,
  getCreditTransactions,
  getSubscription,
} from "@/lib/db";
import { CREDIT_PACKS, STRIPE_PRICES, isStripeConfigured } from "@/lib/stripe";

const planLabel: Record<string, string> = {
  free: "Starter (Free)",
  growth: "Growth",
  enterprise: "Enterprise",
};

const planTone: Record<string, "neutral" | "accent" | "success" | "info"> = {
  free: "neutral",
  growth: "accent",
  enterprise: "success",
};

const txTypeTone: Record<
  string,
  "neutral" | "success" | "danger" | "info" | "warning" | "accent"
> = {
  signup: "info",
  topup: "success",
  usage: "neutral",
  refund: "warning",
  bonus: "accent",
};

function fmtCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export default async function BillingPage() {
  const tenant = await resolveTenant();

  const [credits, txns, subscription] = await Promise.all([
    getCredits(tenant.user.id).catch(() => ({
      balance: 0,
      total_earned: 0,
      total_spent: 0,
    })),
    getCreditTransactions(tenant.user.id, 20).catch(() => []),
    getSubscription(tenant.firm.id).catch(() => null),
  ]);

  const plan = subscription?.plan ?? "free";
  const stripeReady = isStripeConfigured();

  return (
    <div className="flex flex-col gap-12">
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <BillingIcon className="w-3.5 h-3.5" />
            Billing
          </span>
        }
        title="Credits + plan."
        description="Pay for the work that got done — not for seats sitting in chairs. Every agent prompt deducts 50 credits regardless of role. Bring your own model to discount overhead."
      />

      {/* ── Top stats ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4 -mx-6 px-6 py-6 border-y border-neutral-200/80">
        <div className="flex flex-col gap-1.5">
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
            Current balance
          </span>
          <span className="font-[family-name:var(--font-serif)] text-[34px] tabular leading-none text-primary">
            {credits.balance.toLocaleString()}
          </span>
          <span className="text-[11px] text-neutral-500">TA credits</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
            Used to date
          </span>
          <span className="font-[family-name:var(--font-serif)] text-[34px] tabular leading-none text-primary">
            {credits.total_spent.toLocaleString()}
          </span>
          <span className="text-[11px] text-neutral-500">across all agents</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
            Plan
          </span>
          <span className="inline-flex items-center gap-2">
            <Pill tone={planTone[plan] ?? "neutral"}>
              {planLabel[plan] ?? plan}
            </Pill>
          </span>
          {subscription?.current_period_end && (
            <span className="text-[11px] text-neutral-500">
              renews <RelativeTime ts={new Date(subscription.current_period_end)} />
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
            Stripe
          </span>
          <span className="inline-flex items-center gap-2">
            <Pill tone={stripeReady ? "success" : "neutral"}>
              {stripeReady ? "Connected" : "Not configured"}
            </Pill>
          </span>
          {subscription?.stripe_customer_id && (
            <Code>{subscription.stripe_customer_id.slice(0, 16)}…</Code>
          )}
        </div>
      </div>

      {/* ── Top up ─────────────────────────────────────────────── */}
      <Section
        title="Top up credits"
        description="One-time purchases. Larger packs are discounted per-credit."
      >
        {stripeReady ? (
          <div className="grid sm:grid-cols-2 gap-4 -mx-6 px-6 py-5 border-y border-neutral-200/60">
            {CREDIT_PACKS.map((pack) => (
              <form
                key={pack.id}
                action="/api/billing/checkout"
                method="POST"
                className="group flex items-start justify-between gap-4 p-5 rounded-xl border border-neutral-200/80 bg-white hover:border-accent/60 hover:shadow-sm transition-all"
              >
                <input type="hidden" name="packId" value={pack.id} />
                <div className="min-w-0">
                  <h3 className="font-[family-name:var(--font-serif)] text-[20px] leading-tight text-primary">
                    {pack.name}
                  </h3>
                  <p className="text-[13px] text-neutral-500 mt-1">
                    {pack.description}
                  </p>
                  <p className="text-[12px] text-neutral-400 mt-2 font-[family-name:var(--font-mono)]">
                    {(pack.price_cents / pack.credits).toFixed(2)}¢ per credit
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="font-[family-name:var(--font-serif)] text-[22px] tabular text-primary">
                    {fmtCurrency(pack.price_cents)}
                  </span>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-surface text-[12px] hover:bg-neutral-800 transition-colors"
                  >
                    Buy
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              </form>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Stripe not configured"
            description="Set STRIPE_SECRET_KEY in env to enable credit top-ups and plan changes. Until then, agents run on the credit balance shown above."
          />
        )}
      </Section>

      {/* ── Plan ─────────────────────────────────────────────── */}
      <Section
        title="Plan"
        description="Monthly subscription with included credits. Switch any time."
      >
        <div className="grid md:grid-cols-3 gap-4 -mx-6 px-6 py-5 border-y border-neutral-200/60">
          <PlanCard
            name="Starter"
            price="Free"
            included="1,000 TA credits"
            features={["WhatsApp + Telegram", "Claude Sonnet 4.6", "Community support"]}
            active={plan === "free"}
            stripeReady={stripeReady}
            priceId={undefined}
          />
          <PlanCard
            name="Growth"
            price="$49/mo"
            included="5,000 TA credits / month"
            features={["+ Slack", "BYOM (any model)", "Priority support", "Agent collaboration"]}
            active={plan === "growth"}
            stripeReady={stripeReady && Boolean(STRIPE_PRICES.growth_monthly)}
            priceId={STRIPE_PRICES.growth_monthly}
            recommended
          />
          <PlanCard
            name="Enterprise"
            price="Custom"
            included="Unlimited TA credits"
            features={["All integrations", "Custom models + fine-tunes", "SOC2 + HIPAA", "Dedicated CSM"]}
            active={plan === "enterprise"}
            stripeReady={false}
            priceId={undefined}
            contact
          />
        </div>
      </Section>

      {/* ── Recent transactions ─────────────────────────────── */}
      <Section
        title="Recent transactions"
        description={
          txns.length === 0
            ? undefined
            : `Last ${txns.length} credit movement${txns.length === 1 ? "" : "s"} on this account.`
        }
      >
        {txns.length === 0 ? (
          <EmptyState
            title="No credit activity yet"
            description="Topups, signups, agent prompts, and refunds will show up here."
          />
        ) : (
          <ul className="divide-y divide-neutral-200/50">
            {txns.map((tx, i) => (
              <li
                key={tx.id}
                className={`animate-fade-up delay-${((i % 5) + 1) as 1 | 2 | 3 | 4 | 5}`}
              >
                <article className="grid grid-cols-[minmax(0,1fr)_120px_140px_120px] items-center gap-5 px-6 py-4 -mx-6 hover:bg-[rgba(212,168,83,0.04)] transition-colors">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Pill tone={txTypeTone[tx.type] ?? "neutral"}>
                        {tx.type}
                      </Pill>
                    </div>
                    <p className="text-[13.5px] text-neutral-700 mt-1.5 truncate">
                      {tx.description ?? "—"}
                    </p>
                  </div>
                  <span
                    className={`text-[14px] font-[family-name:var(--font-mono)] tabular ${
                      tx.amount >= 0 ? "text-emerald-700" : "text-neutral-500"
                    }`}
                  >
                    {tx.amount >= 0 ? "+" : ""}
                    {tx.amount.toLocaleString()}
                  </span>
                  <span className="text-[13px] text-neutral-500 tabular">
                    balance {tx.balance_after.toLocaleString()}
                  </span>
                  <span className="text-[12.5px] text-neutral-500 text-right">
                    <RelativeTime ts={new Date(tx.created_at)} />
                  </span>
                </article>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function PlanCard({
  name,
  price,
  included,
  features,
  active,
  stripeReady,
  priceId,
  recommended,
  contact,
}: {
  name: string;
  price: string;
  included: string;
  features: string[];
  active: boolean;
  stripeReady: boolean;
  priceId: string | undefined;
  recommended?: boolean;
  contact?: boolean;
}) {
  return (
    <div
      className={`relative p-5 rounded-xl border ${
        active
          ? "border-accent bg-accent/5"
          : recommended
            ? "border-primary/30 bg-white"
            : "border-neutral-200/80 bg-white"
      }`}
    >
      {recommended && !active && (
        <span className="absolute -top-3 right-4 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-surface text-[10px] uppercase tracking-wider">
          Recommended
        </span>
      )}
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className="font-[family-name:var(--font-serif)] text-[22px] text-primary">
          {name}
        </h3>
        {active && <Pill tone="accent">Active</Pill>}
      </div>
      <p className="text-[20px] tabular text-primary mb-1">{price}</p>
      <p className="text-[12.5px] text-neutral-500 mb-4">{included}</p>
      <ul className="space-y-1.5 text-[12.5px] text-neutral-600 mb-5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <span className="text-accent">·</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {active ? (
        <div className="text-[12px] text-neutral-500">Current plan.</div>
      ) : contact ? (
        <a
          href="mailto:enterprise@theautonomous.org"
          className="inline-flex items-center justify-center w-full px-3 py-2 rounded-md border border-neutral-300 text-[13px] hover:bg-neutral-50 transition-colors"
        >
          Contact sales
        </a>
      ) : stripeReady && priceId ? (
        <form action="/api/billing/checkout" method="POST">
          <input type="hidden" name="priceId" value={priceId} />
          <button
            type="submit"
            className="inline-flex items-center justify-center w-full px-3 py-2 rounded-md bg-primary text-surface text-[13px] hover:bg-neutral-800 transition-colors"
          >
            Upgrade
          </button>
        </form>
      ) : (
        <div className="text-[12px] text-neutral-400 italic">
          Stripe not configured
        </div>
      )}
    </div>
  );
}
