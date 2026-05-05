/**
 * 题库 Regex 直抽（结构化解析）
 *
 * 当 OCR / 文本提取后的内容已经是结构化题库时，直接用规则解析切题，
 * 不必经过 AI。覆盖中文题库 80% 常见格式：标号式、题型标记、Markdown、
 * Q/A 段落、判断题。AI 仅作 fallback / 补刀。
 *
 * 纯函数：parseStructuredQuestionBank(text) -> { questions, confidence, unparsedTail }
 * 不依赖 prisma / AI，方便单测。
 */
import { z } from "zod";

export type ParsedQuestionType =
  | "single_choice"
  | "multiple_choice"
  | "true_false"
  | "short_answer";

export interface ParsedQuestion {
  type: ParsedQuestionType;
  prompt: string;
  options: Array<{ id: string; text: string }>;
  correctOptionIds: string[];
  correctAnswer: string;
  explanation: string;
  /** 0-1 该题解析置信度 */
  confidence: number;
  /** 触发的告警标签：缺答案 / 缺解析 / 选项<2 等 */
  issues: string[];
  /** 原始题块文本（供调试 + AI 兜底） */
  raw: string;
}

export interface RegexParseResult {
  questions: ParsedQuestion[];
  /** 0-1 整体置信度（题数加权） */
  overallConfidence: number;
  /** 没能识别为题块的剩余文本（可交给 AI 补刀） */
  unparsedTail: string;
  /** 总解析耗时（ms） */
  durationMs: number;
}

const TYPE_LABELS: Record<string, ParsedQuestionType> = {
  单选: "single_choice",
  单选题: "single_choice",
  单项选择: "single_choice",
  单项选择题: "single_choice",
  多选: "multiple_choice",
  多选题: "multiple_choice",
  多项选择: "multiple_choice",
  多项选择题: "multiple_choice",
  判断: "true_false",
  判断题: "true_false",
  正误: "true_false",
  简答: "short_answer",
  简答题: "short_answer",
  问答: "short_answer",
  问答题: "short_answer",
  论述: "short_answer",
  论述题: "short_answer",
};

/**
 * 主入口：扫描整段文本，切出题目块，逐题解析。
 */
export function parseStructuredQuestionBank(rawText: string): RegexParseResult {
  const start = Date.now();
  const text = normalize(rawText);
  if (!text) {
    return { questions: [], overallConfidence: 0, unparsedTail: "", durationMs: 0 };
  }

  const blocks = splitIntoQuestionBlocks(text);
  const questions: ParsedQuestion[] = [];
  const unparsed: string[] = [];

  for (const block of blocks) {
    const parsed = parseSingleQuestion(block);
    if (parsed) {
      questions.push(parsed);
    } else if (block.trim().length > 0) {
      unparsed.push(block);
    }
  }

  const overall =
    questions.length === 0
      ? 0
      : questions.reduce((sum, q) => sum + q.confidence, 0) / questions.length;

  return {
    questions,
    overallConfidence: Number(overall.toFixed(3)),
    unparsedTail: unparsed.join("\n\n").trim(),
    durationMs: Date.now() - start,
  };
}

// ============================================
// Helpers
// ============================================

/** 全角→半角（限定不会破坏题干语义）+ 空白标准化 + 删 OCR 噪声页眉页脚 */
export function normalize(text: string): string {
  if (!text) return "";
  let out = text;
  // 全角括号、全角冒号、全角问号 → 半角（影响 regex 锚点的标点）
  // 注意：不动 `、` `，` `。` —— 中文题号 `1、` 是结构信号，不能转 `.`
  out = out
    .replace(/【/g, "[")
    .replace(/】/g, "]")
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/：/g, ":")
    .replace(/？/g, "?");
  // 移除典型页脚 / 页码：[第 X 页] / [Page X] / -- 1 of 5 -- / 第 X 页共 Y 页
  out = out
    .replace(/\[第\s*\d+\s*页\]/g, "")
    .replace(/\[Page\s*\d+\]/gi, "")
    .replace(/^\s*--\s*\d+\s+of\s+\d+\s*--\s*$/gim, "")
    .replace(/^\s*第\s*\d+\s*页\s*共\s*\d+\s*页\s*$/gm, "")
    .replace(/^\s*-\s*\d+\s*-\s*$/gm, "");
  // 标准化换行
  out = out.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // 多空行压缩为 2 行
  out = out.replace(/\n{3,}/g, "\n\n");
  // 行尾空白
  out = out
    .split("\n")
    .map((l) => l.replace(/[\t ]+$/g, ""))
    .join("\n")
    .trim();
  return out;
}

