import { Suspense } from "react";
import { AnalyticsV2Dashboard } from "@/components/analytics-v2/analytics-v2-dashboard";

export default function TeacherAnalyticsV2Page() {
  return (
    <Suspense fallback={null}>
      <AnalyticsV2Dashboard />
    </Suspense>
  );
}
