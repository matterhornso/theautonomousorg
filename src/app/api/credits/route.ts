import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getCredits,
  getCreditTransactions,
  addCredits,
  CREDITS_PER_PROMPT,
  SIGNUP_CREDITS,
} from "@/lib/db";

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

// POST: Top up credits (Razorpay integration placeholder)
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { action, amount, paymentId } = (await request.json()) as {
    action: string;
    amount?: number;
    paymentId?: string;
  };

  if (action === "topup") {
    // Razorpay integration placeholder
    // In production: verify paymentId with Razorpay API, then credit
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid credit amount" },
        { status: 400 }
      );
    }

    if (!paymentId) {
      // Return Razorpay checkout configuration
      // This would create an order via Razorpay API
      return NextResponse.json({
        status: "payment_required",
        message: "Razorpay integration coming soon. For now, contact us for credit top-ups.",
        pricing: {
          "500 credits (~10 prompts)": "$5",
          "2000 credits (~40 prompts)": "$15",
          "5000 credits (~100 prompts)": "$30",
          "15000 credits (~300 prompts)": "$75",
        },
        contact: "hello@theautonomous.org",
      });
    }

    // When Razorpay is integrated:
    // 1. Verify payment with Razorpay API
    // 2. If valid, credit the amount
    // const verified = await verifyRazorpayPayment(paymentId);
    // if (!verified) return error

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
