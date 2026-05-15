import { describe, it, expect } from "vitest";
import { updateTaskInstanceSchema } from "@/lib/validators/task.schema";

// Unit A2 — 验证 PATCH /api/lms/task-instances/[id] body { title } 的校验路径
// 这是 EditableTitle 提交时实际打到 Zod 的契约。
describe("updateTaskInstanceSchema · title PATCH (Unit A2)", () => {
  it("accepts a valid title-only patch", () => {
    const r = updateTaskInstanceSchema.safeParse({ title: "新标题" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.title).toBe("新标题");
    }
  });

  it("rejects empty title", () => {
    const r = updateTaskInstanceSchema.safeParse({ title: "" });
    expect(r.success).toBe(false);
  });

  it("accepts title at max length (200 chars)", () => {
    const r = updateTaskInstanceSchema.safeParse({ title: "x".repeat(200) });
    expect(r.success).toBe(true);
  });

  it("rejects title beyond 200 chars", () => {
    const r = updateTaskInstanceSchema.safeParse({ title: "x".repeat(201) });
    expect(r.success).toBe(false);
  });

  it("accepts Chinese title (multi-byte)", () => {
    const r = updateTaskInstanceSchema.safeParse({
      title: "第三章 · 复利计算与现金流",
    });
    expect(r.success).toBe(true);
  });

  it("rejects non-string title", () => {
    const r = updateTaskInstanceSchema.safeParse({ title: 123 });
    expect(r.success).toBe(false);
  });

  it("accepts empty body (title is optional in schema)", () => {
    const r = updateTaskInstanceSchema.safeParse({});
    expect(r.success).toBe(true);
  });
});
