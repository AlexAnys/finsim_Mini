import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { success, validationError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  const result = await requireAuth();
  if (result.error) return result.error;

  const formData = await request.formData();
  const audio = formData.get("audio") as File | null;
  if (!audio) return validationError("缺少音频文件");

  return success({
    text: "",
    provider: "not_configured",
    message:
      "当前后端未配置可用的语音识别 provider。请使用浏览器语音识别或手动输入；配置 MiMo/Qwen STT 后此接口会返回转写文本。",
  });
}
