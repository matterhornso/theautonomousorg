import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { stripe, STRIPE_PRICES, isStripeConfigured } from "@/lib/stripe";
import {
  getCompaniesByUser,
  getSubscription,
  upsertSubscription,
} from "@/lib/db";

export async function POST(request: NextRequest) {
  if (!isStripeConfigured() || !stripe) {
    return NextResponse.json(
      {
        error:
          "Billing is not configured yet. Contact us for enterprise pricing.",
      },
      { status: 503 }
    );
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { plan, companyId } = (await request.json()) as {
    plan: string;
    companyId: string;
  };

  const companies = getCompaniesByUser(userId);
  const company = companies.find((c) => c.id === companyId);
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const priceId =
    plan === "growth"
      ? STRIPE_PRICES.growth_monthly
      : plan === "enterprise"
        ? STRIPE_PRICES.enterprise_monthly
        : null;

  if (!priceId) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  // Get or create Stripe customer
  const sub = getSubscription(companyId);
  let customerId = sub?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      metadata: { companyId, userId, companyName: company.name },
    });
    customerId = customer.id;
    upsertSubscription(companyId, {
      stripe_customer_id: customerId,
      plan: "free",
    });
  }

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${request.nextUrl.origin}/dashboard/${companyId}?billing=success`,
    cancel_url: `${request.nextUrl.origin}/dashboard/${companyId}?billing=cancelled`,
    metadata: { companyId, plan },
  });

  return NextResponse.json({ url: session.url });
}
