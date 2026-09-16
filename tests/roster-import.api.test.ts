import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
vi.mock("@/lib/auth/guards", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/services/roster-import.service", () => ({ importClassRoster: vi.fn() }));
import { requireRole } from "@/lib/auth/guards";
import { importClassRoster } from "@/lib/services/roster-import.service";
import { POST } from "@/app/api/lms/classes/[id]/import/route";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const context = { params: Promise.resolve({ id: "class-a" }) };
function request(fields: Record<string, string> = { action: "preview" }) {
  const form = new FormData();
  form.set("file", new File(["姓名,邮箱\n甲,a@example.com"], "名单.csv", { type: "text/csv" }));
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return new NextRequest("http://localhost/api/lms/classes/class-a/import", { method: "POST", body: form });
}
beforeEach(() => {
  vi.resetAllMocks();
  mk(requireRole).mockResolvedValue({ error: null, session: { user: { id: "teacher-a", role: "teacher" } } });
  mk(importClassRoster).mockResolvedValue({ summary: { ready: 1 }, rows: [] });
});

describe("POST /api/lms/classes/[id]/import", () => {
  it("returns 200 and passes only authenticated identity and re-read file to the service", async () => {
    const response = await POST(request({ action: "preview", initialPassword: "initial-pass" }), context);
    expect(response.status).toBe(200);
    expect((await response.json()).success).toBe(true);
    expect(importClassRoster).toHaveBeenCalledWith(expect.objectContaining({
      actor: { id: "teacher-a", role: "teacher" }, classId: "class-a", action: "preview", initialPassword: "initial-pass",
      file: { name: "名单.csv", buffer: expect.any(Buffer) },
    }));
  });
  it.each([401, 403])("returns %s before parsing upload when login/role guard rejects", async (status) => {
    mk(requireRole).mockResolvedValue({ session: null, error: NextResponse.json({ success: false }, { status }) });
    const response = await POST(request(), context);
    expect(response.status).toBe(status);
    expect(importClassRoster).not.toHaveBeenCalled();
  });
  it("enforces resource permission supplied by service", async () => {
    mk(importClassRoster).mockRejectedValue(new Error("FORBIDDEN"));
    const response = await POST(request(), context);
    expect(response.status).toBe(403);
  });
  it("requires previewHash on commit and validates action", async () => {
    expect((await POST(request({ action: "commit" }), context)).status).toBe(400);
    expect((await POST(request({ action: "delete" }), context)).status).toBe(400);
    expect(importClassRoster).not.toHaveBeenCalled();
  });
  it("enforces body limit on actual bytes even with no Content-Length", async () => {
    const body = new FormData();
    body.set("file", new File([new Uint8Array(2 * 1024 * 1024 + 100000)], "huge.xlsx"));
    body.set("action", "preview");
    const req = new NextRequest("http://localhost/import", { method: "POST", body });
    expect(req.headers.has("content-length")).toBe(false);
    const response = await POST(req, context);
    expect(response.status).toBe(413);
    expect((await response.json()).error.code).toBe("ROSTER_FILE_TOO_LARGE");
    expect(importClassRoster).not.toHaveBeenCalled();
  });
  it("returns a controlled error for malformed multipart input", async () => {
    const req = new NextRequest("http://localhost/import", {
      method: "POST", headers: { "Content-Type": "multipart/form-data; boundary=missing" }, body: "broken",
    });
    const response = await POST(req, context);
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("ROSTER_FILE_INVALID");
  });
});
