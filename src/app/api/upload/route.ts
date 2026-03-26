import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createFileUpload, getCompany } from "@/lib/db";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB for non-video
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB for video

const ALLOWED_TYPES: Record<string, { ext: string; category: string }> = {
  // Documents
  "application/pdf": { ext: "pdf", category: "documents" },
  "text/csv": { ext: "csv", category: "documents" },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { ext: "xlsx", category: "documents" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { ext: "docx", category: "documents" },
  "text/plain": { ext: "txt", category: "documents" },
  // Images
  "image/png": { ext: "png", category: "images" },
  "image/jpeg": { ext: "jpg", category: "images" },
  "image/gif": { ext: "gif", category: "images" },
  "image/webp": { ext: "webp", category: "images" },
  // Media
  "video/mp4": { ext: "mp4", category: "media" },
  "video/webm": { ext: "webm", category: "media" },
  "video/quicktime": { ext: "mov", category: "media" },
  "audio/mpeg": { ext: "mp3", category: "media" },
  "audio/wav": { ext: "wav", category: "media" },
};

function isVideoType(mimeType: string): boolean {
  return mimeType.startsWith("video/");
}

function ensureUploadDir(companyId?: string, category?: string): string {
  const parts = [process.cwd(), "data", "uploads"];
  if (companyId) {
    parts.push(companyId);
    if (category) {
      parts.push(category);
    }
  }
  const uploadDir = path.join(...parts);
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
    const companyId = formData.get("companyId") as string | null;
    const agentId = formData.get("agentId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const typeInfo = ALLOWED_TYPES[file.type];
    if (!typeInfo) {
      return NextResponse.json(
        { error: `File type not allowed: ${file.type}. Allowed: images (png, jpg, gif, webp), documents (pdf, csv, xlsx, docx, txt), media (mp4, webm, mov, mp3, wav)` },
        { status: 400 }
      );
    }

    // Validate file size
    const maxSize = isVideoType(file.type) ? MAX_VIDEO_SIZE : MAX_FILE_SIZE;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${isVideoType(file.type) ? "50MB" : "10MB"}.` },
        { status: 400 }
      );
    }

    // Validate company ownership if companyId provided
    if (companyId) {
      const company = await getCompany(companyId);
      if (!company) {
        return NextResponse.json({ error: "Company not found" }, { status: 404 });
      }
      if (company.user_id && company.user_id !== userId) {
        return NextResponse.json({ error: "Not authorized for this company" }, { status: 403 });
      }
    }

    const { ext, category } = typeInfo;
    const fileId = randomUUID();
    const storedName = `${fileId}.${ext}`;

    // Build the storage path: data/uploads/{companyId}/{category}/
    let storedRelativePath: string;
    if (companyId) {
      const uploadDir = ensureUploadDir(companyId, category);
      const filePath = path.join(uploadDir, storedName);
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(filePath, buffer);
      storedRelativePath = `${companyId}/${category}/${storedName}`;
    } else {
      const uploadDir = ensureUploadDir();
      const filePath = path.join(uploadDir, storedName);
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(filePath, buffer);
      storedRelativePath = storedName;
    }

    // Save metadata to database
    await createFileUpload({
      id: fileId,
      user_id: userId,
      company_id: companyId ?? undefined,
      agent_id: agentId ?? undefined,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      file_path: storedRelativePath,
      category,
    });

    return NextResponse.json({
      fileId,
      fileName: file.name,
      fileType: file.type,
      fileUrl: `/api/upload/${fileId}`,
      size: file.size,
      category,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
