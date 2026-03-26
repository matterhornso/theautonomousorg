import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCompaniesByUser, getCompany, getTeamMembers, createTeamMember, updateTeamMemberRole, removeTeamMember } from "@/lib/db";
import { sendTeamInviteEmail } from "@/lib/email";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = request.nextUrl.searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "companyId required" }, { status: 400 });

  const companies = await getCompaniesByUser(userId);
  if (!companies.find((c) => c.id === companyId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const members = await getTeamMembers(companyId);
  return NextResponse.json(members);
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId, email, phone, role } = (await request.json()) as {
    companyId: string;
    email: string;
    phone?: string;
    role?: string;
  };

  if (!companyId || !email) {
    return NextResponse.json({ error: "companyId and email required" }, { status: 400 });
  }

  const companies = await getCompaniesByUser(userId);
  if (!companies.find((c) => c.id === companyId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const member = await createTeamMember({
    company_id: companyId,
    email,
    phone,
    role: role || "member",
    invited_by: userId,
  });

  // Send invite email (fire-and-forget — don't block the response)
  const company = await getCompany(companyId);
  const inviteUrl = `https://theautonomous.org/sign-up?invite=${member.invite_token}`;
  sendTeamInviteEmail({
    to: email,
    inviterName: "Your teammate",
    companyName: company?.name || "your company",
    role: role || "member",
    inviteUrl,
  }).catch((err) => {
    console.error("[team] Failed to send invite email:", err);
  });

  return NextResponse.json(member);
}

export async function PATCH(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { memberId, role } = (await request.json()) as { memberId: string; role: string };
  await updateTeamMemberRole(memberId, role);
  return NextResponse.json({ updated: true });
}

export async function DELETE(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { memberId } = (await request.json()) as { memberId: string };
  await removeTeamMember(memberId);
  return NextResponse.json({ removed: true });
}
