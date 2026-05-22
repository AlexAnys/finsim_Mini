"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type TaskTypeKey = "simulation" | "quiz" | "subjective";

interface ScoringCriterion {
  name: string;
  description?: string;
  maxPoints: number;
  order: number;
}

interface SnapshotEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  taskType: TaskTypeKey;
  snapshot: Record<string, unknown> | null;
  gradedCount: number;
  onSaved: () => void;
}

const STRICTNESS_OPTIONS = [
  { value: "LENIENT", label: "宽松" },
  { value: "MODERATE", label: "均衡" },
  { value: "STRICT", label: "严格" },
  { value: "VERY_STRICT", label: "非常严格" },
];

const QUIZ_MODE_OPTIONS = [
  { value: "fixed", label: "固定模式（按顺序）" },
  { value: "adaptive", label: "自适应模式（按难度）" },
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback?: number): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fallback;
}

export function SnapshotEditSheet({
  open,
  onOpenChange,
  instanceId,
  taskType,
  snapshot,
  gradedCount,
  onSaved,
}: SnapshotEditSheetProps) {
  const initial = useMemo(() => buildInitialState(taskType, snapshot), [taskType, snapshot]);
  const [state, setState] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [warningOpen, setWarningOpen] = useState(false);

  useEffect(() => {
    if (open) setState(initial);
  }, [open, initial]);

  const handleSave = () => {
    if (gradedCount > 0) {
      setWarningOpen(true);
      return;
    }
    void doSave();
  };

  const doSave = async () => {
    setSaving(true);
    try {
      const body = buildPatchBody(taskType, state);
      const res = await fetch(`/api/lms/task-instances/${instanceId}/snapshot`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "保存失败");
        return;
      }
      toast.success("实例配置已更新");
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setSaving(false);
      setWarningOpen(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col gap-4 p-0 sm:max-w-[640px]">
          <SheetHeader className="border-b border-line px-6 pb-4">
            <SheetTitle>编辑实例配置</SheetTitle>
            <SheetDescription>
              修改本实例的 taskSnapshot（仅影响本班级看到的配置；任务模板不变）
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 pb-4">
            {taskType === "simulation" && (
              <SimulationForm
                state={state as SimulationFormState}
                onChange={(patch) =>
                  setState((s) => ({ ...s, ...patch }) as SimulationFormState)
                }
              />
            )}
            {taskType === "quiz" && (
              <QuizForm
                state={state as QuizFormState}
                onChange={(patch) =>
                  setState((s) => ({ ...s, ...patch }) as QuizFormState)
                }
              />
            )}
            {taskType === "subjective" && (
              <SubjectiveForm
                state={state as SubjectiveFormState}
                onChange={(patch) =>
                  setState((s) => ({ ...s, ...patch }) as SubjectiveFormState)
                }
              />
            )}
          </div>

          <SheetFooter className="border-t border-line px-6 py-3">
            <div className="flex w-full justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                取消
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 size-3.5 animate-spin" />}
                保存
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={warningOpen} onOpenChange={setWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>本实例已有批改记录</AlertDialogTitle>
            <AlertDialogDescription>
              已批改 {gradedCount} 份将不受影响，但学生后续看到的配置会立即更新。
              如需保留旧成绩的同时让新一轮学生从头开始，建议改用「复制为新任务」。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>取消</AlertDialogCancel>
            <Button
              variant="outline"
              disabled
              title="即将上线，敬请期待"
              data-action="copy-as-new"
            >
              复制为新任务
            </Button>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void doSave();
              }}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 size-3.5 animate-spin" />}
              我知道，仍然保存
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface SimulationFormState {
  scenario: string;
  openingLine: string;
  dialogueRequirements: string;
  strictnessLevel: string;
  scoringCriteria: ScoringCriterion[];
  allocationCount: number;
}

interface QuizFormState {
  mode: string;
  timeLimitMinutes?: number;
  maxQuestions?: number;
  startDifficulty?: number;
  difficultyStep?: number;
  questionCount: number;
}

interface SubjectiveFormState {
  prompt: string;
  allowTextAnswer: boolean;
  allowedAttachmentTypes: string[];
  strictnessLevel: string;
  scoringCriteria: ScoringCriterion[];
}

type FormState = SimulationFormState | QuizFormState | SubjectiveFormState;

function buildInitialState(taskType: TaskTypeKey, snapshot: Record<string, unknown> | null): FormState {
  const snap = snapshot ?? {};
  const scoringCriteria = asArray<ScoringCriterion>(snap.scoringCriteria).map((c, i) => ({
    name: asString(c?.name),
    description: asString(c?.description),
    maxPoints: asNumber(c?.maxPoints, 10)!,
    order: asNumber(c?.order, i)!,
  }));

  if (taskType === "simulation") {
    const sim = asRecord(snap.simulationConfig);
    return {
      scenario: asString(sim.scenario),
      openingLine: asString(sim.openingLine),
      dialogueRequirements: asString(sim.dialogueRequirements),
      strictnessLevel: asString(sim.strictnessLevel, "MODERATE"),
      scoringCriteria,
      allocationCount: asArray(snap.allocationSections).length,
    };
  }
  if (taskType === "quiz") {
    const quiz = asRecord(snap.quizConfig);
    return {
      mode: asString(quiz.mode, "fixed"),
      timeLimitMinutes: asNumber(quiz.timeLimitMinutes),
      maxQuestions: asNumber(quiz.maxQuestions),
      startDifficulty: asNumber(quiz.startDifficulty),
      difficultyStep: asNumber(quiz.difficultyStep),
      questionCount: asArray(snap.quizQuestions).length,
    };
  }
  const sub = asRecord(snap.subjectiveConfig);
  return {
    prompt: asString(sub.prompt),
    allowTextAnswer: sub.allowTextAnswer !== false,
    allowedAttachmentTypes: asArray<string>(sub.allowedAttachmentTypes),
    strictnessLevel: asString(sub.strictnessLevel, "MODERATE"),
    scoringCriteria,
  };
}

// Slice 2 (B1): 用户清空可选字段时显式发 null（service 收到 null → delete from snapshot）。
// 旧实现把空值映射为 undefined → JSON.stringify drop → service 浅 merge 保留旧值 = 清空失效。
export function buildPatchBody(taskType: TaskTypeKey, state: FormState) {
  if (taskType === "simulation") {
    const s = state as SimulationFormState;
    return {
      taskType: "simulation" as const,
      simulationConfig: {
        scenario: s.scenario,
        openingLine: s.openingLine,
        dialogueRequirements: s.dialogueRequirements.trim() ? s.dialogueRequirements : null,
        strictnessLevel: s.strictnessLevel,
      },
      scoringCriteria: s.scoringCriteria,
    };
  }
  if (taskType === "quiz") {
    const q = state as QuizFormState;
    return {
      taskType: "quiz" as const,
      quizConfig: {
        mode: q.mode,
        timeLimitMinutes: q.timeLimitMinutes ?? null,
        maxQuestions: q.maxQuestions ?? null,
        startDifficulty: q.startDifficulty ?? null,
        difficultyStep: q.difficultyStep ?? null,
      },
    };
  }
  const sb = state as SubjectiveFormState;
  return {
    taskType: "subjective" as const,
    subjectiveConfig: {
      prompt: sb.prompt,
      allowTextAnswer: sb.allowTextAnswer,
      allowedAttachmentTypes: sb.allowedAttachmentTypes,
      strictnessLevel: sb.strictnessLevel,
    },
    scoringCriteria: sb.scoringCriteria,
  };
}

function SimulationForm({
  state,
  onChange,
}: {
  state: SimulationFormState;
  onChange: (patch: Partial<SimulationFormState>) => void;
}) {
  return (
    <div className="space-y-4 py-2" data-form="simulation">
      <div className="space-y-2">
        <Label>场景描述</Label>
        <Textarea
          value={state.scenario}
          onChange={(e) => onChange({ scenario: e.target.value })}
          rows={4}
        />
      </div>
      <div className="space-y-2">
        <Label>开场白</Label>
        <Textarea
          value={state.openingLine}
          onChange={(e) => onChange({ openingLine: e.target.value })}
          rows={2}
        />
      </div>
      <div className="space-y-2">
        <Label>对话要求</Label>
        <Textarea
          value={state.dialogueRequirements}
          onChange={(e) => onChange({ dialogueRequirements: e.target.value })}
          rows={3}
        />
      </div>
      <div className="space-y-2">
        <Label>评分严格度</Label>
        <Select
          value={state.strictnessLevel}
          onValueChange={(v) => onChange({ strictnessLevel: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STRICTNESS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <ScoringCriteriaEditor
        criteria={state.scoringCriteria}
        onChange={(scoringCriteria) => onChange({ scoringCriteria })}
      />
      {state.allocationCount > 0 && (
        <p className="rounded-md bg-paper-alt p-3 text-xs text-ink-4">
          资产分组共 {state.allocationCount} 段（本 Sheet 暂不支持编辑，如需调整请使用「复制为新任务」）
        </p>
      )}
    </div>
  );
}

function QuizForm({
  state,
  onChange,
}: {
  state: QuizFormState;
  onChange: (patch: Partial<QuizFormState>) => void;
}) {
  return (
    <div className="space-y-4 py-2" data-form="quiz">
      <div className="space-y-2">
        <Label>模式</Label>
        <Select value={state.mode} onValueChange={(v) => onChange({ mode: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {QUIZ_MODE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>限时（分钟）</Label>
          <Input
            type="number"
            min={1}
            value={state.timeLimitMinutes ?? ""}
            onChange={(e) =>
              onChange({
                timeLimitMinutes: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label>最大题量</Label>
          <Input
            type="number"
            min={1}
            value={state.maxQuestions ?? ""}
            onChange={(e) =>
              onChange({
                maxQuestions: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </div>
      </div>
      {state.mode === "adaptive" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>起始难度（1-5）</Label>
            <Input
              type="number"
              min={1}
              max={5}
              value={state.startDifficulty ?? ""}
              onChange={(e) =>
                onChange({
                  startDifficulty: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>难度步长</Label>
            <Input
              type="number"
              min={1}
              value={state.difficultyStep ?? ""}
              onChange={(e) =>
                onChange({
                  difficultyStep: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          </div>
        </div>
      )}
      <p className="rounded-md bg-paper-alt p-3 text-xs text-ink-4">
        题库共 {state.questionCount} 题（本 Sheet 暂不支持单题编辑，如需调整题目内容请使用「复制为新任务」）
      </p>
    </div>
  );
}

function SubjectiveForm({
  state,
  onChange,
}: {
  state: SubjectiveFormState;
  onChange: (patch: Partial<SubjectiveFormState>) => void;
}) {
  const toggleAttachment = (type: string) => {
    const list = state.allowedAttachmentTypes;
    onChange({
      allowedAttachmentTypes: list.includes(type)
        ? list.filter((t) => t !== type)
        : [...list, type],
    });
  };
  const ATTACHMENT_TYPES = [
    { value: "image", label: "图片" },
    { value: "pdf", label: "PDF" },
    { value: "docx", label: "Word" },
    { value: "xlsx", label: "Excel" },
  ];
  return (
    <div className="space-y-4 py-2" data-form="subjective">
      <div className="space-y-2">
        <Label>题目提示</Label>
        <Textarea
          value={state.prompt}
          onChange={(e) => onChange({ prompt: e.target.value })}
          rows={5}
        />
      </div>
      <div className="space-y-2">
        <Label>允许文本作答</Label>
        <Select
          value={state.allowTextAnswer ? "yes" : "no"}
          onValueChange={(v) => onChange({ allowTextAnswer: v === "yes" })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="yes">允许</SelectItem>
            <SelectItem value="no">不允许（仅附件）</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>允许的附件类型</Label>
        <div className="flex flex-wrap gap-2">
          {ATTACHMENT_TYPES.map((t) => {
            const active = state.allowedAttachmentTypes.includes(t.value);
            return (
              <Button
                key={t.value}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                onClick={() => toggleAttachment(t.value)}
              >
                {t.label}
              </Button>
            );
          })}
        </div>
      </div>
      <div className="space-y-2">
        <Label>评分严格度</Label>
        <Select
          value={state.strictnessLevel}
          onValueChange={(v) => onChange({ strictnessLevel: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STRICTNESS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <ScoringCriteriaEditor
        criteria={state.scoringCriteria}
        onChange={(scoringCriteria) => onChange({ scoringCriteria })}
      />
    </div>
  );
}

function ScoringCriteriaEditor({
  criteria,
  onChange,
}: {
  criteria: ScoringCriterion[];
  onChange: (next: ScoringCriterion[]) => void;
}) {
  const update = (i: number, patch: Partial<ScoringCriterion>) => {
    onChange(criteria.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  };
  const remove = (i: number) => onChange(criteria.filter((_, idx) => idx !== i));
  const add = () =>
    onChange([
      ...criteria,
      { name: "", description: "", maxPoints: 10, order: criteria.length },
    ]);

  return (
    <div className="space-y-2" data-section="scoring-criteria">
      <div className="flex items-center justify-between">
        <Label>评分标准</Label>
        <Button type="button" size="sm" variant="outline" onClick={add}>
          <Plus className="mr-1 size-3.5" />
          新增标准
        </Button>
      </div>
      {criteria.length === 0 ? (
        <p className="text-xs text-ink-5">暂未设置评分标准</p>
      ) : (
        <div className="space-y-2">
          {criteria.map((c, i) => (
            <div
              key={i}
              className="grid grid-cols-[2fr_1fr_auto] items-center gap-2 rounded-md border border-line bg-paper p-2"
            >
              <Input
                placeholder="标准名称"
                value={c.name}
                onChange={(e) => update(i, { name: e.target.value })}
              />
              <Input
                type="number"
                min={1}
                value={c.maxPoints}
                onChange={(e) =>
                  update(i, { maxPoints: Number(e.target.value) || 1 })
                }
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => remove(i)}
                aria-label="删除该标准"
              >
                <Trash2 className="size-3.5 text-ink-5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
