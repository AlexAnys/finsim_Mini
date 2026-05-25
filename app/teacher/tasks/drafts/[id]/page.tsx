"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface DraftDetail {
  id: string;
  courseId: string;
  taskType: string;
  title: string;
  description: string | null;
  status:
    | "draft"
    | "queued"
    | "processing"
    | "ready"
    | "approved"
    | "failed"
    | "published";
  progress: number;
  draftPayload: unknown;
  aiPayload: unknown;
  editedPayload: unknown;
  approvedAt: string | null;
  approvedBy: string | null;
  error: string | null;
  missingFields: string[];
}

const STATUS_LABEL: Record<DraftDetail["status"], string> = {
  draft: "草稿",
  queued: "排队中",
  processing: "AI 处理中",
  ready: "AI 待审核",
  approved: "已批准",
  failed: "失败",
  published: "已发布",
};

const STATUS_TONE: Record<DraftDetail["status"], string> = {
  draft: "bg-paper-alt text-ink-3 border-line",
  queued: "bg-paper-alt text-ink-3 border-line",
  processing: "border-warn/30 bg-warn/10 text-warn",
  ready: "border-brand/30 bg-brand-soft text-brand",
  approved: "border-success/30 bg-success/10 text-success",
  failed: "border-danger/30 bg-danger/10 text-danger",
  published: "border-success/30 bg-success/10 text-success",
};

const FIELD_LABEL: Record<string, string> = {
  taskName: "任务名称",
  taskType: "任务类型",
  description: "任务描述",
  totalPoints: "总分",
  scenario: "模拟场景",
  openingLine: "客户开场白",
  requirements: "对话要求",
  scoringCriteria: "评分维度",
  allocationSections: "资金配置",
  simPersona: "客户人设",
  simDialogueStyle: "对话风格",
  simConstraints: "禁止行为",
  timeLimitMinutes: "时长（分钟）",
  quizMode: "测验模式",
  shuffleQuestions: "题目乱序",
  showResult: "显示答案",
  questions: "题目",
  prompt: "题干",
  wordLimit: "字数上限",
  allowAttachment: "允许附件",
  maxAttachments: "最大附件数",
  dueAt: "截止时间",
};

function getFormFromPayload(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  if (obj.form && typeof obj.form === "object") {
    return obj.form as Record<string, unknown>;
  }
  return null;
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value || "—";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function isFieldDifferent(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) !== JSON.stringify(b);
  } catch {
    return a !== b;
  }
}

