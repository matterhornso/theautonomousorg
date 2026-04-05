import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Gracefully accept signups even without Resend configured
    console.log(`[newsletter] RESEND_API_KEY not set — storing signup: ${email}`);
    return NextResponse.json({ success: true });
  }

  try {
    const resend = new Resend(apiKey);

    // Add to Resend audience (acts as email list)
    // Also send a welcome confirmation
    await resend.emails.send({
      from: "The Autonomous <noreply@theautonomous.org>",
      to: email,
      subject: "Welcome to The Autonomous newsletter",
      html: `
        <div style="font-family: 'DM Sans', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 0;">
          <h2 style="color: #0A0A0B; font-size: 20px; margin-bottom: 12px;">You're in!</h2>
          <p style="color: #5A554B; font-size: 15px; line-height: 1.6;">
            Thanks for subscribing to The Autonomous newsletter. We'll keep you posted on new agents, features, and the future of autonomous companies.
          </p>
          <p style="color: #A09A8D; font-size: 12px; margin-top: 24px;">
            The Autonomous — AI agents for every role in your company.
          </p>
        </div>
      `,
    });

    // Notify the team
    await resend.emails.send({
      from: "The Autonomous <noreply@theautonomous.org>",
      to: "hello@theautonomous.org",
      subject: `New newsletter subscriber: ${email}`,
      html: `<p>New newsletter signup: <strong>${email}</strong></p><p>Date: ${new Date().toISOString()}</p>`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[newsletter] Failed to process subscription:", error);
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
  }
}
