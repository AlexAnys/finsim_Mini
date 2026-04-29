import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { assertFileReadable } from "@/lib/auth/resource-access";
import { error, handleServiceError } from "@/lib/api-utils";
import { readFile, stat } from "fs/promises";

const DEFAULT_STORAGE_BASE = "./public/uploads";

function getStorageBase() {
  const configured = process.env.FILE_STORAGE_PATH?.trim();
  return (configured || DEFAULT_STORAGE_BASE).replace(/\/+$/, "");
}

function resolveStoragePath(filePath: string) {
  if (
    !filePath ||
    filePath.includes("..") ||
    filePath.startsWith("/") ||
    filePath.includes("\\") ||
    filePath.includes("\0")
  ) {
    return null;
  }

  const storageBase = getStorageBase();
  return `${storageBase}/${filePath}`;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const { path: segments } = await params;
  const filePath = segments.join("/");

  const fullPath = resolveStoragePath(filePath);
  if (!fullPath) {
    return error("INVALID_PATH", "Invalid path", 400);
  }

  try {
    await assertFileReadable(filePath, authResult.session.user);

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
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "FILE_NOT_FOUND") {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      err.code === "ENOENT"
    ) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    return handleServiceError(err);
  }
}
