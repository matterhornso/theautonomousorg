import { NextRequest, NextResponse } from "next/server";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { upsertSubscription } from "@/lib/db";

export async function POST(request: NextRequest) {
  if (!isStripeConfigured() || !stripe) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const companyId = session.metadata?.companyId;
      const plan = session.metadata?.plan;
      if (companyId && plan) {
        upsertSubscription(companyId, {
          plan: plan as "growth" | "enterprise",
          status: "active",
          stripe_subscription_id:
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription?.id || null,
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const subData = event.data.object as unknown as { metadata?: { companyId?: string }; status?: string; current_period_end?: number };
      if (subData.metadata?.companyId) {
        upsertSubscription(subData.metadata.companyId, {
          status: subData.status || "active",
          current_period_end: subData.current_period_end
            ? new Date(subData.current_period_end * 1000).toISOString()
            : null,
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subData = event.data.object as unknown as { metadata?: { companyId?: string } };
      const companyId = subData.metadata?.companyId;
      if (companyId) {
        upsertSubscription(companyId, {
          plan: "free",
          status: "cancelled",
          stripe_subscription_id: null,
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
