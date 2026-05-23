import { describe, it, expect } from "vitest";
import { computeTranscriptStats, countStudentTurns } from "@/lib/utils/transcript-stats";

/**
 * S2 (P3) 对话轮次显示 — 纯统计 helper 单测。
 *
 * 「对话轮次：N」= transcript 中学生发言条数（role==='student'）。
 * 本场景轮次比 timestamp 更具代表性（生产数据 timestamp 全部相同、已坏）。
 *
 * 计数逻辑抽成可复用 util：S3 参与度统计复用同一次遍历得到
 * studentTurns / studentCharTotal / studentCharAvg。不依赖 timestamp、0 schema。
 *
 * 角色匹配与 scope-insights.service.extractStudentTranscript 一致（容错）：
 * - student 端：role 为 "student" 或 "user"
 * - 文本可来自 text 或 content；空白文本不计为一轮
 *
 * 注：字数按 String.length（UTF-16 code unit）统计；中文 BMP 字符 1 unit/字，
 * 全角标点也计 1，半角字母 / 空格各计 1。
 */
describe("computeTranscriptStats", () => {
  it("正常对话：学生轮次 = role==='student' 的消息数，AI 不计入", () => {
    const stats = computeTranscriptStats([
      { role: "ai", text: "您好，我想咨询理财" },
      { role: "student", text: "请问您的风险承受能力如何？" }, // 13 字
      { role: "ai", text: "中等偏保守" },
      { role: "student", text: "建议配置债券基金为主" }, // 10 字
    ]);
    expect(stats.studentTurns).toBe(2);
    expect(stats.studentCharTotal).toBe(23); // 13 + 10
    expect(stats.studentCharAvg).toBe(12); // round(23/2)
  });

  it("空 transcript：全部为 0", () => {
    const stats = computeTranscriptStats([]);
    expect(stats.studentTurns).toBe(0);
    expect(stats.studentCharTotal).toBe(0);
    expect(stats.studentCharAvg).toBe(0);
  });

  it("无学生发言（仅 AI）：轮次 0、平均字数 0（不除零）", () => {
    const stats = computeTranscriptStats([
      { role: "ai", text: "您好" },
      { role: "ai", text: "请问还有什么需要" },
    ]);
    expect(stats.studentTurns).toBe(0);
    expect(stats.studentCharTotal).toBe(0);
    expect(stats.studentCharAvg).toBe(0);
  });

  it("混合角色 + user 视为学生 + 空白文本不计一轮", () => {
    const stats = computeTranscriptStats([
      { role: "student", text: "我的目标是稳健增值" }, // 9 字
      { role: "user", text: "希望兼顾流动性" }, // 7 字（user 也算学生端）
      { role: "student", text: "   " }, // 空白：不计
      { role: "ai", text: "明白" },
      { role: "student", text: "" }, // 空串：不计
    ]);
    expect(stats.studentTurns).toBe(2);
    expect(stats.studentCharTotal).toBe(16); // 9 + 7
    // 平均按"有效轮次"取整：16 / 2 = 8
    expect(stats.studentCharAvg).toBe(8);
  });

  it("非法输入（null/undefined/非数组/脏元素）：返回全 0，不抛错", () => {
    expect(computeTranscriptStats(null).studentTurns).toBe(0);
    expect(computeTranscriptStats(undefined).studentTurns).toBe(0);
    expect(computeTranscriptStats("transcript" as unknown as never).studentTurns).toBe(0);
    const dirty = computeTranscriptStats([
      null,
      42,
      { role: 123, text: "x" },
      { role: "student" }, // 无 text
      { role: "student", text: "有效发言" }, // 4 字 — 唯一有效轮
    ] as unknown as never);
    expect(dirty.studentTurns).toBe(1);
    expect(dirty.studentCharTotal).toBe(4);
    expect(dirty.studentCharAvg).toBe(4);
  });

  it("文本来自 content 字段（scope-insights 形态）也计入", () => {
    const stats = computeTranscriptStats([
      { role: "student", content: "通过 content 字段发言" }, // 15 字（含半角字母+空格）
    ] as unknown as never);
    expect(stats.studentTurns).toBe(1);
    expect(stats.studentCharTotal).toBe(15);
  });
});

describe("countStudentTurns", () => {
  it("便捷计数 = computeTranscriptStats(...).studentTurns", () => {
    const transcript = [
      { role: "ai", text: "Q1" },
      { role: "student", text: "A1" },
      { role: "student", text: "A2" },
    ];
    expect(countStudentTurns(transcript)).toBe(2);
    expect(countStudentTurns(null)).toBe(0);
  });
});
