"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Send,
  Loader2,
  User,
  Settings,
  BarChart3,
  RotateCcw,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RunnerTopbar } from "@/components/runner/runner-topbar";
import { RunnerMetaPill } from "@/components/runner/runner-meta";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  type MoodType,
  type TranscriptMessage,
  type SimulationEvaluation,
  type AssetAllocation,
} from "@/lib/types";
import { EvaluationView } from "./evaluation-view";
import { StudyBuddyPanel } from "./study-buddy-panel";

// ---------- Types ----------

interface ScoringCriterion {
  id: string;
  label: string;
  maxScore: number;
  description?: string;
}

interface AllocationSection {
  label: string;
  items: Array<{ label: string; defaultValue?: number }>;
}

interface SimulationTaskConfig {
  scenario: string;
  openingLine: string;
  scoringCriteria: ScoringCriterion[];
  allocationSections?: AllocationSection[];
  requirements?: string[];
  maxSubmissions?: number;
}

interface SimulationRunnerProps {
  taskConfig: SimulationTaskConfig;
  taskId: string;
  taskInstanceId: string;
  taskName: string;
  evaluatorPersona?: string;
  strictnessLevel?: string;
  isPreview?: boolean;
  systemPrompt?: string;
}

// ---------- Helpers ----------

/** generateId() requires Secure Context (HTTPS) in Safari/Firefox.
 *  Fallback to crypto.getRandomValues() which works everywhere. */
function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ---------- Constants ----------

const MOOD_COLORS: Record<MoodType, { bg: string; text: string; label: string }> = {
  HAPPY: { bg: "bg-green-100", text: "text-green-700", label: "愉快" },
  NEUTRAL: { bg: "bg-slate-100", text: "text-slate-600", label: "中性" },
  ANGRY: { bg: "bg-red-100", text: "text-red-700", label: "愤怒" },
  CONFUSED: { bg: "bg-orange-100", text: "text-orange-700", label: "困惑" },
  SKEPTICAL: { bg: "bg-yellow-100", text: "text-yellow-700", label: "怀疑" },
};

const DRAFT_KEY_PREFIX = "finsim_sim_draft_";

// ---------- Component ----------

