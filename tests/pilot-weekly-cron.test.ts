import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@/lib/auth/guards", () => ({ getSession: vi.fn(async () => ({ user: { id: "admin", role: "admin" } })) }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { user: { findMany: vi.fn() } } }));
vi.mock("@/lib/services/weekly-insight.service", () => ({ generateWeeklyInsight: vi.fn() }));
import { GET } from "@/app/api/cron/weekly-insight/route";
import { prisma } from "@/lib/db/prisma";
import { generateWeeklyInsight } from "@/lib/services/weekly-insight.service";
beforeEach(() => vi.clearAllMocks());
it("reports AI degradation as failed and distinguishes no-data skips", async () => {
  vi.mocked(prisma.user.findMany).mockResolvedValue([{id:"a",email:"a@example.invalid"},{id:"b",email:"b@example.invalid"},{id:"c",email:"c@example.invalid"}] as never);
  vi.mocked(generateWeeklyInsight)
    .mockResolvedValueOnce({submissionCount:10,payload:{emptyState:true}} as never)
    .mockResolvedValueOnce({submissionCount:0,payload:{emptyState:true}} as never)
    .mockResolvedValueOnce({submissionCount:10,payload:{emptyState:false}} as never);
  const result=await (await GET(new NextRequest("http://localhost/api/cron/weekly-insight"))).json();
  expect(result.data).toMatchObject({total:3,failed:1,skipped:1,succeeded:1});
  expect(result.data.results[0]).toMatchObject({ok:false,error:"AI_INSIGHT_GENERATION_FAILED"});
});
