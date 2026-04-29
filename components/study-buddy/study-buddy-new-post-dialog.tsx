"use client";

// PR-STU-2 · 学生 /study-buddy 新问题弹窗
// - 复用现有 Dialog primitives（保留业务流不变）
// - 字段：关联任务 / 标题 / 问题详情 / 回答模式（Socratic / Direct）/ 匿名 toggle
// - 提交流程：调 POST /api/study-buddy/posts，taskId/taskInstanceId 来自学生显式选择的任务
//
// 视觉对照 mockup：白底卡 + 顶部标题 + 4 段 form 控件 + 底部主按钮
// 不引入新表单库 — 用 Input/Textarea/Select/Switch 与 grades 风格保持一致。

import { Loader2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  DashboardTaskLite,
  StudyBuddyMode,
} from "@/lib/utils/study-buddy-transforms";

interface StudyBuddyNewPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 表单 state */
  title: string;
  question: string;
  mode: StudyBuddyMode;
  anonymous: boolean;
  tasks: DashboardTaskLite[];
  selectedTaskInstanceId: string;
  isSubmitting: boolean;
  /** 表单 setters */
  onTitleChange: (v: string) => void;
  onQuestionChange: (v: string) => void;
  onModeChange: (m: StudyBuddyMode) => void;
  onAnonymousChange: (v: boolean) => void;
  onSelectedTaskInstanceIdChange: (v: string) => void;
  onSubmit: () => void;
}

const MODES: { key: StudyBuddyMode; label: string; desc: string }[] = [
  {
    key: "socratic",
    label: "引导式",
    desc: "AI 通过提问引导你自己发现答案",
  },
  {
    key: "direct",
    label: "直接回答",
    desc: "AI 给出清晰的分步答案",
  },
];

export function StudyBuddyNewPostDialog({
  open,
  onOpenChange,
  title,
  question,
  mode,
  anonymous,
  tasks,
  selectedTaskInstanceId,
  isSubmitting,
  onTitleChange,
  onQuestionChange,
  onModeChange,
  onAnonymousChange,
  onSelectedTaskInstanceIdChange,
  onSubmit,
}: StudyBuddyNewPostDialogProps) {
  const canSubmit =
    selectedTaskInstanceId.length > 0 &&
    title.trim().length > 0 &&
    question.trim().length > 0 &&
    !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-bold tracking-[-0.01em] text-ink">
            向学习伙伴提问
          </DialogTitle>
          <DialogDescription className="text-[12.5px] text-ink-4">
            描述清楚你的卡点，灵析会基于课程上下文提供学习引导。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* 关联任务 */}
          <div className="space-y-1.5">
            <Label className="text-[12.5px] font-medium text-ink-2">
              关联任务
            </Label>
            <Select
              value={selectedTaskInstanceId}
              onValueChange={onSelectedTaskInstanceIdChange}
              disabled={isSubmitting || tasks.length === 0}
            >
              <SelectTrigger className="h-9 w-full border-line bg-paper text-[13.5px]">
                <SelectValue
                  placeholder={
                    tasks.length > 0 ? "选择要关联的任务" : "暂无可关联任务"
                  }
                />
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-72">
                {tasks.map((task) => {
                  const courseTitle = task.course?.courseTitle ?? "未关联课程";
                  const taskTitle = task.taskName ?? task.title ?? "未命名任务";
                  return (
                    <SelectItem key={task.id} value={task.id}>
                      {courseTitle} · {taskTitle}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="text-[11.5px] leading-relaxed text-ink-4">
              学习伙伴会根据所选任务的课程上下文回答问题。
            </p>
          </div>

          {/* 标题 */}
          <div className="space-y-1.5">
            <Label className="text-[12.5px] font-medium text-ink-2">
              标题
            </Label>
            <Input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="一句话描述你的问题"
              maxLength={120}
              className="text-[13.5px]"
            />
          </div>

          {/* 问题详情 */}
          <div className="space-y-1.5">
            <Label className="text-[12.5px] font-medium text-ink-2">
              问题详情
            </Label>
            <Textarea
              value={question}
              onChange={(e) => onQuestionChange(e.target.value)}
              placeholder="详细说明你的卡点、已有思路、希望 AI 帮忙的方向…"
              rows={5}
              className="text-[13.5px] leading-relaxed"
            />
          </div>

          {/* 回答模式 — segmented choice */}
          <div className="space-y-1.5">
            <Label className="text-[12.5px] font-medium text-ink-2">
              回答模式
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {MODES.map((m) => {
                const active = mode === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => onModeChange(m.key)}
                    aria-pressed={active}
                    className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      active
                        ? "border-brand bg-brand-soft"
                        : "border-line bg-paper hover:bg-paper-alt"
                    }`}
                  >
                    <div
                      className={`text-[13px] font-semibold ${
                        active ? "text-brand" : "text-ink-2"
                      }`}
                    >
                      {m.label}
                    </div>
                    <div className="mt-0.5 text-[11.5px] leading-relaxed text-ink-4">
                      {m.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 匿名 toggle */}
          <div className="flex items-center justify-between rounded-lg border border-line-2 bg-paper-alt px-3 py-2.5">
            <div>
              <div className="text-[12.5px] font-medium text-ink-2">
                匿名提问
              </div>
              <div className="text-[11.5px] text-ink-4">
                教师汇总不会显示你的姓名
              </div>
            </div>
            <Switch
              checked={anonymous}
              onCheckedChange={onAnonymousChange}
              aria-label="匿名提问"
            />
          </div>
        </div>

        <Button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="mt-2 w-full gap-1.5 bg-brand text-brand-fg hover:bg-brand-lift"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              提交中…
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              发起对话
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
