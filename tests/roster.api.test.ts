import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { forbidden, unauthorized } from "@/lib/api-utils";

vi.mock("@/lib/auth/guards", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/services/roster.service", () => ({ manageClassRoster: vi.fn() }));
import { requireRole } from "@/lib/auth/guards";
import { manageClassRoster } from "@/lib/services/roster.service";
import { POST } from "@/app/api/lms/classes/[id]/roster/route";

const params = { params: Promise.resolve({ id: "from" }) };
const input = { mode: "transfer", studentIds: ["s1"], targetClassId: "to", preview: true };
const request = (body: unknown = input) => new NextRequest("http://localhost/api/lms/classes/from/roster", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireRole).mockResolvedValue({ session: { user: { id: "teacher", role: "teacher" } } } as never);
  vi.mocked(manageClassRoster).mockResolvedValue({ preview: true, canApply: true, changeCount: 1, previewToken: "token" } as never);
});

describe("POST class roster", () => {
  it("returns a preview with a confirmation token", async () => {
    const response = await POST(request(), params);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, data: { previewToken: "token", changeCount: 1 } });
    expect(manageClassRoster).toHaveBeenCalledWith("from", { id: "teacher", role: "teacher" }, { ...input, groupMode: "add" });
  });
  it("rejects anonymous callers with 401 without calling the service", async () => {
    vi.mocked(requireRole).mockResolvedValue({ error: unauthorized() } as never);
    expect((await POST(request(), params)).status).toBe(401);
    expect(manageClassRoster).not.toHaveBeenCalled();
  });
  it("rejects student callers with 403", async () => {
    vi.mocked(requireRole).mockResolvedValue({ error: forbidden() } as never);
    expect((await POST(request(), params)).status).toBe(403);
    expect(requireRole).toHaveBeenCalledWith(["teacher", "admin"]);
  });
  it("rejects teachers without management rights to the source or destination", async () => {
    vi.mocked(manageClassRoster).mockRejectedValue(new Error("FORBIDDEN"));
    expect((await POST(request(), params)).status).toBe(403);
  });
  it("requires a preview before confirmation and rejects oversized batches", async () => {
    expect((await POST(request({ ...input, preview: false }), params)).status).toBe(400);
    expect((await POST(request({ ...input, studentIds: Array(201).fill("s") }), params)).status).toBe(400);
    expect(manageClassRoster).not.toHaveBeenCalled();
  });
  it("reports a stale confirmation as 409 rather than a completed batch", async () => {
    vi.mocked(manageClassRoster).mockRejectedValue(new Error("ROSTER_PREVIEW_STALE"));
    const response = await POST(request(), params);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ success: false, error: { code: "ROSTER_PREVIEW_STALE" } });
  });
  it("reports unfinished quiz blockers as 409 rather than a completed batch", async () => {
    vi.mocked(manageClassRoster).mockRejectedValue(new Error("ROSTER_BLOCKED"));
    expect((await POST(request(), params)).status).toBe(409);
  });
  it("reports malformed JSON as a validation error", async () => {
    const invalid = new NextRequest("http://localhost/api/lms/classes/from/roster", { method: "POST", body: "{" });
    expect((await POST(invalid, params)).status).toBe(400);
  });
});
