"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb } from "lucide-react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";

export interface MasteryReportPoint {
  tag: string;
  ability: number;
  confidence: number;
  questionsAnswered: number;
  classification: "薄弱" | "一般" | "掌握";
}

export interface MasteryReport {
  totalQuestions: number;
  correctCount: number;
  knowledgePoints: MasteryReportPoint[];
  weakestTopics: string[];
  recommendation: string;
}

interface Props {
  report: MasteryReport;
}

const CLASSIFICATION_COLOR: Record<MasteryReportPoint["classification"], string> = {
  薄弱: "bg-danger-soft text-danger border-danger/20",
  一般: "bg-warn-soft text-warn border-warn/20",
  掌握: "bg-success-soft text-success border-success/20",
};

export function QuizMasteryReport({ report }: Props) {
  const chartData = report.knowledgePoints.map((kp) => ({
    subject: kp.tag,
    ability: Math.round(kp.ability * 100),
    fullMark: 100,
  }));

  // 雷达图 ≥3 点才好看；2 点退化成线，1 点退化成 dot — 数据少时显示条状图代替
  const useRadar = chartData.length >= 3;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="size-4 text-ochre" />
          薄弱知识点报告
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px] text-ink-3">
          <span>
            本次答题 <b className="text-ink">{report.totalQuestions}</b> 题
          </span>
          <span className="text-ink-5">·</span>
          <span>
            答对 <b className="text-ink">{report.correctCount}</b> 题
          </span>
          <span className="text-ink-5">·</span>
          <span>诊断 {report.knowledgePoints.length} 个知识点</span>
        </div>

        {useRadar ? (
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={chartData} margin={{ top: 12, right: 18, bottom: 12, left: 18 }}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar
                  name="掌握度"
                  dataKey="ability"
                  stroke="hsl(var(--brand))"
                  fill="hsl(var(--brand))"
                  fillOpacity={0.4}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="space-y-2">
            {report.knowledgePoints.map((kp) => (
              <div key={kp.tag} className="rounded-md border border-line p-2.5">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-medium text-ink-2">{kp.tag}</span>
                  <span className="font-mono text-ink-3">
                    {Math.round(kp.ability * 100)}%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-sm bg-line-2">
                  <div
                    className="h-full rounded-sm bg-brand"
                    style={{ width: `${Math.round(kp.ability * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div>
          <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-ink-5">
            各知识点详情
          </div>
          <ul className="grid gap-1.5 sm:grid-cols-2 md:grid-cols-3">
            {report.knowledgePoints.map((kp) => (
              <li
                key={kp.tag}
                className="flex items-center justify-between gap-2 rounded-md border border-line bg-paper p-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-ink-2">
                    {kp.tag}
                  </div>
                  <div className="text-[10.5px] text-ink-5">
                    答 {kp.questionsAnswered} 题 · 置信度{" "}
                    {Math.round(kp.confidence * 100)}%
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10.5px] ${CLASSIFICATION_COLOR[kp.classification]}`}
                >
                  {kp.classification}
                </Badge>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-md bg-ochre-soft p-3 text-[12.5px] leading-relaxed text-ink-2">
          <span className="font-semibold">学习建议：</span>
          {report.recommendation}
        </div>
      </CardContent>
    </Card>
  );
}
