import { describe, it, expect } from "vitest";
import {
  buildAllocationProfile,
  buildClassDimensionShortfall,
  canonicalizeConceptTag,
  buildConceptHeatmap,
  summarizeEngagement,
} from "@/lib/utils/sim-objective-stats";

/**
 * S3 (P2-a) 客观统计 工具层单测。
 *
 * 全部 read-time、0 schema：消费已 fetch 的提交数据（transcript / assets.sections /
 * rubricBreakdown / conceptTags），产出供 S4 教师向面板渲染的客观指标。
 *
 * 与 AI 主观评分分开呈现，让老师对照核验。数据形状（来自 submission.schema +
 * schema.prisma 真源）：
 * - assets.sections = [{ label, items: [{ label, value }] }]（嵌套 items！）
 * - rubricBreakdown = [{ criterionId, score, maxScore }]，score 为「扣分前原始分」
 * - conceptTags = string[]（Submission 上的 DB 列，每人 ≤5）
 */

// ───────────────────────── 1. 参与度 ─────────────────────────
describe("summarizeEngagement", () => {
  it("逐人轮次/字数 + 班级聚合（均值取整、最少/最多）", () => {
    const result = summarizeEngagement([
      {
        studentId: "s1",
        studentName: "张三",
        transcript: [
          { role: "ai", text: "您好" },
          { role: "student", text: "我想咨询稳健理财" }, // 8 字
          { role: "student", text: "希望年化 5%" }, // 7 字（含半角空格）
        ],
      },
      {
        studentId: "s2",
        studentName: "李四",
        transcript: [{ role: "student", text: "随便" }], // 1 轮 2 字
      },
    ]);
    expect(result.perStudent).toHaveLength(2);
    expect(result.perStudent[0]).toMatchObject({
      studentId: "s1",
      studentName: "张三",
      studentTurns: 2,
      studentCharTotal: 15, // 8 + 7
      studentCharAvg: 8, // round(15/2)
    });
    expect(result.perStudent[1]).toMatchObject({ studentTurns: 1, studentCharTotal: 2 });
    // 班级聚合
    expect(result.classSummary.studentCount).toBe(2);
    expect(result.classSummary.avgTurns).toBe(2); // round((2+1)/2)=2
    expect(result.classSummary.minTurns).toBe(1);
    expect(result.classSummary.maxTurns).toBe(2);
    expect(result.classSummary.avgCharTotal).toBe(9); // round((15+2)/2)=round(8.5)=9
  });

  it("空提交列表：班级聚合全 0，不除零", () => {
    const r = summarizeEngagement([]);
    expect(r.perStudent).toEqual([]);
    expect(r.classSummary).toMatchObject({
      studentCount: 0,
      avgTurns: 0,
      minTurns: 0,
      maxTurns: 0,
      avgCharTotal: 0,
    });
  });
});

// ─────────────────────── 2. 资产配置画像 ───────────────────────
describe("buildAllocationProfile", () => {
  it("嵌套 sections.items 拍平：合计%、权益敞口%、低风险占比", () => {
    const p = buildAllocationProfile({
      sections: [
        {
          label: "权益类资产",
          items: [
            { label: "股票", value: 30 },
            { label: "股票型基金", value: 20 },
          ],
        },
        {
          label: "固定收益",
          items: [
            { label: "债券", value: 30 },
            { label: "货币基金", value: 20 },
          ],
        },
      ],
    });
    expect(p).not.toBeNull();
    expect(p!.totalPercent).toBe(100);
    expect(p!.isComplete).toBe(true); // 合计=100
    expect(p!.equityPercent).toBe(50); // 股票30 + 股票基金20
    expect(p!.lowRiskPercent).toBe(50); // 债券30 + 货币基金20
  });

  it("合计≠100：isComplete=false 但仍给出敞口", () => {
    const p = buildAllocationProfile({
      sections: [{ label: "权益", items: [{ label: "股票", value: 70 }] }],
    });
    expect(p!.totalPercent).toBe(70);
    expect(p!.isComplete).toBe(false);
    expect(p!.equityPercent).toBe(70);
    expect(p!.lowRiskPercent).toBe(0);
  });

  it("按 item 标签关键词分类（section 标签无语义时回落 item）", () => {
    const p = buildAllocationProfile({
      sections: [
        {
          label: "我的配置",
          items: [
            { label: "沪深300指数基金", value: 40 }, // 基金→权益
            { label: "国债", value: 30 }, // 低风险
            { label: "黄金", value: 30 }, // 既非权益也非低风险 → other
          ],
        },
      ],
    });
    expect(p!.equityPercent).toBe(40);
    expect(p!.lowRiskPercent).toBe(30);
    expect(p!.otherPercent).toBe(30);
  });

  it("空/缺失 assets：返回 null（无副作用）", () => {
    expect(buildAllocationProfile(null)).toBeNull();
    expect(buildAllocationProfile(undefined)).toBeNull();
    expect(buildAllocationProfile({ sections: [] })).toBeNull();
    expect(buildAllocationProfile({ sections: [{ label: "x", items: [] }] })).toBeNull();
  });

  it("脏数据（非数字 value / 缺 items）：跳过脏项，不抛错", () => {
    const p = buildAllocationProfile({
      sections: [
        { label: "权益", items: [{ label: "股票", value: "30" as unknown as number }] }, // 非数字跳过
        { label: "固收", items: [{ label: "债券", value: 40 }] },
      ],
    } as unknown as never);
    expect(p!.totalPercent).toBe(40);
    expect(p!.lowRiskPercent).toBe(40);
  });
});

