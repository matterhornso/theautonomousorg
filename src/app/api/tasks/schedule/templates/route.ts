import { NextResponse } from "next/server";
import { cronTemplates } from "@/lib/task-templates";

export async function GET() {
  // Return cron templates without the prompt field (that's internal)
  const templates = cronTemplates.map(({ id, role, title, description, cron_expression, cron_human }) => ({
    id,
    role,
    title,
    description,
    cron_expression,
    cron_human,
  }));
  return NextResponse.json(templates);
}
