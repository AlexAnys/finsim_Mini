"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  RotateCcw,
  Check,
  ChevronRight,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { RunnerTopbar } from "@/components/runner/runner-topbar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  type MoodType,
  type TranscriptMessage,
  type SimulationEvaluation,
  type AssetAllocation,
} from "@/lib/types";

// PR-7C: snapshot of an allocation at a point in time
interface AllocationSnapshot {
  turn: number;
  ts: string;
  allocations: Array<{ label: string; value: number }>;
}
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

// 8-band mood ramp (PR-7B: AI now returns 8 archetype labels via JSON).
// Order matches the bandIndex used by MOOD_COLORS — visual position == mood gravity.
const MOOD_BANDS: { key: MoodType; label: string; tone: "good" | "warn" | "bad" | "neutral" }[] = [
  { key: "HAPPY", label: "平静", tone: "good" },
  { key: "RELAXED", label: "放松", tone: "good" },
  { key: "EXCITED", label: "兴奋", tone: "good" },
  { key: "NEUTRAL", label: "犹豫", tone: "neutral" },
  { key: "SKEPTICAL", label: "怀疑", tone: "warn" },
  { key: "CONFUSED", label: "略焦虑", tone: "warn" },
  { key: "ANGRY", label: "焦虑", tone: "bad" },
  { key: "DISAPPOINTED", label: "失望", tone: "bad" },
];

const MOOD_COLORS: Record<MoodType, { bg: string; text: string; label: string; bandIndex: number; tone: "good" | "warn" | "bad" | "neutral" }> = {
  HAPPY: { bg: "bg-green-100", text: "text-green-700", label: "平静", bandIndex: 0, tone: "good" },
  RELAXED: { bg: "bg-green-100", text: "text-green-700", label: "放松", bandIndex: 1, tone: "good" },
  EXCITED: { bg: "bg-green-100", text: "text-green-800", label: "兴奋", bandIndex: 2, tone: "good" },
  NEUTRAL: { bg: "bg-slate-100", text: "text-slate-600", label: "犹豫", bandIndex: 3, tone: "neutral" },
  SKEPTICAL: { bg: "bg-yellow-100", text: "text-yellow-700", label: "怀疑", bandIndex: 4, tone: "warn" },
  CONFUSED: { bg: "bg-orange-100", text: "text-orange-700", label: "略焦虑", bandIndex: 5, tone: "warn" },
  ANGRY: { bg: "bg-red-100", text: "text-red-700", label: "焦虑", bandIndex: 6, tone: "bad" },
  DISAPPOINTED: { bg: "bg-red-100", text: "text-red-800", label: "失望", bandIndex: 7, tone: "bad" },
};

const DRAFT_KEY_PREFIX = "finsim_sim_draft_";