// ──────────────── 3. 维度短板 + 迟交对账（原始分）────────────────
describe("buildClassDimensionShortfall", () => {
  const criteria = [
    { id: "c1", name: "需求分析", maxPoints: 25 },
    { id: "c2", name: "合规意识", maxPoints: 15 },
  ];

  it("班级各维度均分用『扣分前原始分』，按得分率升序排（短板在前）+ 语义标注", () => {
    const result = buildClassDimensionShortfall(
      [
        {
          evaluation: {
            rubricBreakdown: [
              { criterionId: "c1", score: 20, maxScore: 25 },
              { criterionId: "c2", score: 6, maxScore: 15 },
            ],
          },
        },
        {
          evaluation: {
            rubricBreakdown: [
              { criterionId: "c1", score: 25, maxScore: 25 },
              { criterionId: "c2", score: 9, maxScore: 15 },
            ],
          },
        },
      ],
      criteria,
    );
    // coordinator pin：必须带「扣分前原始分」语义标注
    expect(result.scoreBasis).toBe("raw_pre_penalty");
    expect(result.basisLabel).toContain("扣分前原始分");
    // 短板（得分率最低）排最前：c2 = (6+9)/2 / 15 = 7.5/15 = 50%
    expect(result.dimensions[0].criterionId).toBe("c2");
    expect(result.dimensions[0].criterionName).toBe("合规意识");
    expect(result.dimensions[0].avgScore).toBe(7.5);
    expect(result.dimensions[0].avgMaxScore).toBe(15);
    expect(result.dimensions[0].scoreRate).toBe(50);
    // c1 = (20+25)/2 / 25 = 22.5/25 = 90%
    expect(result.dimensions[1].criterionId).toBe("c1");
    expect(result.dimensions[1].scoreRate).toBe(90);
  });

  it("criterionId 映射到 name；缺失 criteria 时回落 id", () => {
    const result = buildClassDimensionShortfall(
      [{ evaluation: { rubricBreakdown: [{ criterionId: "cX", score: 5, maxScore: 10 }] } }],
      [],
    );
    expect(result.dimensions[0].criterionName).toBe("cX");
  });

  it("无有效 rubric / 空提交：dimensions 为空，仍带语义标注", () => {
    const result = buildClassDimensionShortfall([], criteria);
    expect(result.dimensions).toEqual([]);
    expect(result.scoreBasis).toBe("raw_pre_penalty");
  });
});

// ───────────────────── 4. 概念覆盖热力 ─────────────────────
describe("canonicalizeConceptTag (同义归并)", () => {
  it("同义碎片归并到规范名（风险披露/风险揭示→风险揭示；合规披露/合规销售→合规）", () => {
    expect(canonicalizeConceptTag("风险披露")).toBe(canonicalizeConceptTag("风险揭示"));
    expect(canonicalizeConceptTag("合规披露")).toBe(canonicalizeConceptTag("合规销售"));
  });

  it("trim + 未知 tag 原样返回（不丢数据）", () => {
    expect(canonicalizeConceptTag("  资产配置  ")).toBe("资产配置");
    expect(canonicalizeConceptTag("某个新概念")).toBe("某个新概念");
  });
});

describe("buildConceptHeatmap", () => {
  it("班级频次（归并后）按出现人数降序 + 覆盖率", () => {
    const heat = buildConceptHeatmap([
      ["资产配置", "风险披露", "合规披露"],
      ["资产配置", "风险揭示"], // 风险揭示与风险披露归并 → 同一概念
      ["资产配置"],
    ]);
    expect(heat.studentCount).toBe(3);
    // 资产配置 3/3 排第一
    expect(heat.concepts[0].canonical).toBe("资产配置");
    expect(heat.concepts[0].count).toBe(3);
    expect(heat.concepts[0].coverage).toBe(100);
    // 风险（披露+揭示归并）2 人
    const risk = heat.concepts.find((c) => c.count === 2);
    expect(risk).toBeDefined();
    // 同一学生重复同义不应重复计数
  });

  it("同一学生内同义不重复计数（披露+揭示算 1 人次该概念）", () => {
    const heat = buildConceptHeatmap([["风险披露", "风险揭示"]]);
    const risk = heat.concepts.find((c) => /风险/.test(c.canonical));
    expect(risk!.count).toBe(1);
  });

  it("空 / 脏：安全降级", () => {
    expect(buildConceptHeatmap([]).concepts).toEqual([]);
    expect(buildConceptHeatmap([]).studentCount).toBe(0);
    const dirty = buildConceptHeatmap([null, ["资产配置", "", "  "], "x"] as unknown as never);
    expect(dirty.studentCount).toBe(3);
    expect(dirty.concepts[0].canonical).toBe("资产配置");
    expect(dirty.concepts[0].count).toBe(1);
  });
});
