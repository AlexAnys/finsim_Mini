import { writeFile, mkdir, unlink } from "fs/promises";
import { join, extname } from "path";
import { v4 as uuidv4 } from "uuid";

export interface StorageProvider {
  save(file: Buffer, originalName: string, contentType: string): Promise<{ filePath: string; fileSize: number }>;
  delete(filePath: string): Promise<void>;
  getUrl(filePath: string): string;
}

// 本地磁盘存储
class LocalStorageProvider implements StorageProvider {
  private basePath: string;

  constructor() {
    this.basePath = process.env.FILE_STORAGE_PATH || "./public/uploads";
  }

  async save(file: Buffer, originalName: string, contentType: string): Promise<{ filePath: string; fileSize: number }> {
    void contentType;
    const ext = extname(originalName);
    const safeName = `${uuidv4()}${ext}`;
    const dateDir = new Date().toISOString().slice(0, 10);
    const dir = join(this.basePath, dateDir);

    await mkdir(dir, { recursive: true });
    const fullPath = join(dir, safeName);
    await writeFile(fullPath, file);

    return {
      filePath: `${dateDir}/${safeName}`,
      fileSize: file.length,
    };
  }

  async delete(filePath: string): Promise<void> {
    const fullPath = join(this.basePath, filePath);
    await unlink(fullPath).catch(() => {});
  }

  getUrl(filePath: string): string {
    return `/api/files/${filePath}`;
  }
}

// 允许的文件类型
const ALLOWED_TYPES: Record<string, string[]> = {
  image: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  pdf: ["application/pdf"],
  word: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  text: ["text/plain", "text/markdown"],
  zip: ["application/zip", "application/x-zip-compressed"],
  document: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/csv",
    "text/plain",
    "text/markdown",
    "application/zip",
    "application/x-zip-compressed",
    "image/jpeg",
    "image/png",
    "image/webp",
  ],
};

export function validateFile(
  contentType: string,
  fileSize: number,
  allowedTypes: string[]
): { valid: boolean; error?: string; code?: string } {
  const maxSize = 20 * 1024 * 1024; // 20MB
  if (fileSize > maxSize) {
    return { valid: false, error: "文件大小不能超过 20MB" };
  }

  // Phase3-B: 旧版 .doc (OLE2) 单独识别，返回友好提示 + 错误码 LEGACY_DOC_UNSUPPORTED。
  // 不引入 antiword/libreoffice 依赖；用户转 .docx 后即可上传。
  if (contentType === "application/msword") {
    return {
      valid: false,
      error:
        "暂不支持旧版 .doc 格式，请先在 Word/Pages 里另存为 .docx 后再上传（操作步骤：文件 → 另存为 → 选 .docx）",
      code: "LEGACY_DOC_UNSUPPORTED",
    };
  }

  const allowed = allowedTypes.flatMap((t) => ALLOWED_TYPES[t] || []);
  if (allowed.length > 0 && !allowed.includes(contentType)) {
    return { valid: false, error: `不支持的文件类型: ${contentType}` };
  }

  return { valid: true };
}

// 单例
let storageInstance: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (!storageInstance) {
    storageInstance = new LocalStorageProvider();
  }
  return storageInstance;
}
