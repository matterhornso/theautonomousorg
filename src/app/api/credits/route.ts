import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getCredits,
  getCreditTransactions,
  addCredits,
  CREDITS_PER_PROMPT,
  SIGNUP_CREDITS,
} from "@/lib/db";
import { stripe, isStripeConfigured, CREDIT_PACKS } from "@/lib/stripe";

// GET: Get credit balance and transaction history
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const credits = getCredits(userId);
  const transactions = getCreditTransactions(
    userId,
    Number(request.nextUrl.searchParams.get("limit")) || 20
  );

  const promptsRemaining = Math.floor(credits.balance / CREDITS_PER_PROMPT);

  return NextResponse.json({
    balance: credits.balance,
    totalEarned: credits.total_earned,
    totalSpent: credits.total_spent,
    promptsRemaining,
    creditsPerPrompt: CREDITS_PER_PROMPT,
    signupBonus: SIGNUP_CREDITS,
    creditPacks: CREDIT_PACKS.map((p) => ({
      id: p.id,
      name: p.name,
      credits: p.credits,
      price: `$${(p.price_cents / 100).toFixed(2)}`,
      description: p.description,
    })),
    transactions: transactions.map((t) => ({
      id: t.id,
      amount: t.amount,
      type: t.type,
      description: t.description,
      balanceAfter: t.balance_after,
      createdAt: t.created_at,
    })),
  });
}

// POST: Purchase credits via Stripe or legacy top-up
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    action: string;
    packId?: string;
    companyId?: string;
    amount?: number;
    paymentId?: string;
  };

  // ── Stripe credit purchase flow ──────────────────────────
  if (body.action === "checkout") {
    if (!isStripeConfigured() || !stripe) {
      return NextResponse.json(
        {
          error:
            "Stripe is not configured. Contact hello@theautonomous.org for credit top-ups.",
        },
        { status: 503 }
      );
    }

    const pack = CREDIT_PACKS.find((p) => p.id === body.packId);
    if (!pack) {
      return NextResponse.json(
        {
          error: "Invalid credit pack",
          available: CREDIT_PACKS.map((p) => p.id),
        },
        { status: 400 }
      );
    }

    const companyId = body.companyId;
    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required" },
        { status: 400 }
      );
    }

    const successUrl = `${request.nextUrl.origin}/dashboard/${companyId}?credits=purchased`;
    const cancelUrl = `${request.nextUrl.origin}/dashboard/${companyId}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: pack.price_cents,
            product_data: {
              name: pack.name,
              description: pack.description,
            },
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        type: "credit_purchase",
        userId,
        companyId,
        packId: pack.id,
        credits: String(pack.credits),
      },
    });

    return NextResponse.json({ url: session.url });
  }

  // ── Legacy top-up flow (manual / Razorpay placeholder) ───
  if (body.action === "topup") {
    const { amount, paymentId } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid credit amount" },
        { status: 400 }
      );
    }

    if (!paymentId) {
      return NextResponse.json({
        status: "payment_required",
        message:
          "Use action: 'checkout' with a packId to purchase credits via Stripe.",
        availablePacks: CREDIT_PACKS.map((p) => ({
          id: p.id,
          name: p.name,
          credits: p.credits,
          price: `$${(p.price_cents / 100).toFixed(2)}`,
        })),
        contact: "hello@theautonomous.org",
      });
    }

    // Manual top-up with verified paymentId (admin use)
    const newBalance = addCredits(
      userId,
      amount,
      "topup",
      `Top-up: ${amount} credits (Payment: ${paymentId})`
    );

    return NextResponse.json({
      balance: newBalance,
      credited: amount,
      promptsRemaining: Math.floor(newBalance / CREDITS_PER_PROMPT),
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