const DONUT_COLORS = [
  "#3b5a8c",
  "#5b7b9c",
  "#8a9aae",
  "#a67e64",
  "#6d5a7a",
  "#5b4fb8",
];

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
  // PR-FIX-3 C2: allocationSubmitCount 改为从 snapshots.length 派生
  // （之前刷新页面 setState(0) 重置但 snapshots 从 localStorage 恢复 → 可绕过 maxSubmissions 上限）。
  // PR-7C: per-student allocation snapshot history (persisted in localStorage,
  // submitted with the final Submission via assets.snapshots).
  const [snapshots, setSnapshots] = useState<AllocationSnapshot[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem(DRAFT_KEY_PREFIX + taskInstanceId);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.snapshots)) return parsed.snapshots;
      } catch {
        // fall through
      }
    }
    return [];
  });

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

  // Save draft (PR-7C: now includes snapshots)
  const saveDraft = useCallback(
    (
      msgs: TranscriptMessage[],
      moodVal: MoodType,
      allocs: AssetAllocation["sections"],
      snaps: AllocationSnapshot[]
    ) => {
      if (typeof window === "undefined") return;
      localStorage.setItem(
        DRAFT_KEY_PREFIX + taskInstanceId,
        JSON.stringify({
          messages: msgs,
          mood: moodVal,
          allocations: allocs,
          snapshots: snaps,
        })
      );
    },
    [taskInstanceId]
  );

  useEffect(() => {
    saveDraft(messages, mood, allocations, snapshots);
  }, [messages, mood, allocations, snapshots, saveDraft]);

  // PR-7B legacy fallback: still strip residual [MOOD: XXX] tag if a non-JSON
  // provider response slipped through (e.g. fallback path in chatReply). Modern
  // mood now arrives as a structured field from /api/ai/chat.
  function stripLegacyMoodTag(text: string): string {
    return text.replace(/\[(?:MOOD:\s*)?\w+\]\s*$/i, "").trim();
  }

  // Map AI's 8 Chinese mood labels → MoodType key. Defensive default = NEUTRAL.
  function moodKeyFromLabel(label?: string): MoodType {
    switch (label) {
      case "平静": return "HAPPY";
      case "放松": return "RELAXED";
      case "兴奋": return "EXCITED";
      case "犹豫": return "NEUTRAL";
      case "怀疑": return "SKEPTICAL";
      case "略焦虑": return "CONFUSED";
      case "焦虑": return "ANGRY";
      case "失望": return "DISAPPOINTED";
      default: return "NEUTRAL";
    }
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

    // PR-7B B3: turn index of the last AI hint emitted, used to space hints ≥3 turns apart
    let lastHintTurn: number | undefined;
    let runningStudentTurns = 0;
    for (const m of messages) {
      if (m.role === "student") runningStudentTurns++;
      if (m.role === "ai" && m.hint) lastHintTurn = runningStudentTurns;
    }

    const objectives = scoringCriteria.map((c) => c.label);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: updatedMessages.map(m => ({ role: m.role, text: m.text })),
          scenario,
          openingLine,
          systemPrompt,
          lastHintTurn,
          objectives,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error?.message || "AI 回复失败");
      }

      const data = await res.json();
      const payload = data.data || data;
      const rawReply: string = payload?.reply || "";
      const aiText = stripLegacyMoodTag(rawReply);

      // PR-7B: prefer structured mood field; fall back to NEUTRAL for legacy responses.
      const moodObj = payload?.mood as
        | { score: number; key?: string; label?: string }
        | undefined;
      const newMood: MoodType = moodObj
        ? moodKeyFromLabel(moodObj.label)
        : "NEUTRAL";
      const newMoodScore: number | undefined =
        typeof moodObj?.score === "number" ? moodObj.score : undefined;

      const aiHint: string | undefined =
        typeof payload?.hint === "string" && payload.hint.trim().length > 0
          ? payload.hint
          : undefined;

      const aiMsg: TranscriptMessage = {
        id: generateId(),
        role: "ai",
        text: aiText,
        timestamp: new Date().toISOString(),
        mood: newMood,
        moodScore: newMoodScore,
        hint: aiHint,
      };

      setMood(newMood);
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

  // Record allocation snapshot (PR-7C). Validates 100% per section, then
  // appends a {turn, ts, allocations: [{label, value}]} entry.
  function handleSubmitAllocation() {
    for (const section of allocations) {
      const total = section.items.reduce((sum, item) => sum + item.value, 0);
      if (total !== 100) {
        toast.error(`"${section.label}" 总计必须为 100%，当前为 ${total}%`);
        return;
      }
    }
    const turn = messages.filter((m) => m.role === "student").length;
    const flat = allocations.flatMap((s) =>
      s.items.map((it) => ({ label: it.label, value: it.value }))
    );
    setSnapshots((prev) => [
      ...prev,
      { turn, ts: new Date().toISOString(), allocations: flat },
    ]);
    // PR-FIX-3 C2: 计数从 snapshots.length 派生，不再独立维护 state
    toast.success("已记录当前配比");
  }

  // Reset allocation to defaults (visual-only convenience; doesn't touch submit count)
  function handleResetAllocation() {
    if (!allocationSections) return;
    setAllocations(
      allocationSections.map((s) => ({
        label: s.label,
        items: s.items.map((item) => ({
          label: item.label,
          value: item.defaultValue ?? 0,
        })),
      }))
    );
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
            assets:
              allocations.length > 0
                ? { sections: allocations, snapshots }
                : undefined,
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
          assets:
            allocations.length > 0
              ? { sections: allocations, snapshots }
              : undefined,
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
          assets:
            allocations.length > 0
              ? { sections: allocations, snapshots }
              : undefined,
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
    // PR-FIX-3 C2: setSnapshots([]) 间接重置计数（snapshots.length=0）
    setSnapshots([]);
    localStorage.removeItem(DRAFT_KEY_PREFIX + taskInstanceId);
  }

  function handleClose() {
    router.back();
  }

  const moodInfo = MOOD_COLORS[mood];
  const turns = messages.filter((m) => m.role === "student").length;

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
    <div
      className="flex h-screen flex-col"
      style={{ background: "var(--fs-bg)" }}
    >
      {/* Top bar */}
      <RunnerTopbar
        onBack={() => router.back()}
        title={taskName}
        subtitle={isPreview ? "模拟对话 · 预览模式" : "模拟对话"}
        metaSlots={
          <>
            <MoodMeter activeIndex={moodInfo.bandIndex} label={moodInfo.label} tone={moodInfo.tone} />
            <div
              className="flex items-center gap-3 pl-3 text-[11.5px] text-white/80"
              style={{ borderLeft: "1px solid rgba(255,255,255,0.15)" }}
            >
              <span className="inline-flex items-center gap-1.5">
                <MessageSquare size={11} />
                <b className="fs-num text-white">{turns}</b>
                <span className="text-white/60">轮</span>
              </span>
            </div>
          </>
        }
        actions={[
          {
            label: "重来",
            onClick: handleRedo,
            icon: RotateCcw,
            variant: "secondary",
          },
          {
            label: "结束对话",
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
        {/* Left rail · 280px */}
        <SimLeftRail
          scenario={scenario}
          requirements={requirements}
          scoringCriteria={scoringCriteria}
        />

        {/* Center · chat */}
        <SimChat
          messages={messages}
          isSending={isSending}
          inputValue={inputValue}
          setInputValue={setInputValue}
          onSend={handleSend}
          disabled={!!evaluation}
          messagesEndRef={messagesEndRef}
          scenario={scenario}
        />

        {/* Right · alloc */}
        <SimRightPanel
          allocations={allocations}
          maxSubmissions={maxSubmissions}
          submitCount={snapshots.length}
          snapshots={snapshots}
          disabled={!!evaluation}
          onChange={handleAllocationChange}
          onSubmit={handleSubmitAllocation}
          onReset={handleResetAllocation}
        />
      </div>

      {/* Study Buddy floating button */}
      <StudyBuddyPanel taskId={taskId} taskInstanceId={taskInstanceId} />
    </div>
  );
}

// ---------- Sub-components ----------

function MoodMeter({
  activeIndex,
  label,
  tone,
}: {
  activeIndex: number;
  label: string;
  tone: "good" | "warn" | "bad" | "neutral";
}) {
  const accent =
    tone === "good"
      ? "#51C08E"
      : tone === "warn"
        ? "#E6B34C"
        : tone === "bad"
          ? "#E07A5F"
          : "#9ca3af";
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full px-3 py-1"
      style={{ background: "rgba(255,255,255,0.08)" }}
      aria-label={`客户情绪 ${label}`}
    >
      <span className="text-[10.5px] font-semibold tracking-[1px] text-white/60">
        客户情绪
      </span>
      <span className="flex gap-[2px]" aria-hidden>
        {MOOD_BANDS.map((band, i) => {
          const active = i <= activeIndex;
          let bg = "rgba(255,255,255,0.2)";
          if (active) {
            if (band.tone === "good") bg = "#51C08E";
            else if (band.tone === "warn") bg = "#E6B34C";
            else if (band.tone === "bad") bg = "#E07A5F";
            else bg = "rgba(255,255,255,0.55)";
          }
          return (
            <span
              key={i}
              className="block h-1 w-4 rounded-[1px]"
              style={{ background: bg }}
            />
          );
        })}
      </span>
      <span
        className="text-[11.5px] font-semibold"
        style={{ color: accent }}
      >
        {label}
      </span>
    </div>
  );
}

