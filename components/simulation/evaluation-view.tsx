"use client";

import {
  CheckCircle,
  RotateCcw,
  X,
  Trophy,
  BarChart3,
  MessageSquare,
  Award,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  type SimulationEvaluation,
  type AssetAllocation,
  type TranscriptMessage,
} from "@/lib/types";
import Link from "next/link";

interface ScoringCriterion {
  id: string;
  label: string;
  maxScore: number;
  description?: string;
}

interface EvaluationViewProps {
  evaluation: SimulationEvaluation;
  allocations: AssetAllocation["sections"];
  messages: TranscriptMessage[];
  scoringCriteria: ScoringCriterion[];
  onSubmit: () => void;
  onRedo: () => void;
  onClose: () => void;
  isSubmitting: boolean;
  submitted: boolean;
  isPreview?: boolean;
}

function getScoreColor(score: number, max: number) {
  const pct = (score / max) * 100;
  if (pct >= 90) return { text: "text-green-600", bg: "bg-green-100", bar: "bg-green-500" };
  if (pct >= 70) return { text: "text-blue-600", bg: "bg-blue-100", bar: "bg-blue-500" };
  if (pct >= 50) return { text: "text-orange-600", bg: "bg-orange-100", bar: "bg-orange-500" };
  return { text: "text-red-600", bg: "bg-red-100", bar: "bg-red-500" };
}

export function EvaluationView({
  evaluation,
  allocations,
  messages,
  scoringCriteria,
  onSubmit,
  onRedo,
  onClose,
  isSubmitting,
  submitted,
  isPreview,
}: EvaluationViewProps) {
  const scoreColor = getScoreColor(evaluation.totalScore, evaluation.maxScore);

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-white px-6 py-4 shadow-sm">
        <h1 className="text-lg font-bold">成绩详情</h1>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="size-5" />
        </Button>
      </div>

      {/* Scrollable content */}
      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-3xl space-y-6 p-6">
          {/* Score card */}
          <Card>
            <CardContent className="flex items-center justify-between py-6">
              <div>
                <p className="text-sm text-muted-foreground">最终得分</p>
                <p className={`text-4xl font-bold ${scoreColor.text}`}>
                  {evaluation.totalScore}{" "}
                  <span className="text-lg font-normal text-muted-foreground">
                    / {evaluation.maxScore}
                  </span>
                </p>
              </div>
              <div
                className={`flex size-16 items-center justify-center rounded-full ${scoreColor.bg}`}
              >
                <Trophy className={`size-8 ${scoreColor.text}`} />
              </div>
            </CardContent>
          </Card>

          {/* Allocation summary */}
          {allocations.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="size-4" />
                  资产配置方案 (%)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {allocations.map((section, sIdx) => (
                  <div key={sIdx} className="mb-4 last:mb-0">
                    <p className="mb-2 text-sm font-medium">{section.label}</p>
                    <div className="grid grid-cols-3 gap-4">
                      {section.items.map((item, iIdx) => (
                        <div
                          key={iIdx}
                          className="rounded-lg border p-3 text-center"
                        >
                          <p className="text-xs text-muted-foreground">
                            {item.label}
                          </p>
                          <p className="mt-1 text-lg font-semibold">
                            {item.value}%
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Feedback */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Award className="size-4" />
                综合评语
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                {evaluation.feedback}
              </p>
            </CardContent>
          </Card>

          {/* Rubric breakdown */}
          {evaluation.rubricBreakdown && evaluation.rubricBreakdown.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="size-4" />
                  单项得分
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {evaluation.rubricBreakdown.map((rb) => {
                  const criterion = scoringCriteria.find(
                    (c) => c.id === rb.criterionId
                  );
                  const itemColor = getScoreColor(rb.score, rb.maxScore);
                  const pct = rb.maxScore > 0 ? (rb.score / rb.maxScore) * 100 : 0;

                  return (
                    <div key={rb.criterionId} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {criterion?.label || rb.criterionId}
                        </span>
                        <Badge variant="outline" className={itemColor.text}>
                          {rb.score} / {rb.maxScore}
                        </Badge>
                      </div>
                      <Progress value={pct} className="h-2" />
                      {rb.comment && (
                        <p className="text-xs text-muted-foreground">
                          {rb.comment}
                        </p>
                      )}
                      {criterion?.description && (
                        <p className="text-xs text-muted-foreground/70">
                          {criterion.description}
                        </p>
                      )}
                      <Separator />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Conversation transcript */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="size-4" />
                完整对话记录
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.role === "student" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                      msg.role === "student"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted rounded-bl-md"
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
                      {msg.role === "student" ? "你" : "AI 客户"} -{" "}
                      {new Date(msg.timestamp).toLocaleTimeString("zh-CN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pb-6">
            {isPreview ? (
              <Button onClick={onClose}>
                <ArrowLeft className="mr-1 size-4" />
                返回
              </Button>
            ) : submitted ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="size-5" />
                  <span className="font-medium">已成功提交</span>
                </div>
                <Button asChild>
                  <Link href="/dashboard">
                    <ArrowLeft className="mr-1 size-4" />
                    返回仪表盘
                  </Link>
                </Button>
              </div>
            ) : (
              <>
                <Button onClick={onSubmit} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      提交中...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="size-4" />
                      提交
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={onRedo}>
                  <RotateCcw className="size-4" />
                  重做
                </Button>
                <Button variant="ghost" onClick={onClose}>
                  关闭
                </Button>
              </>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
