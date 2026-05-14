import { describe, it, expect, beforeEach } from "vitest";
import {
  assertAiFeatureCooldown,
  __clearAiThrottleState,
  AI_FEATURE_COOLDOWN_MS,
} from "@/lib/services/ai-throttle.service";

beforeEach(() => {
  __clearAiThrottleState();
});

describe("assertAiFeatureCooldown", () => {
  it("first call for a (userId, feature) pair does not throw", () => {
    expect(() => assertAiFeatureCooldown("u1", "weeklyInsight")).not.toThrow();
  });

  it("immediate second call within cooldown throws AI_FEATURE_COOLDOWN", () => {
    assertAiFeatureCooldown("u1", "weeklyInsight");
    expect(() => assertAiFeatureCooldown("u1", "weeklyInsight")).toThrow(
      /AI_FEATURE_COOLDOWN/,
    );
  });

  it("different users are isolated", () => {
    assertAiFeatureCooldown("u1", "weeklyInsight");
    expect(() => assertAiFeatureCooldown("u2", "weeklyInsight")).not.toThrow();
  });

  it("different features for same user are isolated", () => {
    assertAiFeatureCooldown("u1", "weeklyInsight");
    expect(() => assertAiFeatureCooldown("u1", "scopeInsights")).not.toThrow();
  });

  it("custom cooldownMs short window allows fast successive calls (used in tests)", () => {
    assertAiFeatureCooldown("u1", "f", 0);
    expect(() => assertAiFeatureCooldown("u1", "f", 0)).not.toThrow();
  });

  it("default cooldown is 60s", () => {
    expect(AI_FEATURE_COOLDOWN_MS).toBe(60_000);
  });
});
