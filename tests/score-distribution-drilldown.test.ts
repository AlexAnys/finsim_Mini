import { describe, expect, it } from "vitest";
import {
  buildScoreDrilldownItems,
  rebinDistribution,
} from "@/components/analytics-v2/score-distribution-drilldown";
import type {
  ScoreDistribution,
  ScoreDistributionBin,
} from "@/components/analytics-v2/score-distribution-chart";

function bin(
  label: string,
  min: number,
  max: number,
  classes: ScoreDistributionBin["classes"],
): ScoreDistributionBin {
  return { label, min, max, classes };
}

describe("score distribution drilldown alignment", () => {
  it("uses the rendered 10-bin bucket and keeps the bar count", () => {
    const source: ScoreDistribution = {
      bins: [
        bin("60-80", 60, 80, [
          {
            classId: "class-a",
            classLabel: "金融 2024 A 班",
            students: [
              { id: "student-65", name: "李四", score: 65 },
              { id: "student-75", name: "张三", score: 75 },
            ],
          },
        ]),
        bin("80-100", 80, 100, [
          {
            classId: "class-a",
            classLabel: "金融 2024 A 班",
            students: [{ id: "student-100", name: "王五", score: 100 }],
          },
        ]),
      ],
      binCount: 5,
      scope: "multi_task",
      totalStudents: 3,
    };
    const view = rebinDistribution(source, 10);
    const renderedBin = view.bins.find((item) => item.label === "70-80");
    if (!renderedBin) throw new Error("missing 70-80 bin");

    const items = buildScoreDrilldownItems([renderedBin], "class-a");

    expect(items).toHaveLength(renderedBin.classes[0].students.length);
    expect(items[0]).toMatchObject({
      studentId: "student-75",
      binLabel: "70-80",
      score: 75,
      classId: "class-a",
    });
    expect(view.bins.at(-1)?.classes[0].students[0].score).toBe(100);
  });

  it("keeps class filtering aligned with the clicked series", () => {
    const renderedBin = bin("60-80", 60, 80, [
      {
        classId: "class-a",
        classLabel: "A 班",
        students: [{ id: "a-1", name: "甲", score: 72 }],
      },
      {
        classId: "class-b",
        classLabel: "B 班",
        students: [
          { id: "b-1", name: "乙", score: 68 },
          { id: "b-2", name: "丙", score: 74 },
        ],
      },
    ]);

    const items = buildScoreDrilldownItems([renderedBin], "class-b");

    expect(items).toHaveLength(renderedBin.classes[1].students.length);
    expect(items.map((item) => item.studentId)).toEqual(["b-1", "b-2"]);
  });

  it("combines every rendered bin for the details action", () => {
    const renderedBins = [
      bin("0-20", 0, 20, []),
      bin("20-40", 20, 40, [
        {
          classId: "class-a",
          classLabel: "A 班",
          students: [{ id: "student-low", name: "甲", score: 35 }],
        },
      ]),
      bin("80-100", 80, 100, [
        {
          classId: "class-a",
          classLabel: "A 班",
          students: [{ id: "student-high", name: "乙", score: 95 }],
        },
      ]),
    ];

    const items = buildScoreDrilldownItems(renderedBins);

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.studentId)).toEqual(["student-low", "student-high"]);
  });
});
