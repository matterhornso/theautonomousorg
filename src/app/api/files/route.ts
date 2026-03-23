import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getFilesByCompany,
  getFilesByAgent,
  getFileUpload,
  deleteFileUpload,
  getCompany,
  getStorageUsageByCompany,
} from "@/lib/db";
import path from "path";
import fs from "fs";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const agentId = searchParams.get("agentId");

    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }

    // Validate company ownership
    const company = getCompany(companyId);
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }
    if (company.user_id && company.user_id !== userId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    let files;
    if (agentId) {
      files = getFilesByAgent(agentId).filter((f) => f.company_id === companyId);
    } else {
      files = getFilesByCompany(companyId);
    }

    // Group by category
    const grouped: Record<string, typeof files> = {
      documents: [],
      images: [],
      media: [],
      other: [],
    };

    for (const file of files) {
      const cat = file.category || "other";
      if (grouped[cat]) {
        grouped[cat].push(file);
      } else {
        grouped.other.push(file);
      }
    }

    const totalStorage = getStorageUsageByCompany(companyId);

    return NextResponse.json({
      files: grouped,
      totalFiles: files.length,
      totalStorage,
    });
  } catch (error) {
    console.error("Files list error:", error);
    return NextResponse.json({ error: "Failed to list files" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { fileId } = body;

    if (!fileId) {
      return NextResponse.json({ error: "fileId is required" }, { status: 400 });
    }

    const file = getFileUpload(fileId);
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Check ownership: the file must belong to a company the user owns
    if (file.company_id) {
      const company = getCompany(file.company_id);
      if (!company || (company.user_id && company.user_id !== userId)) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
    } else if (file.user_id !== userId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Delete from disk
    const uploadDir = path.join(process.cwd(), "data", "uploads");
    const filePath = path.join(uploadDir, file.file_path);
    const resolved = path.resolve(filePath);
    const uploadsResolved = path.resolve(uploadDir);

    if (resolved.startsWith(uploadsResolved) && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    deleteFileUpload(fileId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("File delete error:", error);
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}