/**
 * 切分题目块。识别多种"题号 / 题型起始符"作分隔锚点。
 *
 * 策略：扫描行，以「题号锚点行」开头作为新题块起点。
 *   - "1." / "1、" / "(1)" / "1)" / "第 1 题" / "[单选]" / "### " / "Q1:"
 */
function splitIntoQuestionBlocks(text: string): string[] {
  const lines = text.split("\n");
  const blocks: string[] = [];
  let current: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isQuestionStartAnchor(line)) {
      if (current.length > 0) {
        blocks.push(current.join("\n").trim());
        current = [];
      }
    }
    current.push(line);
  }
  if (current.length > 0) {
    blocks.push(current.join("\n").trim());
  }
  return blocks.filter((b) => b.length > 0);
}

/** 识别「这一行像题目起始」 — 不识别 (1) (2) 形式以避免误吞简答题答案的项目编号 */
function isQuestionStartAnchor(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  // 1. "1. " / "1、" / "1)"  题号 — 但不接 A-H（防选项行被误判）
  if (/^\d+\s*[.、)]\s*\S/.test(trimmed) && !/^\d+\s*[.、)]\s*[A-Ha-h]\b/.test(trimmed)) {
    return true;
  }
  // 2. 第 X 题
  if (/^第\s*\d+\s*题/.test(trimmed)) return true;
  // 3. [单选] / [多选] / [判断] / [简答]
  if (/^\[(单选|单选题|多选|多选题|判断|判断题|简答|简答题|问答|问答题|论述|论述题)\]/.test(trimmed)) {
    return true;
  }
  // 4. Markdown header: ### / ## / # 题目
  if (/^#{1,6}\s+(?:题目\s*)?\d+/.test(trimmed)) return true;
  // 5. Q1: / Q1. / Q.1
  if (/^Q\.?\s*\d+\s*[:.、]/i.test(trimmed)) return true;
  return false;
}

/** 解析单个题块 → ParsedQuestion 或 null */
function parseSingleQuestion(block: string): ParsedQuestion | null {
  const lines = block.split("\n");
  if (lines.length === 0) return null;

  // 不是题号锚点行起始 → 不算题（过滤掉文档标题、说明文字等噪声前缀块）
  // 跳过空行后找第一个非空行
  const firstNonEmpty = lines.find((l) => l.trim().length > 0) ?? "";
  if (!isQuestionStartAnchor(firstNonEmpty)) return null;

  // 第 1 步：判定显式题型（标记 / 题干末尾标注）
  const explicitType = detectExplicitType(block);
  // 第 2 步：抽 prompt
  const prompt = extractPrompt(lines);
  if (!prompt) return null;

  // 第 3 步：抽选项
  const options = extractOptions(lines);

  // 第 4 步：抽答案 + 解析
  const answer = extractAnswer(block);
  const explanation = extractExplanation(block);

  // 题型推断
  let type: ParsedQuestionType = explicitType ?? "single_choice";
  if (!explicitType) {
    // 优先级 1：选项里就是「正确/错误」二选一 → 判断题
    if (options.length === 2 && /^(对|错|正确|错误|true|false|t|f)$/i.test(options[0]?.text ?? "")) {
      type = "true_false";
    }
    // 优先级 2：无选项 + 答案是布尔词 → 判断题（这是真实 PDF 的常见格式）
    // 中文 \b 不工作，改用：要么是单独的布尔词（短文本 ≤ 4 字符），要么以布尔词开头紧跟标点/空白
    else if (options.length === 0 && !answer.optionIds.length && isBooleanAnswer(answer.text)) {
      type = "true_false";
    }
    // 优先级 3：无选项 → 简答 / 填空（题干含下划线）
    else if (options.length === 0) {
      type = "short_answer";
    }
    // 优先级 4：选项 ≥ 2 + 答案是多个字母 → 多选
    else if (Array.isArray(answer.optionIds) && answer.optionIds.length > 1) {
      type = "multiple_choice";
    }
    // 否则单选
  }

  // 判断题特殊归一化
  let normalizedOptions = options;
  let correctOptionIds = answer.optionIds;
  let correctAnswer = answer.text;
  if (type === "true_false") {
    normalizedOptions = [
      { id: "A", text: "正确" },
      { id: "B", text: "错误" },
    ];
    const ans = answer.text.trim();
    if (/^(?:对|正确|true|t)(?:[\s,，。.!！?？]|$)/i.test(ans)) {
      correctOptionIds = ["A"];
      correctAnswer = "";
    } else if (/^(?:错|错误|false|f)(?:[\s,，。.!！?？]|$)/i.test(ans)) {
      correctOptionIds = ["B"];
      correctAnswer = "";
    }
  }
  if (type === "short_answer") {
    normalizedOptions = [];
    correctOptionIds = [];
  }

  // confidence
  const issues: string[] = [];
  let confidence = 0.6;
  if (prompt.length >= 6) confidence += 0.1;
  if (type !== "short_answer" && normalizedOptions.length >= 2) confidence += 0.1;
  const hasAnswer =
    type === "short_answer"
      ? Boolean(correctAnswer.trim())
      : correctOptionIds.length > 0;
  if (hasAnswer) {
    confidence += 0.15;
  } else {
    issues.push("答案待确认");
  }
  if (explanation.trim()) confidence += 0.05;
  else issues.push("解析待确认");
  if (type !== "short_answer" && normalizedOptions.length < 2) {
    issues.push("选项不足 2 个");
    confidence -= 0.2;
  }

  confidence = Math.max(0, Math.min(1, confidence));
  // 缺答案的题不允许走自动导入；由老师人工确认。封顶 0.6 让 import 流程把它视为低置信度。
  if (!hasAnswer) confidence = Math.min(confidence, 0.6);

  return {
    type,
    prompt,
    options: normalizedOptions,
    correctOptionIds,
    correctAnswer,
    explanation,
    confidence: Number(confidence.toFixed(3)),
    issues,
    raw: block,
  };
}

