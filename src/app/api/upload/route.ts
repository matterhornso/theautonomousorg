import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createFileUpload } from "@/lib/db";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "text/csv": "csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
};

function ensureUploadDir(): string {
  const uploadDir = path.join(process.cwd(), "data", "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  return uploadDir;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES[file.type]) {
      return NextResponse.json(
        { error: `File type not allowed: ${file.type}. Allowed: images (png, jpg, gif, webp), documents (pdf, csv, xlsx, docx, txt)` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is 10MB.` },
        { status: 400 }
      );
    }

    const uploadDir = ensureUploadDir();
    const fileId = randomUUID();
    const ext = ALLOWED_TYPES[file.type];
    const storedName = `${fileId}.${ext}`;
    const filePath = path.join(uploadDir, storedName);

    // Write file to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    // Save metadata to database
    createFileUpload({
      id: fileId,
      user_id: userId,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      file_path: storedName,
    });

    return NextResponse.json({
      fileId,
      fileName: file.name,
      fileType: file.type,
      fileUrl: `/api/upload/${fileId}`,
      size: file.size,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
