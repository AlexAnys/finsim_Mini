import { describe, it, expect } from "vitest";
import { routeToSourcePath, extractRouteIds } from "@/lib/feedback/context";

describe("routeToSourcePath", () => {
  it("学生静态路由 → (student) group 文件", () => {
    expect(routeToSourcePath("/dashboard")).toBe("app/(student)/dashboard/page.tsx");
    expect(routeToSourcePath("/grades")).toBe("app/(student)/grades/page.tsx");
    expect(routeToSourcePath("/study-buddy")).toBe("app/(student)/study-buddy/page.tsx");
  });

  it("teacher / admin 路由 → 直接路径段", () => {
    expect(routeToSourcePath("/teacher/dashboard")).toBe("app/teacher/dashboard/page.tsx");
    expect(routeToSourcePath("/teacher/analytics-v2")).toBe("app/teacher/analytics-v2/page.tsx");
    expect(routeToSourcePath("/admin/feedback")).toBe("app/admin/feedback/page.tsx");
  });

  it("auth 路由 → (auth) group", () => {
    expect(routeToSourcePath("/login")).toBe("app/(auth)/login/page.tsx");
    expect(routeToSourcePath("/register")).toBe("app/(auth)/register/page.tsx");
  });

  it("动态路由 → [id] 模板文件", () => {
    expect(routeToSourcePath("/sim/2e700d5e-abc")).toBe("app/(simulation)/sim/[id]/page.tsx");
    expect(routeToSourcePath("/courses/c-123")).toBe("app/(student)/courses/[id]/page.tsx");
    expect(routeToSourcePath("/tasks/t-123")).toBe("app/(student)/tasks/[id]/page.tsx");
    expect(routeToSourcePath("/teacher/courses/c-9")).toBe("app/teacher/courses/[id]/page.tsx");
    expect(routeToSourcePath("/teacher/instances/i-9")).toBe("app/teacher/instances/[id]/page.tsx");
    expect(routeToSourcePath("/teacher/instances/i-9/insights")).toBe("app/teacher/instances/[id]/insights/page.tsx");
    expect(routeToSourcePath("/teacher/tasks/drafts/d-9")).toBe("app/teacher/tasks/drafts/[id]/page.tsx");
    expect(routeToSourcePath("/teacher/tasks/t-9")).toBe("app/teacher/tasks/[id]/page.tsx");
  });

  it("尾斜杠 + query 归一", () => {
    expect(routeToSourcePath("/dashboard/")).toBe("app/(student)/dashboard/page.tsx");
    expect(routeToSourcePath("/teacher/courses/c-1?tab=x")).toBe("app/teacher/courses/[id]/page.tsx");
  });

  it("未知路由 / 空 → undefined（降级）", () => {
    expect(routeToSourcePath("/totally-unknown")).toBeUndefined();
    expect(routeToSourcePath("")).toBeUndefined();
  });

  it("insights 比 instances/[id] 更具体，先匹配", () => {
    // /teacher/instances/i-9/insights 不应被 /teacher/instances/[id] 抢先
    expect(routeToSourcePath("/teacher/instances/i-9/insights")).toContain("insights");
  });
});

describe("extractRouteIds", () => {
  it("sim → taskInstanceId", () => {
    expect(extractRouteIds("/sim/abc-123")).toEqual({ taskInstanceId: "abc-123" });
  });
  it("学生课程 → courseId", () => {
    expect(extractRouteIds("/courses/c-77")).toEqual({ courseId: "c-77" });
  });
  it("教师草稿 → draftId", () => {
    expect(extractRouteIds("/teacher/tasks/drafts/d-5")).toEqual({ draftId: "d-5" });
  });
  it("教师 instance insights → taskInstanceId（忽略 insights 固定段）", () => {
    expect(extractRouteIds("/teacher/instances/i-9/insights")).toEqual({ taskInstanceId: "i-9" });
  });
  it("教师任务 → taskId", () => {
    expect(extractRouteIds("/teacher/tasks/t-9")).toEqual({ taskId: "t-9" });
  });
  it("静态路由无 ID → undefined", () => {
    expect(extractRouteIds("/dashboard")).toBeUndefined();
    expect(extractRouteIds("/teacher/courses")).toBeUndefined();
  });
  it("query / 尾斜杠不影响", () => {
    expect(extractRouteIds("/courses/c-77/?x=1")).toEqual({ courseId: "c-77" });
  });
});