/** 判断答案是否为「布尔词」(对/错/正确/错误/true/false) — 中文 \b 不可用，独立判断 */
function isBooleanAnswer(rawAnswer: string): boolean {
  const trimmed = rawAnswer.trim();
  if (!trimmed) return false;
  // 简单情况：整个答案就是布尔词
  if (/^(?:对|错|正确|错误|true|false|t|f)$/i.test(trimmed)) return true;
  // 答案以布尔词开头紧跟标点 / 空白
  if (/^(?:对|错|正确|错误|true|false)(?:[\s,，。.!！?？]|$)/i.test(trimmed)) return true;
  return false;
}

function detectExplicitType(block: string): ParsedQuestionType | null {
  const m = block.match(/\[(单选|单选题|多选|多选题|判断|判断题|正误|简答|简答题|问答|问答题|论述|论述题)\]/);
  if (m) return TYPE_LABELS[m[1]] ?? null;
  // 题号后紧跟 "单选 / 多选 / 判断 / 简答"
  const m2 = block.match(/^[^\n]{0,12}(单选题|多选题|判断题|简答题|问答题|论述题)/);
  if (m2) return TYPE_LABELS[m2[1]] ?? null;
  // 题干括号末尾标记：(简答题) / (判断题) / (单选题)
  const m3 = block.match(/\((单选题|多选题|判断题|简答题|问答题|论述题)\)/);
  if (m3) return TYPE_LABELS[m3[1]] ?? null;
  return null;
}

/** 提取题干：从开头到第一个选项行（A. / 1. 选项）或答案行 */
function extractPrompt(lines: string[]): string {
  const promptLines: string[] = [];
  for (const line of lines) {
    if (isOptionLine(line) || isAnswerLine(line) || isExplanationLine(line)) break;
    promptLines.push(line);
  }
  let prompt = promptLines.join("\n").trim();
  // 去除题号前缀
  prompt = prompt
    .replace(/^\(?\d+\s*[.、)]\s*/, "")
    .replace(/^第\s*\d+\s*题[:\s.]*/, "")
    .replace(/^\[[^\]]+\]\s*/, "")
    .replace(/^#{1,6}\s+(?:题目\s*\d*\s*[:\s.]*)?/, "")
    .replace(/^Q\.?\s*\d+\s*[:.、]\s*/i, "")
    .trim();
  return prompt;
}

/** 是否为选项行（A. xxx / A、xxx / (A) xxx） */
function isOptionLine(line: string): boolean {
  return /^\(?[A-Ha-h]\)?\s*[.、:]?\s*\S/.test(line.trim());
}

function isAnswerLine(line: string): boolean {
  return /^(答案|参考答案|正确答案|答|Answer)\s*[:：]/i.test(line.trim());
}

function isExplanationLine(line: string): boolean {
  return /^(解析|解答|解释|分析|Explanation)\s*[:：]/i.test(line.trim());
}

