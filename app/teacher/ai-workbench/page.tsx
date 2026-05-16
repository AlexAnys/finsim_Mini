"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Activity, Settings2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsageTab } from "@/components/ai-workbench/usage-tab";
import { SettingsTab } from "@/components/ai-workbench/settings-tab";

type WorkbenchTab = "usage" | "settings";

const DEFAULT_TAB: WorkbenchTab = "usage";

function isWorkbenchTab(value: string | null): value is WorkbenchTab {
  return value === "usage" || value === "settings";
}

function AiWorkbenchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState<WorkbenchTab>(
    isWorkbenchTab(initialTab) ? initialTab : DEFAULT_TAB,
  );

  // 同步 URL → state（后退/外链场景）
  useEffect(() => {
    const next = searchParams.get("tab");
    if (isWorkbenchTab(next) && next !== tab) setTab(next);
    if (!next && tab !== DEFAULT_TAB) setTab(DEFAULT_TAB);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleTabChange = useCallback(
    (value: string) => {
      if (!isWorkbenchTab(value)) return;
      setTab(value);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", value);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <div className="mx-auto max-w-[1280px] space-y-5 px-4 pb-10 pt-2 lg:px-6">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-ink">AI 工作台</h1>
        <p className="mt-1 text-[13px] text-ink-4">
          一个入口管理 AI 用量与平台 AI 设置；切换 Tab 不影响后台调用。
        </p>
      </div>

      <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
        <TabsList>
          <TabsTrigger value="usage" data-tab="usage">
            <Activity className="mr-1.5 size-3.5" />
            用量
          </TabsTrigger>
          <TabsTrigger value="settings" data-tab="settings">
            <Settings2 className="mr-1.5 size-3.5" />
            设置
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usage" className="mt-5">
          <UsageTab />
        </TabsContent>
        <TabsContent value="settings" className="mt-5">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function AiWorkbenchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[360px] items-center justify-center text-ink-4">
          加载中...
        </div>
      }
    >
      <AiWorkbenchContent />
    </Suspense>
  );
}
