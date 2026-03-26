import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCompaniesByUser } from "@/lib/db";
import { generateDebrief } from "@/lib/debrief";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId } = (await request.json()) as { companyId: string };
  if (!companyId) return NextResponse.json({ error: "companyId required" }, { status: 400 });

  const companies = await getCompaniesByUser(userId);
  if (!companies.find((c) => c.id === companyId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const debrief = await generateDebrief(companyId, userId);
  return NextResponse.json(debrief);
}
