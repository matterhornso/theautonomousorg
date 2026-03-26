import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getCompaniesByUser,
  createApiKey as createApiKeyRecord,
  getApiKeysByCompany,
  deleteApiKey,
} from "@/lib/db";
import { generateApiKey } from "@/lib/api-keys";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companyId = request.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "companyId required" }, { status: 400 });
  }

  const companies = await getCompaniesByUser(userId);
  if (!companies.find((c) => c.id === companyId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const keys = await getApiKeysByCompany(companyId);
  return NextResponse.json(
    keys.map((k) => ({
      id: k.id,
      name: k.name,
      key_prefix: "ta_live_......" + k.key_hash.slice(-6),
      last_used_at: k.last_used_at,
      created_at: k.created_at,
    }))
  );
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyId, name } = (await request.json()) as {
    companyId: string;
    name: string;
  };

  const companies = await getCompaniesByUser(userId);
  if (!companies.find((c) => c.id === companyId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { key, hash } = generateApiKey();
  await createApiKeyRecord(companyId, hash, name || "Default");

  // Return the key ONCE — it can't be retrieved again
  return NextResponse.json({
    key,
    name: name || "Default",
    message: "Save this key — it won't be shown again.",
  });
}

export async function DELETE(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { keyId, companyId } = (await request.json()) as {
    keyId: string;
    companyId: string;
  };

  const companies = await getCompaniesByUser(userId);
  if (!companies.find((c) => c.id === companyId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await deleteApiKey(keyId);
  return NextResponse.json({ deleted: true });
}
