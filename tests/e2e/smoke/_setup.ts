/**
 * 5 主线 smoke 共享 helper.
 * 严格用 seeded baseline 账号 (npm run db:seed):
 *   teacher1@finsim.edu.cn / password123
 *   student1@finsim.edu.cn / password123 (Class A)
 */
import { expect, type Browser, type Page, type APIRequestContext } from "@playwright/test";

export const SMOKE_ACCOUNTS = {
  teacher1: { email: "teacher1@finsim.edu.cn", password: "password123" },
  teacher2: { email: "teacher2@finsim.edu.cn", password: "password123" },
  student1: { email: "student1@finsim.edu.cn", password: "password123" },
  student5: { email: "student5@finsim.edu.cn", password: "password123" },
  admin: { email: "admin@finsim.edu.cn", password: "password123" },
} as const;

export type AccountKey = keyof typeof SMOKE_ACCOUNTS;

/** 创建独立 browser context 并以指定账号登录，返回 page. */
export async function loginAs(browser: Browser, account: AccountKey): Promise<Page> {
  const { email, password } = SMOKE_ACCOUNTS[account];

  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto("/login");
      await page.waitForLoadState("domcontentloaded");
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', password);
      await Promise.all([
        page
          .waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 })
          .catch(() => {}),
        page.click('button[type="submit"]'),
      ]);
      await page.waitForLoadState("networkidle").catch(() => {});

      const currentPath = new URL(page.url()).pathname;
      if (currentPath.startsWith("/login")) {
        throw new Error(`login failed for ${email}: still at ${currentPath}`);
      }
      return page;
    } catch (err) {
      lastErr = err;
      console.log(`  login attempt ${attempt} failed for ${email}, retrying after 3s...`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("login failed");
}

/**
 * GET /api/lms/task-instances?take=N 拿可见 instance, 按 status/taskType 优先排序.
 * 若 baseline seed 不含该类 instance 则返回 null.
 */
export async function findAvailableInstance(
  request: APIRequestContext,
  filter?: { status?: string; taskType?: string },
): Promise<{ id: string; taskId: string; title: string; status: string; taskType: string } | null> {
  const res = await request.get(`/api/lms/task-instances?take=50`);
  if (!res.ok()) return null;
  const json = await res.json();
  if (!json?.success) return null;
  const items: Array<{
    id: string;
    taskId: string;
    title: string;
    status: string;
    taskType: string;
  }> = json.data?.items ?? json.data ?? [];
  let matched = items;
  if (filter?.status) matched = matched.filter((i) => i.status === filter.status);
  if (filter?.taskType) matched = matched.filter((i) => i.taskType === filter.taskType);
  return matched[0] ?? null;
}

/** 给主线 smoke 用的一次性后置: 删除 smoke 创建的 SB post (deterministic cleanup). */
export async function cleanupSmokeSbPosts(
  request: APIRequestContext,
  titleContains: string,
): Promise<void> {
  try {
    const res = await request.get(`/api/study-buddy/posts?take=50`);
    if (!res.ok()) return;
    const json = await res.json();
    const posts: Array<{ id: string; title?: string }> = json?.data?.items ?? [];
    for (const p of posts) {
      if (p.title && p.title.includes(titleContains)) {
        await request.delete(`/api/study-buddy/posts/${p.id}`).catch(() => {});
      }
    }
  } catch {
    // best-effort cleanup
  }
}

/** 断言响应是 success: true */
export function assertApiSuccess(res: { status(): number }, body: { success?: boolean }) {
  expect([200, 201]).toContain(res.status());
  expect(body.success).toBe(true);
}
