"use client";

import { useMemo, useRef, useState } from "react";
import { BookOpenCheck, FileCheck2, Loader2, SearchCheck, Settings2, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type ToolKey = "lessonPolish" | "ideologyMining" | "questionAnalysis" | "examCheck";

interface AiResult {
  title: string;
  summary: string;
  sections: Array<{ heading: string; diagnosis: string; suggestions: string[]; examples: string[] }>;
  actionItems: string[];
  cautions: string[];
  gradingTable: Array<{ student: string; question: string; score: string; feedback: string; uncertainty: string }>;
  fallback?: boolean;
  fileReports?: Array<{ fileName: string; status: string; error?: string; textLength: number }>;
  searchStatus?: string;
}

const TOOLS: Array<{
  key: ToolKey;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  placeholder: string;
}> = [
  {
    key: "lessonPolish",
    label: "教案完善",
    desc: "完善目标、活动、评价和课堂话术",
    icon: BookOpenCheck,
    placeholder: "粘贴教案片段，或说明希望完善的课程主题、课时、学生基础...",
  },
  {
    key: "ideologyMining",
    label: "思政挖掘",
    desc: "自然提炼专业课里的育人融合点",
    icon: Sparkles,
    placeholder: "粘贴课堂内容，说明专业方向和希望避免的表达边界...",
  },
  {
    key: "questionAnalysis",
    label: "搜题与解析",
    desc: "识别题型、知识点、步骤和易错点",
    icon: SearchCheck,
    placeholder: "粘贴题目，或上传题目图片/试卷片段...",
  },
  {
    key: "examCheck",
    label: "试卷检查",
    desc: "按答案和评分规则辅助批改试卷",
    icon: FileCheck2,
    placeholder: "粘贴标准答案、评分规则和学生作答说明，也可以上传多个文件...",
  },
];

export default function AIAssistantPage() {
  const [activeTool, setActiveTool] = useState<ToolKey>("lessonPolish");
  const [text, setText] = useState("");
  const [teacherRequest, setTeacherRequest] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [outputStyle, setOutputStyle] = useState("structured");
  const [strictness, setStrictness] = useState("balanced");
  const [enableSearch, setEnableSearch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiResult | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const active = useMemo(() => TOOLS.find((tool) => tool.key === activeTool) ?? TOOLS[0], [activeTool]);
  const Icon = active.icon;

  async function runTool() {
    if (!text.trim() && files.length === 0 && !teacherRequest.trim()) {
      toast.error("请粘贴内容、填写需求或上传文件");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const form = new FormData();
      form.set("toolKey", activeTool);
      form.set("text", text);
      form.set("teacherRequest", teacherRequest);
      form.set("outputStyle", outputStyle);
      form.set("strictness", strictness);
      form.set("enableSearch", String(enableSearch));
      files.forEach((file) => form.append("files", file));

      const res = await fetch("/api/ai/work-assistant", { method: "POST", body: form });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "AI 工具运行失败");
        return;
      }
      setResult(json.data);
      toast.success(json.data.fallback ? "材料已识别，AI 暂不可用" : "AI 分析完成");
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold text-brand">AI 工作助手</p>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.02em] text-ink">教师日常材料处理</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-4">
            上传或粘贴课堂材料，灵析会先识别文本，再生成可供教师审核的参考建议。
          </p>
        </div>
        <Button asChild variant="outline">
          <a href="/teacher/ai-settings">
            <Settings2 className="mr-2 size-4" />
            AI 设置
          </a>
        </Button>
      </div>

      <Tabs value={activeTool} onValueChange={(value) => setActiveTool(value as ToolKey)}>
        <TabsList className="grid h-auto w-full grid-cols-2 gap-2 bg-transparent p-0 lg:grid-cols-4">
          {TOOLS.map((tool) => {
            const ToolIcon = tool.icon;
            return (
              <TabsTrigger
                key={tool.key}
                value={tool.key}
                className="h-auto justify-start gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-left data-[state=active]:border-brand data-[state=active]:bg-brand-soft"
              >
                <ToolIcon className="size-4 shrink-0" />
                <span>
                  <span className="block text-sm font-semibold">{tool.label}</span>
                  <span className="mt-0.5 block text-[11px] font-normal text-ink-4">{tool.desc}</span>
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-line bg-surface shadow-fs">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Icon className="size-5 text-brand" />
              {active.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-dashed border-line bg-paper-alt p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-ink-2">
                    <Upload className="size-4 text-brand" />
                    上传材料
                  </div>
                  <p className="mt-1 text-xs text-ink-4">支持 PDF、DOCX、TXT/MD、ZIP、图片；扫描件需 OCR provider。</p>
                </div>
                <Input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept="application/pdf,.pdf,.docx,text/plain,text/markdown,.txt,.md,.zip,image/png,image/jpeg,image/webp"
                  className="w-full max-w-[360px] bg-surface text-xs"
                  disabled={loading}
                  onChange={(event) => setFiles(Array.from(event.target.files || []))}
                />
              </div>
              {files.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {files.map((file) => (
                    <Badge key={`${file.name}-${file.size}`} variant="outline" className="bg-surface">
                      {file.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>粘贴内容</Label>
              <Textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={active.placeholder}
                rows={8}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label>教师补充要求</Label>
              <Textarea
                value={teacherRequest}
                onChange={(event) => setTeacherRequest(event.target.value)}
                placeholder="例如：面向中职二年级，语言更口语化；试卷按 100 分制；思政点避免生硬口号。"
                rows={3}
                disabled={loading}
              />
            </div>

            <Sheet>
              <SheetTrigger asChild>
                <Button type="button" variant="outline" className="w-full">
                  <Settings2 className="mr-2 size-4" />
                  本次工具设置
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>本次输出设置</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-5">
                  <div className="space-y-2">
                    <Label>输出风格</Label>
                    <Select value={outputStyle} onValueChange={setOutputStyle}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="structured">结构化清单</SelectItem>
                        <SelectItem value="lesson-ready">可直接放进教案</SelectItem>
                        <SelectItem value="brief">简洁摘要</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>严格度</Label>
                    <Select value={strictness} onValueChange={setStrictness}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lenient">宽松</SelectItem>
                        <SelectItem value="balanced">均衡</SelectItem>
                        <SelectItem value="strict">严格</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-line p-3">
                    <div>
                      <div className="text-sm font-medium text-ink-2">请求搜索增强</div>
                      <div className="text-xs text-ink-4">未配置搜索 provider 时不会伪造联网结果。</div>
                    </div>
                    <Switch checked={enableSearch} onCheckedChange={setEnableSearch} />
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <Button onClick={runTool} disabled={loading} className="w-full">
              {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
              开始分析
            </Button>
          </CardContent>
        </Card>

        <Card className="min-h-[620px] border-line bg-surface shadow-fs">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg">分析结果</CardTitle>
              {result?.fallback && <Badge className="bg-warn-soft text-warn">AI fallback</Badge>}
            </div>
          </CardHeader>
          <CardContent>
            {!result ? (
              <div className="flex min-h-[480px] flex-col items-center justify-center rounded-lg border border-line bg-paper-alt text-center text-ink-4">
                <Sparkles className="mb-3 size-9 text-brand" />
                <p className="text-sm font-medium text-ink-3">选择工具并输入材料后开始分析</p>
                <p className="mt-1 text-xs">结果会按教师可审核的结构展示。</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-ink">{result.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-ink-3">{result.summary}</p>
                </div>

                {result.fileReports && result.fileReports.length > 0 && (
                  <div className="rounded-lg border border-line bg-paper-alt p-3">
                    <div className="text-xs font-semibold text-ink-2">文件识别</div>
                    <div className="mt-2 grid gap-1.5">
                      {result.fileReports.map((file) => (
                        <div key={file.fileName} className="flex items-center justify-between gap-3 text-xs">
                          <span className="truncate text-ink-3">{file.fileName}</span>
                          <span className={file.status === "ready" ? "text-success" : "text-warn"}>
                            {file.status} · {file.textLength} 字
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {result.sections.map((section, index) => (
                    <div key={`${section.heading}-${index}`} className="rounded-lg border border-line bg-paper p-4">
                      <h3 className="font-semibold text-ink">{section.heading}</h3>
                      {section.diagnosis && <p className="mt-2 text-sm leading-relaxed text-ink-3">{section.diagnosis}</p>}
                      {section.suggestions.length > 0 && (
                        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-3">
                          {section.suggestions.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                      )}
                      {section.examples.length > 0 && (
                        <div className="mt-3 rounded-md bg-surface px-3 py-2 text-sm text-ink-3">
                          {section.examples.map((item) => <p key={item}>{item}</p>)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {result.gradingTable.length > 0 && (
                  <div className="overflow-hidden rounded-lg border border-line">
                    <table className="w-full text-sm">
                      <thead className="bg-paper-alt text-left text-ink-4">
                        <tr>
                          <th className="px-3 py-2">学生</th>
                          <th className="px-3 py-2">题号</th>
                          <th className="px-3 py-2">得分</th>
                          <th className="px-3 py-2">反馈</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.gradingTable.map((row, index) => (
                          <tr key={index} className="border-t border-line">
                            <td className="px-3 py-2">{row.student || "-"}</td>
                            <td className="px-3 py-2">{row.question || "-"}</td>
                            <td className="px-3 py-2">{row.score || "-"}</td>
                            <td className="px-3 py-2">{row.feedback || row.uncertainty || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {result.actionItems.length > 0 && (
                  <div className="rounded-lg border border-line bg-success-soft/40 p-3">
                    <div className="text-xs font-semibold text-success">下一步动作</div>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-3">
                      {result.actionItems.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
