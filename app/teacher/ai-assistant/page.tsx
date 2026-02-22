"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Loader2,
  Sparkles,
  FileText,
  HelpCircle,
  CheckCircle2,
  Save,
} from "lucide-react";

// ---------- Types ----------

interface QuizOption {
  id: string;
  text: string;
}

interface QuizQuestion {
  type: "single_choice" | "multiple_choice" | "true_false" | "short_answer";
  prompt: string;
  options?: QuizOption[];
  correctOptionIds?: string[];
  correctAnswer?: string;
  points: number;
  difficulty: number;
  explanation: string;
}

interface QuizDraftResult {
  questions: QuizQuestion[];
}

interface ScoringCriterion {
  name: string;
  description: string;
  maxPoints: number;
}

interface SubjectiveDraftResult {
  taskName: string;
  requirements: string;
  prompt: string;
  referenceAnswer: string;
  scoringCriteria: ScoringCriterion[];
}

const questionTypeLabels: Record<string, string> = {
  single_choice: "单选题",
  multiple_choice: "多选题",
  true_false: "判断题",
  short_answer: "简答题",
};

export default function AIAssistantPage() {
  const router = useRouter();

  // Quiz form state
  const [quizCourseName, setQuizCourseName] = useState("");
  const [quizChapterName, setQuizChapterName] = useState("");
  const [quizPrompt, setQuizPrompt] = useState("");
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizResult, setQuizResult] = useState<QuizDraftResult | null>(null);
  const [quizSaving, setQuizSaving] = useState(false);

  // Subjective form state
  const [subCourseName, setSubCourseName] = useState("");
  const [subChapterName, setSubChapterName] = useState("");
  const [subPrompt, setSubPrompt] = useState("");
  const [subLoading, setSubLoading] = useState(false);
  const [subResult, setSubResult] = useState<SubjectiveDraftResult | null>(
    null
  );
  const [subSaving, setSubSaving] = useState(false);

  // ---------- Quiz generation ----------

  async function handleGenerateQuiz() {
    if (!quizCourseName.trim() || !quizChapterName.trim()) {
      toast.error("请填写课程名称和章节名称");
      return;
    }
    setQuizLoading(true);
    setQuizResult(null);
    try {
      const res = await fetch("/api/ai/task-draft/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseName: quizCourseName.trim(),
          chapterName: quizChapterName.trim(),
          prompt: quizPrompt.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "生成失败");
        return;
      }
      setQuizResult(json.data);
      toast.success("测验题目生成成功");
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setQuizLoading(false);
    }
  }

  async function handleSaveQuiz() {
    if (!quizResult) return;
    setQuizSaving(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskName: `AI生成测验 - ${quizChapterName.trim()}`,
          taskType: "quiz",
          requirements: "AI 自动生成的测验题目",
          quizConfig: {
            mode: "fixed",
            timeLimitMinutes: 30,
            showCorrectAnswer: true,
          },
          quizQuestions: quizResult.questions.map((q, i) => ({
            type: q.type,
            prompt: q.prompt,
            options: q.options,
            correctOptionIds: q.correctOptionIds,
            correctAnswer: q.correctAnswer,
            points: q.points,
            difficulty: q.difficulty,
            explanation: q.explanation,
            order: i,
          })),
          scoringCriteria: [
            {
              name: "答题正确率",
              description: "根据答题正确率评分",
              maxPoints: 100,
              order: 0,
            },
          ],
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "保存失败");
        return;
      }
      toast.success("任务创建成功");
      router.push(`/teacher/tasks/${json.data.id}`);
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setQuizSaving(false);
    }
  }

  // ---------- Subjective generation ----------

  async function handleGenerateSubjective() {
    if (!subCourseName.trim() || !subChapterName.trim()) {
      toast.error("请填写课程名称和章节名称");
      return;
    }
    setSubLoading(true);
    setSubResult(null);
    try {
      const res = await fetch("/api/ai/task-draft/subjective", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseName: subCourseName.trim(),
          chapterName: subChapterName.trim(),
          prompt: subPrompt.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "生成失败");
        return;
      }
      setSubResult(json.data);
      toast.success("主观题生成成功");
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setSubLoading(false);
    }
  }

  async function handleSaveSubjective() {
    if (!subResult) return;
    setSubSaving(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskName: subResult.taskName,
          taskType: "subjective",
          requirements: subResult.requirements,
          subjectiveConfig: {
            prompt: subResult.prompt,
            referenceAnswer: subResult.referenceAnswer,
            allowTextAnswer: true,
            allowedAttachmentTypes: [],
          },
          scoringCriteria: subResult.scoringCriteria.map((c, i) => ({
            name: c.name,
            description: c.description,
            maxPoints: c.maxPoints,
            order: i,
          })),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "保存失败");
        return;
      }
      toast.success("任务创建成功");
      router.push(`/teacher/tasks/${json.data.id}`);
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setSubSaving(false);
    }
  }

  // ---------- Render ----------

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI 工作助手</h1>
        <p className="text-muted-foreground mt-1">
          使用 AI 快速生成测验题目和主观题任务
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quiz generation card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="size-5" />
              AI 生成测验
            </CardTitle>
            <CardDescription>
              输入课程和章节信息，AI 自动生成混合题型测验
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quiz-course">课程名称 *</Label>
              <Input
                id="quiz-course"
                placeholder="例如：金融理财学"
                value={quizCourseName}
                onChange={(e) => setQuizCourseName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quiz-chapter">章节名称 *</Label>
              <Input
                id="quiz-chapter"
                placeholder="例如：第三章 资产配置"
                value={quizChapterName}
                onChange={(e) => setQuizChapterName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quiz-prompt">额外要求</Label>
              <Textarea
                id="quiz-prompt"
                placeholder="对生成内容的额外要求（选填）"
                value={quizPrompt}
                onChange={(e) => setQuizPrompt(e.target.value)}
                rows={3}
              />
            </div>
            <Button
              onClick={handleGenerateQuiz}
              disabled={quizLoading}
              className="w-full"
            >
              {quizLoading ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="size-4 mr-2" />
                  生成
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Subjective generation card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-5" />
              AI 生成主观题
            </CardTitle>
            <CardDescription>
              输入课程和章节信息，AI 自动生成主观题任务
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sub-course">课程名称 *</Label>
              <Input
                id="sub-course"
                placeholder="例如：金融理财学"
                value={subCourseName}
                onChange={(e) => setSubCourseName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub-chapter">章节名称 *</Label>
              <Input
                id="sub-chapter"
                placeholder="例如：第三章 资产配置"
                value={subChapterName}
                onChange={(e) => setSubChapterName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub-prompt">额外要求</Label>
              <Textarea
                id="sub-prompt"
                placeholder="对生成内容的额外要求（选填）"
                value={subPrompt}
                onChange={(e) => setSubPrompt(e.target.value)}
                rows={3}
              />
            </div>
            <Button
              onClick={handleGenerateSubjective}
              disabled={subLoading}
              className="w-full"
            >
              {subLoading ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="size-4 mr-2" />
                  生成
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quiz preview */}
      {quizResult && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-green-600" />
                测验预览
              </CardTitle>
              <Button onClick={handleSaveQuiz} disabled={quizSaving}>
                {quizSaving ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="size-4 mr-2" />
                    保存为任务
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {quizResult.questions.map((q, i) => (
              <div key={i} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">第 {i + 1} 题</span>
                  <Badge variant="secondary">
                    {questionTypeLabels[q.type] || q.type}
                  </Badge>
                  <Badge variant="outline">{q.points} 分</Badge>
                </div>
                <p className="text-sm">{q.prompt}</p>
                {q.options && q.options.length > 0 && (
                  <div className="space-y-1 pl-2">
                    {q.options.map((opt) => {
                      const isCorrect = q.correctOptionIds?.includes(opt.id);
                      return (
                        <div
                          key={opt.id}
                          className={`flex items-center gap-2 text-sm rounded px-2 py-0.5 ${
                            isCorrect
                              ? "bg-green-50 text-green-700 font-medium"
                              : ""
                          }`}
                        >
                          <span className="font-mono w-5">{opt.id}.</span>
                          <span>{opt.text}</span>
                          {isCorrect && (
                            <CheckCircle2 className="size-3.5 ml-auto shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {q.type === "short_answer" && q.correctAnswer && (
                  <div className="text-sm bg-green-50 text-green-700 rounded px-3 py-1.5">
                    <span className="font-medium">参考答案：</span>
                    {q.correctAnswer}
                  </div>
                )}
                {q.explanation && (
                  <div className="text-sm text-muted-foreground bg-muted/50 rounded px-3 py-1.5">
                    <span className="font-medium">解析：</span>
                    {q.explanation}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Subjective preview */}
      {subResult && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-green-600" />
                主观题预览
              </CardTitle>
              <Button onClick={handleSaveSubjective} disabled={subSaving}>
                {subSaving ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="size-4 mr-2" />
                    保存为任务
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-sm text-muted-foreground">任务名称</span>
              <p className="font-medium">{subResult.taskName}</p>
            </div>

            <Separator />

            <div>
              <span className="text-sm text-muted-foreground">任务要求</span>
              <p className="text-sm whitespace-pre-wrap">
                {subResult.requirements}
              </p>
            </div>

            <div>
              <span className="text-sm text-muted-foreground">题目提示</span>
              <p className="text-sm whitespace-pre-wrap">{subResult.prompt}</p>
            </div>

            <div>
              <span className="text-sm text-muted-foreground">参考答案</span>
              <p className="text-sm whitespace-pre-wrap bg-green-50 text-green-700 rounded px-3 py-2">
                {subResult.referenceAnswer}
              </p>
            </div>

            <Separator />

            <div>
              <span className="text-sm font-medium">评分标准</span>
              <div className="mt-2 border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-3 py-2 font-medium">名称</th>
                      <th className="text-left px-3 py-2 font-medium">描述</th>
                      <th className="text-right px-3 py-2 font-medium">
                        分值
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {subResult.scoringCriteria.map((c, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-2 font-medium">{c.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {c.description}
                        </td>
                        <td className="px-3 py-2 text-right">{c.maxPoints}</td>
                      </tr>
                    ))}
                    <tr className="border-t bg-muted/50">
                      <td className="px-3 py-2 font-medium" colSpan={2}>
                        总分
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        {subResult.scoringCriteria.reduce(
                          (sum, c) => sum + c.maxPoints,
                          0
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
