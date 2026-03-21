import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { getTasksByCompany } from "@/lib/db";

export async function GET(request: NextRequest) {
  const auth = authenticateApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const status = request.nextUrl.searchParams.get("status");

  let tasks = getTasksByCompany(auth.companyId);

  if (status) {
    tasks = tasks.filter((t) => t.status === status);
  }

  return NextResponse.json(
    tasks.map((t) => ({
      id: t.id,
      agent_id: t.agent_id,
      type: t.type,
      title: t.title,
      status: t.status,
      result: t.result_json,
      error: t.error_message,
      created_at: t.created_at,
      completed_at: t.completed_at,
    }))
  );
}
