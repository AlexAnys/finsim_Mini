import { MessageSquare, HelpCircle, FileText, type LucideIcon } from "lucide-react";

export type TaskType = "simulation" | "quiz" | "subjective";

export interface WizardStep {
  id: number;
  label: string;
  desc: string;
}

export const WIZARD_STEPS: WizardStep[] = [
  { id: 0, label: "任务类型", desc: "选择要出的是哪种题" },
  { id: 1, label: "基本信息", desc: "名称、说明、时长" },
  { id: 2, label: "任务配置", desc: "根据类型填写内容" },
  { id: 3, label: "预览并创建", desc: "确认后提交" },
];

export interface TaskTypeMeta {
  label: string;
  en: string;
  icon: LucideIcon;
  softClass: string;
  textClass: string;
  borderClass: string;
  bgClass: string;
  desc: string;
  stats: string[];
  time: string;
}

export const TASK_TYPE_META: Record<TaskType, TaskTypeMeta> = {
  simulation: {
    label: "模拟对话",
    en: "SIMULATION",
    icon: MessageSquare,
    softClass: "bg-sim-soft",
    textClass: "text-sim",
    borderClass: "border-sim",
    bgClass: "bg-sim",
    desc: "学生扮演理财顾问，与 AI 客户多轮对话。",
    stats: ["多轮对话 · AI 客户", "评分标准 + 资产配置表", "支持评估回执 + 学习伙伴答疑"],
    time: "建议 20–30 分钟",
  },
  quiz: {
    label: "测验",
    en: "QUIZ",
    icon: HelpCircle,
    softClass: "bg-quiz-soft",
    textClass: "text-quiz",
    borderClass: "border-quiz",
    bgClass: "bg-quiz",
    desc: "单选 / 多选 / 判断 / 简答，支持 AI 一键出题。",
    stats: ["4 种题型", "AI 批量出题", "固定 / 自适应两种模式"],
    time: "建议 10–20 分钟",
  },
  subjective: {
    label: "主观题",
    en: "SUBJECTIVE",
    icon: FileText,
    softClass: "bg-subj-soft",
    textClass: "text-subj",
    borderClass: "border-subj",
    bgClass: "bg-subj",
    desc: "开放式问答 / 报告撰写 / 附件提交。教师主批。",
    stats: ["AI 建议评分", "附件支持", "字数限制 + 评分标准"],
    time: "建议 30–60 分钟",
  },
};