export function SimulationRunner({
  taskConfig,
  taskId,
  taskInstanceId,
  taskName,
  evaluatorPersona,
  strictnessLevel,
  isPreview,
  systemPrompt,
}: SimulationRunnerProps) {
  const router = useRouter();
  const {
    scenario,
    openingLine,
    scoringCriteria,
    allocationSections,
    requirements,
    maxSubmissions = 3,
  } = taskConfig;

  // Chat state
  const [messages, setMessages] = useState<TranscriptMessage[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem(DRAFT_KEY_PREFIX + taskInstanceId);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.messages || [];
      } catch {
        return [];
      }
    }
    return [];
  });
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [mood, setMood] = useState<MoodType>(() => {
    if (typeof window === "undefined") return "NEUTRAL";
    const saved = localStorage.getItem(DRAFT_KEY_PREFIX + taskInstanceId);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.mood || "NEUTRAL";
      } catch {
        return "NEUTRAL";
      }
    }
    return "NEUTRAL";
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Allocation state
  const [allocations, setAllocations] = useState<AssetAllocation["sections"]>(() => {
    if (!allocationSections) return [];
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(DRAFT_KEY_PREFIX + taskInstanceId);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.allocations) return parsed.allocations;
        } catch {
          // fall through
        }
      }
    }
    return allocationSections.map((s) => ({
      label: s.label,
      items: s.items.map((item) => ({
        label: item.label,
        value: item.defaultValue ?? 0,
      })),
    }));
  });
  const [allocationSubmitCount, setAllocationSubmitCount] = useState(0);

  // Evaluation state
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<SimulationEvaluation | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Auto-send opening line
  useEffect(() => {
    if (messages.length === 0 && openingLine) {
      const aiMsg: TranscriptMessage = {
        id: generateId(),
        role: "ai",
        text: openingLine,
        timestamp: new Date().toISOString(),
        mood: "NEUTRAL",
      };
      setMessages([aiMsg]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Save draft
  const saveDraft = useCallback(
    (msgs: TranscriptMessage[], moodVal: MoodType, allocs: AssetAllocation["sections"]) => {
      if (typeof window === "undefined") return;
      localStorage.setItem(
        DRAFT_KEY_PREFIX + taskInstanceId,
        JSON.stringify({ messages: msgs, mood: moodVal, allocations: allocs })
      );
    },
    [taskInstanceId]
  );

  useEffect(() => {
    saveDraft(messages, mood, allocations);
  }, [messages, mood, allocations, saveDraft]);

  // Parse mood from AI response
  // Supports both [MOOD: CONFUSED] and [CONFUSED] formats
  function parseMoodFromText(text: string): { cleanText: string; mood?: MoodType } {
    const moodPattern = /\[(?:MOOD:\s*)?(\w+)\]\s*$/i;
    const moodMatch = text.match(moodPattern);
    if (moodMatch) {
      const moodStr = moodMatch[1].toUpperCase() as MoodType;
      if (MOOD_COLORS[moodStr]) {
        const cleanText = text.replace(moodPattern, "").trim();
        return { cleanText, mood: moodStr };
      }
    }
    return { cleanText: text };
  }

  // Send message
  async function handleSend() {
    const text = inputValue.trim();
    if (!text || isSending) return;

    const studentMsg: TranscriptMessage = {
      id: generateId(),
      role: "student",
      text,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, studentMsg];
    setMessages(updatedMessages);
    setInputValue("");
    setIsSending(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: updatedMessages.map(m => ({ role: m.role, text: m.text })),
          scenario,
          openingLine,
          systemPrompt,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error?.message || "AI 回复失败");
      }

      const data = await res.json();
      const aiText = data.data?.reply || data.reply || "";
      const { cleanText, mood: newMood } = parseMoodFromText(aiText);

      const aiMsg: TranscriptMessage = {
        id: generateId(),
        role: "ai",
        text: cleanText,
        timestamp: new Date().toISOString(),
        mood: newMood,
      };

      if (newMood) setMood(newMood);
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "发送消息失败，请重试");
    } finally {
      setIsSending(false);
    }
  }

  // Handle allocation change
  function handleAllocationChange(sectionIdx: number, itemIdx: number, value: number) {
    setAllocations((prev) => {
      const next = prev.map((s, si) => {
        if (si !== sectionIdx) return s;
        return {
          ...s,
          items: s.items.map((item, ii) =>
            ii === itemIdx ? { ...item, value } : item
          ),
        };
      });
      return next;
    });
  }

  // Submit allocation
  function handleSubmitAllocation() {
    for (const section of allocations) {
      const total = section.items.reduce((sum, item) => sum + item.value, 0);
      if (total !== 100) {
        toast.error(`"${section.label}" 总计必须为 100%，当前为 ${total}%`);
        return;
      }
    }
    setAllocationSubmitCount((c) => c + 1);
    toast.success("资产配置已提交");
  }

  // Finish conversation — preview mode: evaluate on frontend; student mode: submit directly
  async function handleFinishConversation() {
    if (messages.filter((m) => m.role === "student").length === 0) {
      toast.error("请先进行对话后再结束");
      return;
    }

    if (isPreview) {
      // Preview mode: teacher needs instant evaluation feedback
      setIsEvaluating(true);
      try {
        const res = await fetch("/api/ai/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskName,
            requirements: requirements?.join("\n"),
            scenario,
            evaluatorPersona,
            strictnessLevel: strictnessLevel || "MODERATE",
            transcript: messages.map(m => ({ role: m.role, text: m.text })),
            rubric: scoringCriteria.map(c => ({
              id: c.id, name: c.label, description: c.description, maxPoints: c.maxScore,
            })),
            assets: allocations.length > 0 ? { sections: allocations } : undefined,
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.error?.message || "评估失败");
        }
        const data = await res.json();
        setEvaluation(data.data || data);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "评估失败，请重试");
      } finally {
        setIsEvaluating(false);
      }
      return;
    }

    // Student mode: submit directly, backend evaluates asynchronously
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: "simulation",
          taskId,
          taskInstanceId,
          transcript: messages,
          assets: allocations.length > 0 ? { sections: allocations } : undefined,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error?.message || "提交失败");
      }
      localStorage.removeItem(DRAFT_KEY_PREFIX + taskInstanceId);
      toast.success("提交成功，评估将在后台完成");
      router.back();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "提交失败，请重试");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Submit result
  async function handleSubmit() {
    if (!evaluation) return;
    if (isPreview) {
      toast.info("预览模式下不可提交");
      return;
    }
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: "simulation",
          taskId,
          taskInstanceId,
          transcript: messages,
          assets: allocations.length > 0 ? { sections: allocations } : undefined,
          evaluation,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error?.message || "提交失败");
      }

      setSubmitted(true);
      localStorage.removeItem(DRAFT_KEY_PREFIX + taskInstanceId);
      toast.success("提交成功");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "提交失败，请重试");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Redo
  function handleRedo() {
    setMessages([]);
    setEvaluation(null);
    setSubmitted(false);
    setMood("NEUTRAL");
    setAllocations(
      allocationSections?.map((s) => ({
        label: s.label,
        items: s.items.map((item) => ({
          label: item.label,
          value: item.defaultValue ?? 0,
        })),
      })) ?? []
    );
    setAllocationSubmitCount(0);
    localStorage.removeItem(DRAFT_KEY_PREFIX + taskInstanceId);
  }

  function handleClose() {
    router.back();
  }

  const moodInfo = MOOD_COLORS[mood];

  // ---- Evaluation view ----
  if (evaluation) {
    return (
      <>
        <EvaluationView
          evaluation={evaluation}
          allocations={allocations}
          messages={messages}
          scoringCriteria={scoringCriteria}
          onSubmit={handleSubmit}
          onRedo={handleRedo}
          onClose={handleClose}
          isSubmitting={isSubmitting}
          submitted={submitted}
          isPreview={isPreview}
        />
        <StudyBuddyPanel taskId={taskId} taskInstanceId={taskInstanceId} />
      </>
    );
  }

  // ---- Main simulation view ----
  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <RunnerTopbar
        onBack={() => router.back()}
        title={taskName}
        subtitle={isPreview ? "模拟对话 · 预览模式" : "模拟对话"}
        metaSlots={
          <RunnerMetaPill>
            <span className="text-white/60">客户情绪</span>
            <span className="font-semibold text-white">{moodInfo.label}</span>
          </RunnerMetaPill>
        }
        actions={[
          {
            label: "重来",
            onClick: handleRedo,
            icon: RotateCcw,
            variant: "secondary",
          },
          {
            label: "结束",
            onClick: handleFinishConversation,
            icon: Check,
            variant: "primary",
            disabled: messages.length < 2,
            loading: isEvaluating || isSubmitting,
            loadingLabel: isEvaluating ? "评估中..." : "提交中...",
          },
        ]}
      />

      {/* 3-column body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel - 客户档案 */}
        <div className="flex w-[280px] shrink-0 flex-col border-r bg-white">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <User className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold">客户档案</span>
          </div>
          <div className="min-h-0 flex-1">
            <ScrollArea className="h-full">
              <div className="space-y-4 p-4">
                {/* Scenario */}
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    背景情景
                  </h4>
                  <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                    {scenario}
                  </p>
                </div>

                <Separator />

                {/* Requirements */}
                {requirements && requirements.length > 0 && (
                  <>
                    <div>
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        任务要求
                      </h4>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {requirements.map((req, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="mt-0.5 shrink-0 text-blue-500">-</span>
                            <span>{req}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <Separator />
                  </>
                )}

                {/* Scoring criteria */}
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    对话目标
                  </h4>
                  <div className="space-y-2">
                    {scoringCriteria.map((c) => (
                      <div key={c.id} className="rounded-md border p-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{c.label}</span>
                          <Badge variant="secondary" className="text-[10px]">
                            {c.maxScore} 分
                          </Badge>
                        </div>
                        {c.description && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {c.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Center panel - Chat */}
        <div className="flex flex-1 flex-col bg-slate-50">
          {/* Messages */}
          <div className="min-h-0 flex-1">
            <ScrollArea className="h-full">
              <div className="mx-auto max-w-2xl space-y-3 p-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.role === "student" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                        msg.role === "student"
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "rounded-bl-md bg-white shadow-sm"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                      <p
                        className={`mt-1 text-[10px] ${
                          msg.role === "student"
                            ? "text-primary-foreground/60"
                            : "text-muted-foreground"
                        }`}
                      >
                        {new Date(msg.timestamp).toLocaleTimeString("zh-CN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      {msg.role === "ai" && msg.mood && MOOD_COLORS[msg.mood] && (
                        <div className="mt-1">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${MOOD_COLORS[msg.mood].bg} ${MOOD_COLORS[msg.mood].text}`}>
                            {MOOD_COLORS[msg.mood].label}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isSending && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm">
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          </div>

          {/* Input */}
          <div className="border-t bg-white p-4">
            <div className="mx-auto flex max-w-2xl gap-2">
              <Textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="输入回复，作为理财经理与客户沟通..."
                rows={2}
                className="resize-none"
                disabled={isSending || !!evaluation}
              />
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim() || isSending || !!evaluation}
                size="icon"
                className="h-auto shrink-0 self-end"
              >
                {isSending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Right panel - 配置方案工具 */}
        <div className="flex w-[280px] shrink-0 flex-col border-l bg-white">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Settings className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold">配置方案工具</span>
          </div>
          <div className="min-h-0 flex-1">
            <ScrollArea className="h-full">
              <div className="p-4">
                {allocations.length > 0 ? (
                <div className="space-y-5">
                  {allocations.map((section, sIdx) => {
                    const sectionTotal = section.items.reduce(
                      (sum, item) => sum + item.value,
                      0
                    );
                    return (
                      <div key={sIdx}>
                        <div className="mb-3 flex items-center justify-between">
                          <h4 className="flex items-center gap-1.5 text-sm font-medium">
                            <BarChart3 className="size-3.5" />
                            {section.label} (%)
                          </h4>
                          <Badge
                            variant={sectionTotal === 100 ? "default" : "destructive"}
                            className="text-[10px]"
                          >
                            {sectionTotal}%
                          </Badge>
                        </div>
                        <div className="space-y-4">
                          {section.items.map((item, iIdx) => (
                            <div key={iIdx}>
                              <div className="mb-1 flex items-center justify-between text-sm">
                                <span>{item.label}</span>
                                <span className="font-mono text-muted-foreground">
                                  {item.value}%
                                </span>
                              </div>
                              <Slider
                                value={[item.value]}
                                onValueChange={([val]) =>
                                  handleAllocationChange(sIdx, iIdx, val)
                                }
                                min={0}
                                max={100}
                                step={1}
                                disabled={!!evaluation}
                              />
                            </div>
                          ))}
                        </div>
                        {sIdx < allocations.length - 1 && (
                          <Separator className="mt-4" />
                        )}
                      </div>
                    );
                  })}

                  <Button
                    onClick={handleSubmitAllocation}
                    disabled={
                      allocationSubmitCount >= maxSubmissions || !!evaluation
                    }
                    className="w-full"
                    variant="outline"
                  >
                    提交完整方案 ({allocationSubmitCount}/{maxSubmissions})
                  </Button>

                  <p className="text-center text-xs text-muted-foreground">
                    提示：配置方案提交后将由 AI 客户评估。
                  </p>
                </div>
              ) : (
                <p className="text-center text-sm text-muted-foreground">
                  此任务无需资产配置
                </p>
              )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>

      {/* Study Buddy floating button */}
      <StudyBuddyPanel taskId={taskId} taskInstanceId={taskInstanceId} />
    </div>
  );
}
