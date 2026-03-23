import { Resend } from 'resend';

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export async function sendTeamInviteEmail(params: {
  to: string;
  inviterName: string;
  companyName: string;
  role: string;
  inviteUrl: string;
}) {
  const resend = getResend();
  if (!resend) {
    console.log('[email] RESEND_API_KEY not set — skipping email delivery');
    return { sent: false, reason: 'no_api_key' };
  }

  try {
    await resend.emails.send({
      from: 'The Autonomous <noreply@theautonomous.org>',
      to: params.to,
      subject: `You've been invited to join ${params.companyName} on The Autonomous`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>You're invited!</h2>
          <p>${params.inviterName} has invited you to join <strong>${params.companyName}</strong> on The Autonomous as a <strong>${params.role}</strong>.</p>
          <p>The Autonomous gives your company AI agents for every workflow — Sales, Marketing, Accounting, Strategy, and more.</p>
          <a href="${params.inviteUrl}" style="display: inline-block; background: #0A0A0B; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 16px 0;">Accept Invite</a>
          <p style="color: #666; font-size: 12px;">If you didn't expect this invite, you can ignore this email.</p>
        </div>
      `,
    });
    return { sent: true };
  } catch (error) {
    console.error('[email] Failed to send invite:', error);
    return { sent: false, reason: 'send_failed' };
  }
}
