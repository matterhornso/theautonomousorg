import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getFileUpload } from "@/lib/db";
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
    const upload = getFileUpload(fileId);

    if (!upload) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Path traversal protection
    if (upload.file_path.includes("..") || upload.file_path.includes("/")) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), "data", "uploads");
    const filePath = path.join(uploadDir, upload.file_path);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const ext = upload.file_path.split(".").pop() || "";
    const contentType = MIME_TYPES[ext] || upload.file_type || "application/octet-stream";

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${upload.file_name}"`,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("File serve error:", error);
    return NextResponse.json({ error: "Failed to serve file" }, { status: 500 });
  }
}
