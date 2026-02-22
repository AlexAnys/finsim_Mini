import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { join } from "path";

const STORAGE_BASE = process.env.FILE_STORAGE_PATH || "./public/uploads";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const filePath = path.join("/");

  // Prevent path traversal
  if (filePath.includes("..") || filePath.startsWith("/")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const fullPath = join(STORAGE_BASE, filePath);

  try {
    const fileStat = await stat(fullPath);
    if (!fileStat.isFile()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const buffer = await readFile(fullPath);
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    const contentTypeMap: Record<string, string> = {
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentTypeMap[ext] || "application/octet-stream",
        "Content-Length": String(buffer.length),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
