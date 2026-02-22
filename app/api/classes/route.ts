import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const classes = await prisma.class.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        academicYear: true,
      },
      orderBy: { name: "asc" },
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
