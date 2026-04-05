import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(req: NextRequest) {
  const { name, email, subject, message } = await req.json();

  if (!name || !email || !subject || !message) {
    return NextResponse.json(
      { error: "All fields are required" },
      { status: 400 }
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json(
      { error: "Invalid email address" },
      { status: 400 }
    );
  }

  const subjectLabels: Record<string, string> = {
    general: "General inquiry",
    support: "Technical support",
    enterprise: "Enterprise plan",
    partnership: "Partnership",
    press: "Press / media",
    other: "Other",
  };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(
      `[contact] RESEND_API_KEY not set — logging message from ${name} <${email}>: ${subject}`
    );
    return NextResponse.json({ success: true });
  }

  try {
    const resend = new Resend(apiKey);

    // Send to the team
    await resend.emails.send({
      from: "The Autonomous <noreply@theautonomous.org>",
      to: "hello@theautonomous.org",
      replyTo: email,
      subject: `[Contact] ${subjectLabels[subject] || subject} — from ${name}`,
      html: `
        <div style="font-family: 'DM Sans', sans-serif; max-width: 560px; margin: 0 auto;">
          <h2 style="color: #0A0A0B; font-size: 18px; margin-bottom: 16px;">New contact form submission</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr><td style="padding: 8px 0; color: #7D776B; font-size: 14px; width: 80px;">Name</td><td style="padding: 8px 0; color: #0A0A0B; font-size: 14px;">${name}</td></tr>
            <tr><td style="padding: 8px 0; color: #7D776B; font-size: 14px;">Email</td><td style="padding: 8px 0; color: #0A0A0B; font-size: 14px;"><a href="mailto:${email}">${email}</a></td></tr>
            <tr><td style="padding: 8px 0; color: #7D776B; font-size: 14px;">Topic</td><td style="padding: 8px 0; color: #0A0A0B; font-size: 14px;">${subjectLabels[subject] || subject}</td></tr>
          </table>
          <div style="padding: 16px; background: #F0EDE6; border-radius: 8px;">
            <p style="color: #3D3935; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${message}</p>
          </div>
          <p style="color: #A09A8D; font-size: 12px; margin-top: 20px;">Sent from theautonomous.org contact form at ${new Date().toISOString()}</p>
        </div>
      `,
    });

    // Send confirmation to the user
    await resend.emails.send({
      from: "The Autonomous <noreply@theautonomous.org>",
      to: email,
      subject: "We received your message — The Autonomous",
      html: `
        <div style="font-family: 'DM Sans', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 0;">
          <h2 style="color: #0A0A0B; font-size: 20px; margin-bottom: 12px;">Thanks for reaching out, ${name}!</h2>
          <p style="color: #5A554B; font-size: 15px; line-height: 1.6;">
            We've received your message and will get back to you within 24 hours.
          </p>
          <p style="color: #A09A8D; font-size: 12px; margin-top: 24px;">
            The Autonomous — AI agents for every role in your company.
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[contact] Failed to send email:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
