import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getCompaniesByUser,
  getUserApiKeys,
  getUserApiKey,
  storeUserApiKey,
  deleteUserApiKey,
} from "@/lib/db";

async function ownsCompany(userId: string, companyId: string): Promise<boolean> {
  const companies = await getCompaniesByUser(userId);
  return companies.some((c) => c.id === companyId);
}

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companyId = request.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "companyId required" }, { status: 400 });
  }

  if (!(await ownsCompany(userId, companyId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const keys = await getUserApiKeys(companyId);

  // For each key, fetch the actual encrypted value to show last 4 chars
  const result = await Promise.all(keys.map(async (k) => {
    const rawKey = await getUserApiKey(companyId, k.service_name);
    const masked = rawKey ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" + rawKey.slice(-4) : "";
    return {
      id: k.id,
      service_name: k.service_name,
      display_name: k.display_name,
      is_active: k.is_active,
      last_used_at: k.last_used_at,
      created_at: k.created_at,
      key_hint: masked,
    };
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyId, serviceName, displayName, apiKey, config } =
    (await request.json()) as {
      companyId: string;
      serviceName: string;
      displayName: string;
      apiKey: string;
      config?: Record<string, unknown>;
    };

  if (!companyId || !serviceName || !displayName || !apiKey) {
    return NextResponse.json(
      { error: "companyId, serviceName, displayName, and apiKey are required" },
      { status: 400 }
    );
  }

  if (!(await ownsCompany(userId, companyId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stored = await storeUserApiKey(companyId, serviceName, displayName, apiKey, config);
  return NextResponse.json({
    id: stored.id,
    service_name: stored.service_name,
    display_name: stored.display_name,
    is_active: stored.is_active,
    created_at: stored.created_at,
  });
}

export async function DELETE(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyId, serviceName } = (await request.json()) as {
    companyId: string;
    serviceName: string;
  };

  if (!companyId || !serviceName) {
    return NextResponse.json(
      { error: "companyId and serviceName are required" },
      { status: 400 }
    );
  }

  if (!(await ownsCompany(userId, companyId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await deleteUserApiKey(companyId, serviceName);
  return NextResponse.json({ deleted: true });
}
