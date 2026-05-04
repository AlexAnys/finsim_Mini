import { redirect } from "next/navigation";

export default function LegacyAnalyticsPage() {
  redirect("/teacher/analytics-v2");
}
