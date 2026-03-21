import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { getCompaniesByUser, getSubscription } from "@/lib/db";

export async function POST(request: NextRequest) {
  if (!isStripeConfigured() || !stripe) {
    return NextResponse.json(
      { error: "Billing is not configured" },
      { status: 503 }
    );
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyId } = (await request.json()) as { companyId: string };

  const companies = getCompaniesByUser(userId);
  const company = companies.find((c) => c.id === companyId);
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const sub = getSubscription(companyId);
  if (!sub?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No billing account found" },
      { status: 404 }
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${request.nextUrl.origin}/dashboard/${companyId}`,
  });

  return NextResponse.json({ url: session.url });
}
