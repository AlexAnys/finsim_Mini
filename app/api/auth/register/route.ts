import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { registerSchema } from "@/lib/validators/auth.schema";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Zod 校验
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: firstError?.message ?? "输入数据校验失败",
          },
        },
        { status: 400 }
      );
    }

    const { email, password, name, role, classId, adminKey } = parsed.data;

    // 规范化邮箱：小写 + 去空格
    const normalizedEmail = email.toLowerCase().trim();

    // 教师注册验证 adminKey
    if (role === "teacher") {
      if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "INVALID_ADMIN_KEY",
              message: "教师注册密钥无效",
            },
          },
          { status: 403 }
        );
      }
    }

    // 学生注册必须提供 classId
    if (role === "student") {
      if (!classId) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "CLASS_REQUIRED",
              message: "学生注册必须选择班级",
            },
          },
          { status: 400 }
        );
      }

      // 验证 classId 存在
      const classExists = await prisma.class.findUnique({
        where: { id: classId },
      });
      if (!classExists) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "CLASS_NOT_FOUND",
              message: "所选班级不存在",
            },
          },
          { status: 400 }
        );
      }
    }

    // 检查邮箱唯一性
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "EMAIL_EXISTS",
            message: "该邮箱已被注册",
          },
        },
        { status: 409 }
      );
    }

    // bcrypt 12 轮哈希密码
    const passwordHash = await hash(password, 12);

    // 创建用户
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: name.trim(),
        role,
        classId: role === "student" ? classId : null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        classId: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: { user },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("注册失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "服务器内部错误，请稍后重试",
        },
      },
      { status: 500 }
    );
  }
}
