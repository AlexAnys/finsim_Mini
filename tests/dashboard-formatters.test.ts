import { describe, it, expect } from "vitest";
import {
  formatRelativeDue,
  relativeTimeFromNow,
} from "@/lib/utils/dashboard-formatters";

describe("formatRelativeDue", () => {
  const now = new Date("2026-04-23T10:00:00Z");

  it("marks as urgent when due within 24h same day", () => {
    const due = new Date("2026-04-23T18:00:00Z");
    const result = formatRelativeDue(due, now);
    expect(result.isUrgent).toBe(true);
    expect(result.label).toContain("截止");
    expect(result.label).toMatch(/今晚|明天/);
  });

  it("marks as urgent when due within 24h next day", () => {
    const due = new Date("2026-04-24T08:00:00Z");
    const result = formatRelativeDue(due, now);
    expect(result.isUrgent).toBe(true);
  });

  it("marks as NOT urgent when due 2+ days away", () => {
    const due = new Date("2026-04-26T10:00:00Z");
    const result = formatRelativeDue(due, now);
    expect(result.isUrgent).toBe(false);
    expect(result.label).toMatch(/\d+ 天后截止/);
  });

  it("marks past-due correctly", () => {
    const due = new Date("2026-04-20T10:00:00Z");
    const result = formatRelativeDue(due, now);
    expect(result.isUrgent).toBe(false);
    expect(result.label).toContain("已过期");
  });

  it("falls back to absolute date for >7 days", () => {
    const due = new Date("2026-05-10T10:00:00Z");
    const result = formatRelativeDue(due, now);
    expect(result.isUrgent).toBe(false);
    expect(result.label).toContain("截止");
    expect(result.label).not.toMatch(/天后/);
  });
});

describe("relativeTimeFromNow", () => {
  const now = new Date("2026-04-23T10:00:00Z");

  it("< 1h returns minutes", () => {
    expect(relativeTimeFromNow(new Date("2026-04-23T09:30:00Z"), now)).toBe(
      "30 分钟前",
    );
  });

  it("< 1min returns '刚刚'", () => {
    expect(relativeTimeFromNow(new Date("2026-04-23T10:00:00Z"), now)).toBe(
      "刚刚",
    );
  });

  it("< 24h returns hours", () => {
    expect(relativeTimeFromNow(new Date("2026-04-23T05:00:00Z"), now)).toBe(
      "5 小时前",
    );
  });

  it("exactly 1 day ago returns '昨天'", () => {
    expect(relativeTimeFromNow(new Date("2026-04-22T10:00:00Z"), now)).toBe(
      "昨天",
    );
  });

  it("< 7 days returns N 天前", () => {
    expect(relativeTimeFromNow(new Date("2026-04-20T10:00:00Z"), now)).toBe(
      "3 天前",
    );
  });

  it(">= 7 days falls back to absolute date", () => {
    const result = relativeTimeFromNow(
      new Date("2026-04-10T10:00:00Z"),
      now,
    );
    expect(result).not.toMatch(/天前|小时|分钟|昨天|刚刚/);
  });
});
