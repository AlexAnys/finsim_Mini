import { NextRequest, NextResponse } from "next/server";
import { isStudentSelfRegistrationEnabled } from "@/lib/auth/secret";
import { listRegistrationClasses } from "@/lib/services/class.service";
import { parseListTake } from "@/lib/pagination";

export async function GET(request: NextRequest) {
  if (!isStudentSelfRegistrationEnabled()) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "REGISTRATION_CLOSED",
          message: "学生自助注册暂未开放",
        },
      },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const classes = await listRegistrationClasses({
      take: parseListTake(searchParams, 100, 200),
    });

    return NextResponse.json({ success: true, data: classes });
  } catch (error) {
    console.error("获取班级列表失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "获取班级列表失败" },
      },
      { status: 500 }
    );
  }
}
