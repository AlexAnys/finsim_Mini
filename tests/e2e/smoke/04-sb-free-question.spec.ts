import { test, expect } from "@playwright/test";
import { loginAs, cleanupSmokeSbPosts } from "./_setup";

/**
 * Smoke 04: student 发自由问 (无 taskId) → assert post created.
 *
 * 不强行触发 AI reply (依赖外网 + provider key), 验证 createPost 路径 + DB 落地.
 * 自清理: 删 smoke 测试期间新建的 SB post.
 */
test("smoke-04 student 自由问 SB", async ({ browser }) => {
  const titleTag = `smoke-04-free-${Date.now()}`;
  const studentPage = await loginAs(browser, "student1");
  const r = studentPage.request;

  const createRes = await r.post("/api/study-buddy/posts", {
    data: {
      title: titleTag,
      question: "smoke 测试: 什么是分散投资? 简短解释一下",
      mode: "direct",
      anonymous: false,
    },
  });
  expect([200, 201]).toContain(createRes.status());
  const json = await createRes.json();
  expect(json.success).toBe(true);
  expect(json.data?.title).toBe(titleTag);

  // 列表能看到
  const listRes = await r.get(`/api/study-buddy/posts?take=20`);
  expect(listRes.status()).toBe(200);
  const listJson = await listRes.json();
  const found = (listJson.data ?? []).find(
    (p: { title?: string }) => p.title === titleTag,
  );
  expect(found).toBeDefined();

  // cleanup
  await cleanupSmokeSbPosts(r, titleTag);
});
