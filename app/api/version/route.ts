import { success } from "@/lib/api-utils";
import { deploymentIdentity } from "@/lib/services/health.service";

export const dynamic = "force-dynamic";
export function GET() {
  const response = success(deploymentIdentity());
  response.headers.set("Cache-Control", "no-store");
  return response;
}
