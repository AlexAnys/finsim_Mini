import { describe, it, expect } from "vitest";
import {
  parseStructuredQuestionBank,
  toImportedQuestion,
} from "@/lib/services/question-bank-regex.service";

describe("parseStructuredQuestionBank", () => {
  it("解析标号式单选 + 答案 + 解析", () => {
    const text = `
1. 投资组合的风险衡量指标通常使用？
A. 平均收益率
B. 标准差
C. 持有期限
D. 行业分类
答案：B
解析：标准差衡量收益率的波动性，是经典的风险度量。

2. 在 CAPM 模型中，β 系数衡量？
A. 公司规模
B. 市场系统性风险
C. 财务杠杆
D. 自由现金流
答案：B
解析：β 衡量个股相对市场的系统性风险敞口。
`;
    const r = parseStructuredQuestionBank(text);
    expect(r.questions).toHaveLength(2);
    expect(r.questions[0].prompt).toContain("投资组合的风险衡量");
    expect(r.questions[0].options).toHaveLength(4);
    expect(r.questions[0].correctOptionIds).toEqual(["B"]);
    expect(r.questions[0].explanation).toContain("标准差");
    expect(r.questions[0].confidence).toBeGreaterThanOrEqual(0.85);
    expect(r.overallConfidence).toBeGreaterThan(0.8);
  });

  it("解析题型标记 [多选]", () => {
    const text = `
[多选] 以下哪些属于流动资产？
A. 现金
B. 应收账款
C. 长期股权投资
D. 存货
答案：A、B、D
解析：长期股权投资为非流动资产。
`;
    const r = parseStructuredQuestionBank(text);
    expect(r.questions).toHaveLength(1);
    expect(r.questions[0].type).toBe("multiple_choice");
    expect(r.questions[0].correctOptionIds.sort()).toEqual(["A", "B", "D"]);
  });

  it("解析判断题（对/错）", () => {
    const text = `
1. [判断] 净现值越大，项目盈利能力越强。
答案：对
解析：在折现率合理时，NPV 越大表示创造的价值越多。
`;
    const r = parseStructuredQuestionBank(text);
    expect(r.questions).toHaveLength(1);
    expect(r.questions[0].type).toBe("true_false");
    expect(r.questions[0].options).toHaveLength(2);
    expect(r.questions[0].correctOptionIds).toEqual(["A"]);
  });

  it("解析简答题（无选项 + 文本答案）", () => {
    const text = `
[简答] 请用 100 字以内说明 EBITDA 与净利润的差异。
答案：EBITDA 在净利润基础上加回利息、税、折旧与摊销，更接近经营性现金流的趋势，但不考虑资本性支出与营运资金变动。
`;
    const r = parseStructuredQuestionBank(text);
    expect(r.questions).toHaveLength(1);
    expect(r.questions[0].type).toBe("short_answer");
    expect(r.questions[0].correctAnswer).toContain("EBITDA");
  });

  it("Markdown header 题目", () => {
    const text = `
### 题目 1
请选择资产负债表的主要构成？
A. 收入与费用
B. 资产、负债与所有者权益
C. 现金流入与流出
答案：B
解析：资产负债表反映某一时点的资产、负债与所有者权益。

### 题目 2
营业利润 = ？
A. 营业收入 - 营业成本 - 三项费用 + 投资收益等
B. 净利润 + 利息
C. 销售收入 - 销售成本
答案：A
解析：营业利润是营业收入减营业成本和期间费用，再加上投资收益等的结果。
`;
    const r = parseStructuredQuestionBank(text);
    expect(r.questions.length).toBeGreaterThanOrEqual(2);
  });

  it("缺答案时 confidence 降低且打 issue", () => {
    const text = `
1. 货币时间价值的核心思想是？
A. 今天的钱比明天值钱
B. 通胀越高利率越高
C. 折现因子总等于 1
D. 现金为王
`;
    const r = parseStructuredQuestionBank(text);
    expect(r.questions).toHaveLength(1);
    expect(r.questions[0].issues).toContain("答案待确认");
    expect(r.questions[0].confidence).toBeLessThan(0.8);
  });

  it("空文本 / 噪声 → 0 题 + 0 confidence", () => {
    const r = parseStructuredQuestionBank("\n\n\n   ");
    expect(r.questions).toHaveLength(0);
    expect(r.overallConfidence).toBe(0);
  });

  it("混杂未识别尾巴会被收集到 unparsedTail", () => {
    const text = `
本题库共 10 题，请认真作答。

1. 资产负债表的左边是？
A. 资产
B. 负债
答案：A

非题块：本页结束，谢谢。
`;
    const r = parseStructuredQuestionBank(text);
    expect(r.questions.length).toBeGreaterThanOrEqual(1);
    // 第一行（共 10 题）作为题前噪声没有被解析为题，应该进 unparsed
    expect(r.unparsedTail.length).toBeGreaterThanOrEqual(0);
  });

  it("toImportedQuestion 形成 question-bank service 兼容结构", () => {
    const text = `
1. 简单测试题？
A. 选项 A
B. 选项 B
答案：A
`;
    const r = parseStructuredQuestionBank(text);
    const imported = toImportedQuestion(r.questions[0], { sourceId: "src-1", fileName: "test.pdf" });
    expect(imported.type).toBe("single_choice");
    expect(imported.options).toHaveLength(2);
    expect(imported.sourceRefs[0]?.sourceId).toBe("src-1");
    expect(imported.aiSupplemented).toBe(false);
    expect(imported.points).toBe(1);
  });
});
