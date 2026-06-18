import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getFileUpload } from "@/lib/db";
import { assertCompanyOwnership } from "@/lib/auth-helpers";
import path from "path";
import fs from "fs";

const MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
  csv: "text/csv",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  wav: "audio/wav",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fileId } = await params;
    const upload = await getFileUpload(fileId);

    if (!upload) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Ownership check (IDOR guard): the file must belong to the caller directly
    // or via a company they own/are a member of. Return 404 (not 403) so we
    // don't confirm the existence of another tenant's file id.
    const ownsDirectly = !!upload.user_id && upload.user_id === userId;
    if (!ownsDirectly) {
      const ownership = upload.company_id
        ? await assertCompanyOwnership(userId, upload.company_id)
        : null;
      if (!ownership || !ownership.ok) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }
    }

    // Path traversal protection
    if (upload.file_path.includes("..")) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }

    // Resolve the file: could be flat (legacy) or per-company structured
    const uploadDir = path.join(process.cwd(), "data", "uploads");
    const filePath = path.join(uploadDir, upload.file_path);

    // Ensure resolved path is still within uploads directory
    const resolved = path.resolve(filePath);
    const uploadsResolved = path.resolve(uploadDir);
    if (!resolved.startsWith(uploadsResolved)) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const ext = upload.file_path.split(".").pop() || "";
    const contentType = MIME_TYPES[ext] || upload.file_type || "application/octet-stream";

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${upload.file_name.replace(/[^\w\s.-]/g, '_').replace(/\s+/g, '_')}"`,
        // Private tenant content — never cache in shared/CDN caches.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("File serve error:", error);
    return NextResponse.json({ error: "Failed to serve file" }, { status: 500 });
  }
}