function SimLeftRail({
  scenario,
  requirements,
  scoringCriteria,
}: {
  scenario: string;
  requirements?: string[];
  scoringCriteria: ScoringCriterion[];
}) {
  return (
    <aside
      className="flex w-[280px] shrink-0 flex-col"
      style={{
        background: "var(--fs-surface)",
        borderRight: "1px solid var(--fs-line)",
      }}
    >
      <ScrollArea className="h-full">
        {/* Scenario card */}
        <div
          className="px-[18px] py-5"
          style={{ borderBottom: "1px solid var(--fs-line-2)" }}
        >
          <div
            className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-[1px]"
            style={{ color: "var(--fs-ink-5)" }}
          >
            背景情景
          </div>
          <p
            className="whitespace-pre-wrap text-[12.5px] leading-[1.6]"
            style={{ color: "var(--fs-ink-3)" }}
          >
            {scenario}
          </p>
        </div>

        {/* Requirements / dialog goals */}
        {requirements && requirements.length > 0 && (
          <div
            className="px-[18px] py-4"
            style={{ borderBottom: "1px solid var(--fs-line-2)" }}
          >
            <div className="mb-2.5 flex items-center justify-between">
              <div
                className="text-[10.5px] font-semibold uppercase tracking-[1px]"
                style={{ color: "var(--fs-ink-5)" }}
              >
                对话目标
              </div>
              <span
                className="fs-num text-[10.5px]"
                style={{ color: "var(--fs-ink-5)" }}
              >
                {requirements.length} 条
              </span>
            </div>
            {requirements.map((req, i) => (
              <div
                key={i}
                className="mb-[3px] flex items-start gap-2 rounded-md px-2.5 py-2"
              >
                <span
                  className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full"
                  style={{ border: "1.5px solid var(--fs-line)" }}
                >
                  <span
                    className="block h-[5px] w-[5px] rounded-full"
                    style={{ background: "var(--fs-ink-5)" }}
                  />
                </span>
                <span
                  className="text-[12px] leading-[1.55]"
                  style={{ color: "var(--fs-ink-3)" }}
                >
                  {req}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Rubric reference */}
        <div className="px-[18px] py-4">
          <div
            className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-[1px]"
            style={{ color: "var(--fs-ink-5)" }}
          >
            评分对照
          </div>
          {scoringCriteria.map((c) => (
            <div
              key={c.id}
              className="mb-[3px] flex items-center justify-between rounded-md px-2.5 py-1.5"
            >
              <span
                className="inline-flex items-center gap-1.5 text-[12px]"
                style={{ color: "var(--fs-ink-3)" }}
              >
                <span
                  className="block h-2 w-2 rounded-full"
                  style={{ border: "1.5px solid var(--fs-line)" }}
                />
                {c.label}
              </span>
              <span
                className="fs-num text-[11px]"
                style={{ color: "var(--fs-ink-5)" }}
              >
                {c.maxScore} 分
              </span>
            </div>
          ))}
          <div
            className="mt-2.5 rounded-md px-2.5 py-2 text-[11px] leading-[1.5]"
            style={{ background: "var(--fs-bg-alt)", color: "var(--fs-ink-4)" }}
          >
            <Sparkles
              size={10}
              className="mr-1 inline align-[-1px]"
              style={{ color: "var(--fs-sim)" }}
            />
            这是引导你作答用的简要评分指引，最终分数以教师确认为准。
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}

function SimChat({
  messages,
  isSending,
  inputValue,
  setInputValue,
  onSend,
  disabled,
  messagesEndRef,
  scenario,
}: {
  messages: TranscriptMessage[];
  isSending: boolean;
  inputValue: string;
  setInputValue: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  scenario: string;
}) {
  return (
    <main
      className="flex min-w-0 flex-1 flex-col"
      style={{ background: "var(--fs-bg)" }}
    >
      {/* Messages */}
      <div className="min-h-0 flex-1">
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-4 px-10 py-6">
            {/* Scene callout */}
            <div
              className="rounded-[10px] px-4 py-3 text-center text-[12px] leading-[1.6]"
              style={{
                background: "var(--fs-surface)",
                border: "1px dashed var(--fs-line)",
                color: "var(--fs-ink-4)",
              }}
            >
              <span
                className="mr-1.5 rounded-[3px] px-2 py-0.5 text-[10px] font-bold tracking-[1px]"
                style={{ background: "var(--fs-ink)", color: "#fff" }}
              >
                场景
              </span>
              {scenario}
            </div>

            {messages.map((msg) => (
              <SimMsg key={msg.id} m={msg} />
            ))}

            {isSending && (
              <div className="flex justify-start gap-3">
                <div
                  className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-lg text-[13px] font-semibold text-white"
                  style={{ background: "linear-gradient(135deg, #3B5A8C, #5B7B9C)" }}
                >
                  客
                </div>
                <div
                  className="rounded-[14px] rounded-bl-[4px] px-4 py-3 shadow-sm"
                  style={{
                    background: "var(--fs-surface)",
                    border: "1px solid var(--fs-line)",
                  }}
                >
                  <Loader2
                    className="size-4 animate-spin"
                    style={{ color: "var(--fs-ink-5)" }}
                  />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Composer */}
      <div
        className="shrink-0 px-10 pb-6 pt-4"
        style={{
          background: "var(--fs-bg)",
          borderTop: "1px solid var(--fs-line-2)",
        }}
      >
        <div
          className="rounded-xl p-2.5"
          style={{
            background: "var(--fs-surface)",
            border: "1.5px solid var(--fs-line)",
            boxShadow: "var(--fs-shadow)",
          }}
        >
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder="继续对话…（Enter 发送，Shift + Enter 换行）"
            rows={3}
            disabled={isSending || disabled}
            className="resize-none border-none bg-transparent p-0 text-[13.5px] leading-[1.65] shadow-none focus-visible:ring-0"
          />
          <div
            className="mt-1 flex items-center justify-between pt-1.5"
            style={{ borderTop: "1px solid var(--fs-line-2)" }}
          >
            <div
              className="fs-num text-[11px]"
              style={{ color: "var(--fs-ink-5)" }}
            >
              字数{" "}
              <span style={{ color: "var(--fs-ink-3)" }}>{inputValue.length}</span>
            </div>
            <button
              type="button"
              onClick={onSend}
              disabled={!inputValue.trim() || isSending || disabled}
              className="inline-flex items-center gap-1 rounded-[7px] px-[18px] py-[7px] text-[12.5px] font-semibold transition disabled:cursor-not-allowed"
              style={{
                background: inputValue.trim() && !isSending && !disabled
                  ? "var(--fs-primary)"
                  : "var(--fs-bg-alt)",
                color: inputValue.trim() && !isSending && !disabled
                  ? "var(--fs-primary-fg)"
                  : "var(--fs-ink-5)",
              }}
            >
              {isSending ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <>
                  发送 <ChevronRight size={11} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function SimMsg({ m }: { m: TranscriptMessage }) {
  const isAI = m.role === "ai";
  const moodInfo = isAI && m.mood ? MOOD_COLORS[m.mood] : null;
  const time = new Date(m.timestamp).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div
      className={`flex items-start gap-3 ${isAI ? "" : "flex-row-reverse"}`}
    >
      <div
        className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-lg text-[13px] font-semibold text-white"
        style={{
          background: isAI
            ? "linear-gradient(135deg, #3B5A8C, #5B7B9C)"
            : "var(--fs-ink)",
        }}
      >
        {isAI ? "客" : "我"}
      </div>
      <div
        className={`flex max-w-[70%] flex-col ${isAI ? "items-start" : "items-end"}`}
      >
        <div
          className={`mb-1 flex items-center gap-2 ${isAI ? "" : "flex-row-reverse"}`}
        >
          <span
            className="text-[11.5px] font-semibold"
            style={{ color: "var(--fs-ink-3)" }}
          >
            {isAI ? "客户" : "你（理财顾问）"}
          </span>
          <span
            className="fs-num text-[10.5px]"
            style={{ color: "var(--fs-ink-5)" }}
          >
            {time}
          </span>
        </div>
        <div
          className="px-3.5 py-2.5 text-[13.5px] leading-[1.7]"
          style={{
            borderRadius: isAI ? "4px 14px 14px 14px" : "14px 4px 14px 14px",
            background: isAI ? "var(--fs-surface)" : "var(--fs-ink)",
            color: isAI ? "var(--fs-ink-2)" : "#fff",
            border: isAI ? "1px solid var(--fs-line)" : "none",
            boxShadow: isAI ? "var(--fs-shadow)" : "0 2px 6px rgba(15,22,35,0.08)",
          }}
        >
          <p className="whitespace-pre-wrap">{m.text}</p>
        </div>

        {/* Mood chip below AI message */}
        {moodInfo && (
          <div
            className="mt-1.5 inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10.5px] font-medium"
            style={{
              background:
                moodInfo.tone === "good"
                  ? "var(--fs-success-soft)"
                  : moodInfo.tone === "warn"
                    ? "var(--fs-warn-soft)"
                    : moodInfo.tone === "bad"
                      ? "var(--fs-danger-soft)"
                      : "var(--fs-bg-alt)",
              color:
                moodInfo.tone === "good"
                  ? "var(--fs-success-deep)"
                  : moodInfo.tone === "warn"
                    ? "var(--fs-warn)"
                    : moodInfo.tone === "bad"
                      ? "var(--fs-danger)"
                      : "var(--fs-ink-4)",
            }}
          >
            <span aria-hidden>●</span>
            <span>情绪 {moodInfo.label}</span>
          </div>
        )}

        {/* PR-7B: Socratic hint from learning buddy — surfaced when student perf low or off-track */}
        {isAI && m.hint && (
          <div
            className="mt-1.5 flex items-center gap-1.5 rounded-r-md px-2.5 py-1.5 text-[11px]"
            style={{
              background: "var(--fs-sim-soft)",
              borderLeft: "3px solid var(--fs-sim)",
              color: "var(--fs-ink-3)",
            }}
          >
            <Sparkles size={10} style={{ color: "var(--fs-sim)" }} />
            <span>学习伙伴：{m.hint}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SimRightPanel({
  allocations,
  maxSubmissions,
  submitCount,
  snapshots,
  disabled,
  onChange,
  onSubmit,
  onReset,
}: {
  allocations: AssetAllocation["sections"];
  maxSubmissions: number;
  submitCount: number;
  snapshots: AllocationSnapshot[];
  disabled: boolean;
  onChange: (s: number, i: number, v: number) => void;
  onSubmit: () => void;
  onReset: () => void;
}) {
  if (allocations.length === 0) {
    return (
      <aside
        className="flex w-[320px] shrink-0 flex-col"
        style={{
          background: "var(--fs-surface)",
          borderLeft: "1px solid var(--fs-line)",
        }}
      >
        <div
          className="px-[18px] py-3.5"
          style={{ borderBottom: "1px solid var(--fs-line-2)" }}
        >
          <div
            className="text-[13px] font-semibold"
            style={{ color: "var(--fs-ink)" }}
          >
            为客户配资产
          </div>
        </div>
        <p
          className="px-[18px] py-6 text-center text-[12px]"
          style={{ color: "var(--fs-ink-5)" }}
        >
          此任务无需资产配置
        </p>
      </aside>
    );
  }

  // Use first section as primary allocation surface; sum across all sections kept for compat.
  const flatItems = allocations.flatMap((s, sIdx) =>
    s.items.map((it, iIdx) => ({
      ...it,
      sectionIdx: sIdx,
      itemIdx: iIdx,
      sectionLabel: s.label,
      color: DONUT_COLORS[(sIdx * 10 + iIdx) % DONUT_COLORS.length],
    }))
  );
  const totalSum = flatItems.reduce((s, a) => s + a.value, 0);
  const balanced = totalSum === 100;

  return (
    <aside
      className="flex w-[320px] shrink-0 flex-col"
      style={{
        background: "var(--fs-surface)",
        borderLeft: "1px solid var(--fs-line)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-[18px] py-3.5"
        style={{ borderBottom: "1px solid var(--fs-line-2)" }}
      >
        <div>
          <div
            className="text-[13px] font-semibold"
            style={{ color: "var(--fs-ink)" }}
          >
            为客户配资产
          </div>
          <div
            className="mt-0.5 text-[11px]"
            style={{ color: "var(--fs-ink-5)" }}
          >
            随对话实时调整，教师会看到最终配比
          </div>
        </div>
        <span
          className="fs-num rounded-[4px] px-2 py-0.5 text-[10.5px] font-bold tracking-[0.5px]"
          style={{
            background: balanced ? "var(--fs-success-soft)" : "var(--fs-warn-soft)",
            color: balanced ? "var(--fs-success-deep)" : "var(--fs-warn)",
          }}
        >
          合计 {totalSum}%
        </span>
      </div>

      <ScrollArea className="flex-1">
        {/* Donut */}
        <div
          className="px-[18px] py-[18px]"
          style={{ borderBottom: "1px solid var(--fs-line-2)" }}
        >
          <SimDonut items={flatItems} totalSum={totalSum} />
        </div>

        {/* Sliders */}
        <div className="px-[18px] py-3">
          {flatItems.map((it) => (
            <SimSlider
              key={`${it.sectionIdx}-${it.itemIdx}`}
              label={it.label}
              value={it.value}
              color={it.color}
              disabled={disabled}
              onChange={(v) => onChange(it.sectionIdx, it.itemIdx, v)}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Footer actions */}
      <div
        className="px-[18px] py-3"
        style={{
          borderTop: "1px solid var(--fs-line-2)",
          background: "var(--fs-bg-alt)",
        }}
      >
        {snapshots.length > 0 && (
          <div
            className="mb-2 rounded-md px-2.5 py-1.5 text-[11px] leading-[1.45]"
            style={{
              background: "var(--fs-success-soft)",
              border: "1px solid var(--fs-line)",
              color: "var(--fs-success-deep)",
            }}
          >
            <b>已记录 {snapshots.length} 次配比</b>
            <span className="ml-1.5 text-[10.5px] opacity-80">
              最近：第 {snapshots[snapshots.length - 1].turn} 轮
            </span>
          </div>
        )}
        <div
          className="mb-2.5 rounded-md px-2.5 py-2 text-[11px] leading-[1.5]"
          style={{
            background: "var(--fs-surface)",
            border: "1px solid var(--fs-line)",
            color: "var(--fs-ink-4)",
          }}
        >
          <b style={{ color: "var(--fs-sim)" }}>提示：</b>
          请根据对话中获取的客户偏好与风险承受能力调整配比。
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={onReset}
            disabled={disabled}
            className="flex-1 rounded-md py-2 text-[11.5px] font-medium transition disabled:opacity-50"
            style={{
              background: "var(--fs-surface)",
              border: "1px solid var(--fs-line)",
              color: "var(--fs-ink-3)",
            }}
          >
            重置
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={disabled || submitCount >= maxSubmissions}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-md py-2 text-[11.5px] font-semibold transition disabled:opacity-50"
            style={{ background: "var(--fs-ink)", color: "#fff" }}
          >
            <Check size={11} />
            记录当前配比 ({submitCount}/{maxSubmissions})
          </button>
        </div>
      </div>
    </aside>
  );
}

function SimSlider({
  label,
  value,
  color,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  color: string;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mb-3.5">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className="block h-2 w-2 shrink-0 rounded-[2px]"
            style={{ background: color }}
          />
          <span
            className="text-[12px] font-medium"
            style={{ color: "var(--fs-ink-2)" }}
          >
            {label}
          </span>
        </div>
        <span
          className="fs-num text-[12px] font-semibold"
          style={{ color: "var(--fs-ink)" }}
        >
          {value}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(+e.target.value)}
        className="h-[5px] w-full cursor-pointer appearance-none rounded-[3px] outline-none disabled:cursor-not-allowed"
        style={{
          background: `linear-gradient(to right, ${color} 0%, ${color} ${value}%, var(--fs-line-2) ${value}%, var(--fs-line-2) 100%)`,
        }}
        aria-label={`${label} 配比`}
      />
    </div>
  );
}

function SimDonut({
  items,
  totalSum,
}: {
  items: Array<{ label: string; value: number; color: string }>;
  totalSum: number;
}) {
  const total = totalSum || 1;
  const size = 160;
  const r = 55;
  const cx = size / 2;
  const cy = size / 2;

  // Pre-compute prefix sums so .map() stays pure (no mid-render mutation).
  const prefixStarts: number[] = [];
  let running = 0;
  for (const it of items) {
    prefixStarts.push(running);
    running += it.value;
  }

  return (
    <div className="flex items-center gap-4">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-[120px] w-[120px] shrink-0"
        aria-label="资产配比图"
      >
        {items.map((a, i) => {
          if (a.value === 0) return null;
          const accStart = prefixStarts[i];
          const accEnd = accStart + a.value;
          const startAng = (accStart / total) * 2 * Math.PI - Math.PI / 2;
          const endAng = (accEnd / total) * 2 * Math.PI - Math.PI / 2;
          const x1 = cx + r * Math.cos(startAng);
          const y1 = cy + r * Math.sin(startAng);
          const x2 = cx + r * Math.cos(endAng);
          const y2 = cy + r * Math.sin(endAng);
          const large = a.value / total > 0.5 ? 1 : 0;
          return (
            <path
              key={i}
              d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`}
              fill={a.color}
              opacity={0.9}
            />
          );
        })}
        <circle cx={cx} cy={cy} r={32} fill="var(--fs-surface)" />
        <text
          x={cx}
          y={cy - 2}
          fontSize="10.5"
          fill="var(--fs-ink-5)"
          textAnchor="middle"
        >
          当前
        </text>
        <text
          x={cx}
          y={cy + 12}
          fontSize="14"
          fontWeight="700"
          fill="var(--fs-ink)"
          textAnchor="middle"
          className="fs-num"
        >
          {totalSum}%
        </text>
      </svg>
      <div className="flex flex-1 flex-col gap-1">
        {items.map((a, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 text-[10.5px]"
          >
            <span
              className="block h-2 w-2 shrink-0 rounded-[2px]"
              style={{ background: a.color }}
            />
            <span
              className="flex-1 truncate"
              style={{ color: "var(--fs-ink-4)" }}
            >
              {a.label}
            </span>
            <span
              className="fs-num font-semibold"
              style={{ color: "var(--fs-ink-3)" }}
            >
              {a.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
