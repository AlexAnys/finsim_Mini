import { afterEach, describe, expect, it, vi } from "vitest";
import { loadRosterList } from "@/components/teacher-roster/load-list";
import { managedClassWhere } from "@/lib/auth/class-scope";

afterEach(() => vi.unstubAllGlobals());
describe("roster lists", () => {
  it("loads the final student beyond the old 100/200 row limits", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ success: true, data: Array.from({ length: 200 }, (_, id) => ({ id })) }))
      .mockResolvedValueOnce(Response.json({ success: true, data: [{ id: 200 }] }));
    vi.stubGlobal("fetch", fetch);
    expect(await loadRosterList("/api/lms/classes/class/members")).toHaveLength(201);
    expect(fetch).toHaveBeenLastCalledWith("/api/lms/classes/class/members?take=200&page=2");
  });
  it("rejects an incomplete list when any page fails instead of silently selecting only some students", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json({ success: true, data: Array(200).fill({ id: 1 }) }))
      .mockResolvedValueOnce(Response.json({ success: false, error: { message: "权限不足" } }, { status: 403 })));
    await expect(loadRosterList("/api/groups")).rejects.toThrow("权限不足");
  });
  it("limits class and group discovery to class creators and teaching relationships", () => {
    const scope = managedClassWhere({ id: "teacher", role: "teacher" });
    expect(scope).toEqual({ OR: [
      { createdBy: "teacher" },
      { courses: { some: { OR: [{ createdBy: "teacher" }, { teachers: { some: { teacherId: "teacher" } } }] } } },
      { courseClasses: { some: { course: { OR: [{ createdBy: "teacher" }, { teachers: { some: { teacherId: "teacher" } } }] } } } },
    ] });
    expect(managedClassWhere({ id: "admin", role: "admin" })).toEqual({});
    expect(() => managedClassWhere({ id: "student", role: "student" })).toThrow("FORBIDDEN");
  });
});
