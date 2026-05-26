import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

// PR-A 老师建班：createClass service。mock prisma.class.create。
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    class: { create: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";
import { createClass } from "@/lib/services/class.service";
import { handleServiceError } from "@/lib/api-utils";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

describe("createClass", () => {
  beforeEach(() => vi.clearAllMocks());

  it("happy path：trim 名称 + 学年，落库并回传含 _count", async () => {
    mk(prisma.class.create).mockResolvedValue({
      id: "cls-1",
      name: "金融 1 班",
      academicYear: "2024-2025",
      _count: { students: 0 },
    });

    const result = await createClass({
      name: "  金融 1 班  ",
      academicYear: "  2024-2025  ",
      createdBy: "teacher-1",
    });

    const arg = mk(prisma.class.create).mock.calls[0][0];
    expect(arg.data).toMatchObject({
      name: "金融 1 班",
      academicYear: "2024-2025",
      createdBy: "teacher-1",
    });
    expect(result.id).toBe("cls-1");
  });

  it("学年为空 / 空白 → 存 null（选填）", async () => {
    mk(prisma.class.create).mockResolvedValue({ id: "cls-2", _count: { students: 0 } });

    await createClass({ name: "会计 2 班", academicYear: "   ", createdBy: "t-1" });
    expect(mk(prisma.class.create).mock.calls[0][0].data.academicYear).toBeNull();

    await createClass({ name: "会计 3 班", createdBy: "t-1" });
    expect(mk(prisma.class.create).mock.calls[1][0].data.academicYear).toBeNull();
  });

  it("重名（Prisma P2002）→ 抛 CLASS_NAME_EXISTS，不裸抛 P2002", async () => {
    mk(prisma.class.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "x",
      }),
    );

    await expect(
      createClass({ name: "已存在的班", createdBy: "t-1" }),
    ).rejects.toThrow("CLASS_NAME_EXISTS");
  });

  it("非 P2002 错误原样上抛（不吞）", async () => {
    mk(prisma.class.create).mockRejectedValue(new Error("DB_DOWN"));
    await expect(
      createClass({ name: "x", createdBy: "t-1" }),
    ).rejects.toThrow("DB_DOWN");
  });
});

describe("handleServiceError — CLASS_NAME_EXISTS 映射", () => {
  it("CLASS_NAME_EXISTS → 409 中文，不是裸 500", async () => {
    const res = handleServiceError(new Error("CLASS_NAME_EXISTS"));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("CLASS_NAME_EXISTS");
    expect(body.error.message).toContain("班级名称已存在");
    expect(/[一-鿿]/.test(body.error.message)).toBe(true);
  });
});
