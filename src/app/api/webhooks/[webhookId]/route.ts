import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import {
  getWebhook,
  createTask,
  incrementWebhookTrigger,
} from "@/lib/db";

function verifySecret(
  payload: string,
  secret: string,
  signatureHeader: string | null
): boolean {
  if (!signatureHeader) return false;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const sig = signatureHeader.replace(/^sha256=/, "");
  if (sig.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ webhookId: string }> }
) {
  try {
    const { webhookId } = await params;

    const webhook = getWebhook(webhookId);
    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    if (!webhook.is_active) {
      return NextResponse.json(
        { error: "Webhook is inactive" },
        { status: 410 }
      );
    }

    const rawBody = await request.text();

    // Validate secret if configured
    if (webhook.secret) {
      const signature = request.headers.get("x-webhook-signature");
      if (!verifySecret(rawBody, webhook.secret, signature)) {
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        );
      }
    }

    // Parse the payload
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    // Build the task title from template
    const title = webhook.task_title_template.replace("{name}", webhook.name);

    // Create a task for the configured agent
    const task = createTask({
      agent_id: webhook.agent_id,
      type: webhook.task_type,
      title,
      input_json: JSON.stringify(payload),
    });

    // Update webhook trigger stats
    incrementWebhookTrigger(webhook.id);

    // Trigger task processing (fire-and-forget)
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      request.nextUrl.origin;
    fetch(`${baseUrl}/api/tasks/process`, { method: "POST" }).catch(() => {
      // Silently ignore — task is queued and will be picked up
    });

    return NextResponse.json({
      received: true,
      taskId: task.id,
    });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
