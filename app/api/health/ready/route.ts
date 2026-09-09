import { NextResponse } from "next/server";
import { checkReadiness } from "@/lib/services/health.service";

export const dynamic = "force-dynamic";
export async function GET() {
  const data = await checkReadiness();
  return NextResponse.json({ success: data.ready, data,
    ...(!data.ready && { error: { code: "SERVICE_NOT_READY", message: "服务尚未就绪" } }),
  }, {
    status: data.ready ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