export default function TaskBuildDraftReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const draftId = params.id;
  const [draft, setDraft] = useState<DraftDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [acceptedFields, setAcceptedFields] = useState<Set<string>>(new Set());

  const loadDraft = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/lms/task-build-drafts/${draftId}`);
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || "加载草稿失败");
        return;
      }
      setDraft(json.data as DraftDetail);
      setError(null);
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, [draftId]);

  useEffect(() => {
    if (!draftId) return;
    loadDraft();
  }, [draftId, loadDraft]);

  const aiForm = useMemo(() => getFormFromPayload(draft?.aiPayload), [draft?.aiPayload]);
  const editedForm = useMemo(
    () => getFormFromPayload(draft?.draftPayload),
    [draft?.draftPayload],
  );
  const hasAiSnapshot = aiForm !== null;

  const fieldKeys = useMemo(() => {
    const keys = new Set<string>();
    if (aiForm) Object.keys(aiForm).forEach((k) => keys.add(k));
    if (editedForm) Object.keys(editedForm).forEach((k) => keys.add(k));
    return Array.from(keys);
  }, [aiForm, editedForm]);

  const differingKeys = useMemo(
    () =>
      fieldKeys.filter((key) =>
        isFieldDifferent(aiForm?.[key], editedForm?.[key]),
      ),
    [fieldKeys, aiForm, editedForm],
  );

  async function handleAcceptRow(field: string) {
    if (!draft || !aiForm) return;
    const nextEdited = { ...(editedForm ?? {}) };
    nextEdited[field] = aiForm[field];
    const nextPayload =
      draft.draftPayload && typeof draft.draftPayload === "object"
        ? { ...(draft.draftPayload as Record<string, unknown>), form: nextEdited }
        : { form: nextEdited };

    try {
      const res = await fetch(`/api/lms/task-build-drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftPayload: nextPayload }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "接受失败");
        return;
      }
      setAcceptedFields((prev) => new Set(prev).add(field));
      toast.success(`已接受「${FIELD_LABEL[field] ?? field}」AI 原稿`);
      await loadDraft();
    } catch {
      toast.error("网络错误，请稍后重试");
    }
  }

  async function handleApproveAll() {
    if (!draft) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/lms/task-build-drafts/${draft.id}/approve`, {
        method: "PATCH",
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "批准失败");
        return;
      }
      // publish-flow: 修误导文案 —— 不再指向幽灵「课程发布页」，准确指引回小节卡片点「发布」。
      toast.success("已批准，回到课程小节点卡片「发布」即可");
      router.push(`/teacher/courses/${draft.courseId}`);
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setApproving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-ink-3">
        <Loader2 className="mr-2 size-4 animate-spin" />
        加载草稿中…
      </div>
    );
  }

  if (error || !draft) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="text-xl font-semibold text-ink">无法加载草稿</h1>
        <p className="text-sm text-ink-3">{error ?? "草稿不存在或已被删除。"}</p>
        <Button asChild variant="outline">
          <Link href="/teacher/dashboard">
            <ArrowLeft className="mr-1 size-4" />
            返回控制台
          </Link>
        </Button>
      </div>
    );
  }

  const canApprove = draft.status === "ready";
  const alreadyApproved = draft.status === "approved" || draft.status === "published";

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs text-ink-3">
            <Link href={`/teacher/courses/${draft.courseId}`}>
              <ArrowLeft className="mr-1 size-3" />
              返回课程
            </Link>
          </Button>
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            审核任务草稿
            <span className="ml-2 text-base text-ink-4">/ {draft.title}</span>
          </h1>
          <p className="text-xs text-ink-3">
            对比 AI 原稿与教师编辑稿，按需接受单字段或整体批准。批准后回到课程小节，点卡片「发布」即可发给学生。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={STATUS_TONE[draft.status]}>
            {STATUS_LABEL[draft.status]}
          </Badge>
          {canApprove && (
            <Button
              onClick={handleApproveAll}
              disabled={approving}
              className="gap-1"
            >
              {approving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldCheck className="size-4" />
              )}
              批准全部
            </Button>
          )}
          {alreadyApproved && (
            <Button asChild variant="outline">
              <Link href={`/teacher/courses/${draft.courseId}`}>
                <CheckCircle2 className="mr-1 size-4" />
                回课程小节点「发布」
              </Link>
            </Button>
          )}
        </div>
      </div>

      {!hasAiSnapshot && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4" />
              无 AI 原稿快照
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-ink-3">
            <p>
              本草稿没有 AI 原稿快照（可能是旧草稿或未经过 AI 生成）。点击「直接批准」绕过左右对照，把草稿标记为已批准。
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {canApprove && (
                <Button onClick={handleApproveAll} disabled={approving}>
                  {approving ? (
                    <Loader2 className="mr-1 size-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="mr-1 size-4" />
                  )}
                  直接批准
                </Button>
              )}
              {/* PR-15 bug 2: 无 AI 路径也补上返回按钮 */}
              <Button asChild variant="outline">
                <Link href={`/teacher/courses/${draft.courseId}`}>
                  <ArrowLeft className="mr-1 size-4" />
                  返回课程
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {hasAiSnapshot && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI 原稿 vs 教师编辑稿</CardTitle>
            <p className="text-xs text-ink-3">
              共 {fieldKeys.length} 个字段；{differingKeys.length} 个字段教师有改动。
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {fieldKeys.length === 0 && (
              <p className="text-sm text-ink-3">草稿没有可对比的字段。</p>
            )}
            {fieldKeys.map((field) => {
              const aiValue = aiForm?.[field];
              const editedValue = editedForm?.[field];
              const different = isFieldDifferent(aiValue, editedValue);
              const accepted = acceptedFields.has(field);
              return (
                <div
                  key={field}
                  className={
                    different
                      ? "rounded-md border border-warn/30 bg-warn/10 p-3"
                      : "rounded-md border border-line bg-paper-alt/40 p-3"
                  }
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink">
                        {FIELD_LABEL[field] ?? field}
                      </span>
                      {different ? (
                        <Badge variant="outline" className="border-warn/40 text-warn">
                          有差异
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-line text-ink-4">
                          一致
                        </Badge>
                      )}
                      {accepted && (
                        <Badge variant="outline" className="border-success/40 text-success">
                          已接受 AI 原稿
                        </Badge>
                      )}
                    </div>
                    {different && canApprove && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAcceptRow(field)}
                      >
                        接受 AI 原稿
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <div className="rounded border border-line bg-paper p-2">
                      <div className="mb-1 text-[11px] uppercase tracking-wide text-ink-4">
                        AI 原稿
                      </div>
                      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs text-ink">
                        {stringify(aiValue)}
                      </pre>
                    </div>
                    <div className="rounded border border-line bg-paper p-2">
                      <div className="mb-1 text-[11px] uppercase tracking-wide text-ink-4">
                        教师编辑稿
                      </div>
                      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs text-ink">
                        {stringify(editedValue)}
                      </pre>
                    </div>
                  </div>
                </div>
              );
            })}
            <Separator />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-ink-3">
                如需拒绝整份草稿：返回课程页删除草稿即可（拒绝 = 不操作 + 删除）。
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {/* PR-15 bug 2: 重复顶部返回入口 — 长字段对比滚动后顶部按钮看不到 */}
                <Button asChild variant="outline">
                  <Link href={`/teacher/courses/${draft.courseId}`}>
                    <ArrowLeft className="mr-1 size-4" />
                    返回课程
                  </Link>
                </Button>
                {canApprove && (
                  <Button onClick={handleApproveAll} disabled={approving}>
                    {approving ? (
                      <Loader2 className="mr-1 size-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="mr-1 size-4" />
                    )}
                    批准全部
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
