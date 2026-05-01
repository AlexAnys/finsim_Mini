"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface ToolSetting {
  key: string;
  label: string;
  category: string;
  description: string;
  basePromptPreview: string;
  defaultModel: string;
  model: string;
  thinking: "disabled" | "enabled";
  temperature: number | null;
  systemPromptSuffix: string;
  enableSearch: boolean;
  strictness: string;
  outputStyle: string;
}

interface ModelOption {
  value: string;
  label: string;
  description: string;
}

export default function AiSettingsPage() {
  const [tools, setTools] = useState<ToolSetting[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [searchConfigured, setSearchConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/tool-settings");
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "加载 AI 设置失败");
        return;
      }
      setTools(json.data.tools || []);
      setModels(json.data.modelOptions || []);
      setSearchConfigured(Boolean(json.data.searchProviderConfigured));
    } finally {
      setLoading(false);
    }
  }

  function updateTool(key: string, patch: Partial<ToolSetting>) {
    setTools((current) => current.map((tool) => (tool.key === key ? { ...tool, ...patch } : tool)));
  }

  async function save(tool: ToolSetting) {
    setSavingKey(tool.key);
    try {
      const res = await fetch("/api/ai/tool-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolKey: tool.key,
          model: tool.model,
          thinking: tool.thinking,
          temperature: tool.temperature,
          systemPromptSuffix: tool.systemPromptSuffix,
          enableSearch: tool.enableSearch,
          strictness: tool.strictness,
          outputStyle: tool.outputStyle,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "保存失败");
        return;
      }
      toast.success(`${tool.label} 设置已保存`);
    } finally {
      setSavingKey(null);
    }
  }

  const grouped = tools.reduce<Record<string, ToolSetting[]>>((acc, tool) => {
    acc[tool.category] ||= [];
    acc[tool.category].push(tool);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center text-ink-4">
        <Loader2 className="mr-2 size-4 animate-spin" />
        加载 AI 设置...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold text-brand">AI 设置</p>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.02em] text-ink">平台 AI 能力配置</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-4">
            用教师能理解的方式配置模型、推理强度、搜索开关和工具提示词。环境变量仍是全局兜底。
          </p>
        </div>
        <Badge variant="outline" className={searchConfigured ? "bg-success-soft text-success" : "bg-warn-soft text-warn"}>
          搜索 provider：{searchConfigured ? "已配置" : "未配置"}
        </Badge>
      </div>

      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="space-y-3">
          <div className="text-sm font-semibold text-ink-3">{category}</div>
          <div className="grid gap-4 lg:grid-cols-2">
            {items.map((tool) => (
              <Card key={tool.key} className="border-line bg-surface shadow-fs">
                <CardHeader className="pb-3">
                  <div className="space-y-2">
                    <CardTitle className="flex items-center justify-between gap-3 text-lg">
                      <span className="flex items-center gap-2">
                        <SlidersHorizontal className="size-4 text-brand" />
                        {tool.label}
                      </span>
                      <Badge variant="outline">{tool.model || tool.defaultModel}</Badge>
                    </CardTitle>
                    <p className="text-sm leading-relaxed text-ink-4">{tool.description}</p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>模型</Label>
                      <Select value={tool.model} onValueChange={(value) => updateTool(tool.key, { model: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {models.map((model) => (
                            <SelectItem key={model.value} value={model.value}>
                              {model.label} · {model.value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>输出风格</Label>
                      <Select value={tool.outputStyle} onValueChange={(value) => updateTool(tool.key, { outputStyle: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="structured">结构化</SelectItem>
                          <SelectItem value="lesson-ready">教案可用</SelectItem>
                          <SelectItem value="brief">简洁</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center justify-between rounded-lg border border-line p-3">
                      <div>
                        <div className="text-sm font-medium text-ink-2">增强推理</div>
                        <div className="text-xs text-ink-4">深度任务可开，默认关闭。</div>
                      </div>
                      <Switch
                        checked={tool.thinking === "enabled"}
                        onCheckedChange={(checked) => updateTool(tool.key, { thinking: checked ? "enabled" : "disabled" })}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-line p-3">
                      <div>
                        <div className="text-sm font-medium text-ink-2">搜索增强</div>
                        <div className="text-xs text-ink-4">未配置时不会伪造结果。</div>
                      </div>
                      <Switch
                        checked={tool.enableSearch}
                        onCheckedChange={(checked) => updateTool(tool.key, { enableSearch: checked })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>基础系统提示词</Label>
                    <div className="max-h-44 overflow-y-auto rounded-lg border border-line bg-paper-alt p-3 text-xs leading-6 text-ink-3">
                      <pre className="whitespace-pre-wrap font-sans">{tool.basePromptPreview}</pre>
                    </div>
                    <p className="text-xs text-ink-4">
                      运行时还会叠加课程、任务、学生提交等上下文；下面的补充提示词会追加在基础模板之后。
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>提示词补充</Label>
                    <Textarea
                      value={tool.systemPromptSuffix}
                      onChange={(event) => updateTool(tool.key, { systemPromptSuffix: event.target.value })}
                      placeholder="例如：输出面向中职学生，语言朴素；批改时不确定要标记疑点。"
                      rows={3}
                    />
                  </div>

                  <Button onClick={() => save(tool)} disabled={savingKey === tool.key}>
                    {savingKey === tool.key ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                    保存
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