/** 抽选项 */
function extractOptions(lines: string[]): Array<{ id: string; text: string }> {
  const options: Array<{ id: string; text: string }> = [];
  for (const line of lines) {
    const trimmed = line.trim();
    const m = trimmed.match(/^\(?([A-Ha-h])\)?\s*[.、:]\s*(.+)$/);
    if (m) {
      const id = m[1].toUpperCase();
      const text = m[2].trim();
      if (text) options.push({ id, text });
    } else if (options.length > 0) {
      // 选项续行：仅当当前行不是新选项 / 答案 / 解析 / 新题号锚点时才追加
      if (
        !isAnswerLine(trimmed) &&
        !isExplanationLine(trimmed) &&
        !isQuestionStartAnchor(trimmed) &&
        trimmed
      ) {
        options[options.length - 1].text += " " + trimmed;
      }
    }
  }
  return options;
}

/** 抽答案 — 既支持选项 ID 又支持简答文本（多行答案直到下一题号 / 块结束） */
function extractAnswer(block: string): { optionIds: string[]; text: string } {
  // 找 "答案: ..." 起始位置
  const startMatch = block.match(/(?:答案|参考答案|正确答案|答|Answer)\s*[:：]\s*/i);
  if (!startMatch || startMatch.index === undefined) return { optionIds: [], text: "" };
  const startIdx = startMatch.index + startMatch[0].length;
  // 从此处往后取，直到下一题号锚点 / 解析关键字 / 块结束
  const tail = block.slice(startIdx);
  const lines = tail.split("\n");
  const collected: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (isQuestionStartAnchor(trimmed)) break;
    if (isExplanationLine(trimmed)) break;
    collected.push(line);
  }
  const raw = collected.join("\n").trim();
  if (!raw) return { optionIds: [], text: "" };
  // 单行 or 短文本（≤ 30 字）才尝试选项 ID 推断（避免简答题答案里的字母被误当作选项）
  const firstLine = raw.split("\n")[0].trim();
  if (firstLine.length <= 30 && !/[一-鿿]{4,}/.test(firstLine)) {
    const ids = firstLine.match(/[A-Ha-h]/g);
    if (ids && ids.length > 0) {
      return { optionIds: Array.from(new Set(ids.map((s) => s.toUpperCase()))), text: "" };
    }
  }
  return { optionIds: [], text: raw };
}

/** 抽解析（支持多段，直到下一题号 / 块结束） */
function extractExplanation(block: string): string {
  const startMatch = block.match(/(?:解析|解答|解释|分析|Explanation)\s*[:：]\s*/i);
  if (!startMatch || startMatch.index === undefined) return "";
  const startIdx = startMatch.index + startMatch[0].length;
  const tail = block.slice(startIdx);
  const lines = tail.split("\n");
  const collected: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (isQuestionStartAnchor(trimmed)) break;
    collected.push(line);
  }
  return collected.join("\n").trim();
}

// ============================================
// 兼容 question-bank.service 现有 schema 的转换
// ============================================

const importedQuestionShape = z.object({
  type: z.enum(["single_choice", "multiple_choice", "true_false", "short_answer"]),
  prompt: z.string(),
  options: z.array(z.object({ id: z.string(), text: z.string() })),
  correctOptionIds: z.array(z.string()),
  correctAnswer: z.string(),
  explanation: z.string(),
  points: z.number(),
  conceptTags: z.array(z.string()),
  sourceRefs: z.array(
    z.object({
      sourceId: z.string().optional(),
      fileName: z.string().optional(),
      page: z.string().optional(),
      row: z.string().optional(),
      excerpt: z.string().optional(),
    }),
  ),
  confidence: z.number(),
  needsReview: z.boolean(),
  aiSupplemented: z.boolean(),
  issues: z.array(z.string()),
});

export type RegexImportedQuestion = z.infer<typeof importedQuestionShape>;

/** 将 ParsedQuestion 转成 question-bank.service 期望的导入题目格式 */
export function toImportedQuestion(
  q: ParsedQuestion,
  sourceMeta: { sourceId?: string; fileName?: string },
): RegexImportedQuestion {
  return {
    type: q.type,
    prompt: q.prompt,
    options: q.options,
    correctOptionIds: q.correctOptionIds,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    points: 1,
    conceptTags: [],
    sourceRefs: [
      {
        sourceId: sourceMeta.sourceId,
        fileName: sourceMeta.fileName,
        excerpt: q.raw.slice(0, 120),
      },
    ],
    confidence: q.confidence,
    needsReview: q.confidence < 0.75 || q.issues.length > 0,
    aiSupplemented: false,
    issues: q.issues,
  };
}
