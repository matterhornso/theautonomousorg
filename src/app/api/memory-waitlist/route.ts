import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(req: NextRequest) {
  const { email, role, company } = await req.json();

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json(
      { error: "Invalid email address" },
      { status: 400 }
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(
      `[memory-waitlist] RESEND_API_KEY not set — storing signup: ${email} ${role ?? ""} ${company ?? ""}`
    );
    return NextResponse.json({ success: true });
  }

  try {
    const resend = new Resend(apiKey);

    await resend.emails.send({
      from: "Autonomous Memory <noreply@theautonomous.org>",
      to: email,
      subject: "You're on the Autonomous Memory waitlist",
      html: `
        <div style="font-family: 'DM Sans', sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 0;">
          <h2 style="color: #0A0A0B; font-size: 22px; margin-bottom: 16px; font-family: 'Instrument Serif', serif;">You're on the list.</h2>
          <p style="color: #5A554B; font-size: 15px; line-height: 1.65;">
            Thanks for joining the Autonomous Memory waitlist. We're letting executives in weekly as we harden the product.
          </p>
          <p style="color: #5A554B; font-size: 15px; line-height: 1.65; margin-top: 16px;">
            If you run sales, customer success, or investor relations and live in back-to-back meetings, reply to this email and tell us what you'd want memory to do for you. We read every reply.
          </p>
          <p style="color: #5A554B; font-size: 15px; line-height: 1.65; margin-top: 16px;">
            — The Autonomous team
          </p>
          <p style="color: #A09A8D; font-size: 12px; margin-top: 32px;">
            Autonomous Memory — never forget a conversation.
          </p>
        </div>
      `,
    });

    await resend.emails.send({
      from: "The Autonomous <noreply@theautonomous.org>",
      to: "hello@theautonomous.org",
      subject: `Memory waitlist: ${email}`,
      html: `
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Role:</strong> ${role ?? "(not provided)"}</p>
        <p><strong>Company:</strong> ${company ?? "(not provided)"}</p>
        <p><strong>Date:</strong> ${new Date().toISOString()}</p>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[memory-waitlist] Failed to process signup:", error);
    return NextResponse.json(
      { error: "Failed to join waitlist" },
      { status: 500 }
    );
  }
}
