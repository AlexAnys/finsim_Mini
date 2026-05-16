# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 04-sb-free-question.spec.ts >> smoke-04 student 自由问 SB
- Location: tests/e2e/smoke/04-sb-free-question.spec.ts:10:5

# Error details

```
Error: expect(received).toBeDefined()

Received: undefined
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e6]:
          - img "灵析" [ref=e8]
          - generic [ref=e9]: 灵析
        - generic [ref=e11]:
          - img [ref=e12]
          - generic [ref=e15]: 搜索...
          - generic [ref=e16]: ⌘K
        - navigation [ref=e17]:
          - generic [ref=e18]: 学习空间
          - link "仪表盘" [ref=e19] [cursor=pointer]:
            - /url: /dashboard
            - img [ref=e21]
            - text: 仪表盘
          - link "任务中心" [ref=e26] [cursor=pointer]:
            - /url: /tasks
            - img [ref=e27]
            - text: 任务中心
          - link "我的课程" [ref=e30] [cursor=pointer]:
            - /url: /courses
            - img [ref=e31]
            - text: 我的课程
          - link "我的成绩" [ref=e33] [cursor=pointer]:
            - /url: /grades
            - img [ref=e34]
            - text: 我的成绩
          - link "课表管理" [ref=e40] [cursor=pointer]:
            - /url: /schedule
            - img [ref=e41]
            - text: 课表管理
        - generic [ref=e44]:
          - generic [ref=e46]: 张
          - generic [ref=e47]:
            - paragraph [ref=e48]: 张三
            - paragraph [ref=e49]: 学生
          - button "登出" [ref=e50]:
            - img
    - main [ref=e51]:
      - generic [ref=e52]:
        - navigation "面包屑" [ref=e53]:
          - generic [ref=e55]: 学生
          - generic [ref=e56]:
            - generic [ref=e57]: /
            - generic [ref=e58]: 仪表盘
        - generic [ref=e59]:
          - button "通知" [ref=e60]:
            - img
          - button "AI 助手" [ref=e61]:
            - img
            - text: AI 助手
          - button "用户菜单" [ref=e62]:
            - generic [ref=e64]: 张
      - generic [ref=e66]:
        - generic [ref=e67]:
          - generic [ref=e68]:
            - generic [ref=e69]: 2026 年 5 月 16 日 · 周六 · 第 13 教学周
            - heading "下午好，张三" [level=1] [ref=e70]
            - generic [ref=e71]:
              - text: 接下来
              - generic [ref=e73]: 5 节未来课
              - generic [ref=e74]:
                - text: 、
                - generic [ref=e75]: 14 项待办
          - generic [ref=e76]:
            - link "学习伙伴 课业疑问、术语解释、案例复习——立即开始对话 开始对话" [ref=e77] [cursor=pointer]:
              - /url: /study-buddy?openNew=true
              - img [ref=e79]
              - generic [ref=e82]:
                - generic [ref=e83]: 学习伙伴
                - generic [ref=e84]: 课业疑问、术语解释、案例复习——立即开始对话
              - generic [ref=e85]:
                - text: 开始对话
                - img [ref=e86]
            - generic [ref=e88]:
              - link "我的课表" [ref=e89] [cursor=pointer]:
                - /url: /schedule
                - img
                - text: 我的课表
              - link "继续学习" [ref=e90] [cursor=pointer]:
                - /url: /courses
                - img
                - text: 继续学习
        - generic [ref=e91]:
          - generic [ref=e93]:
            - generic [ref=e94]:
              - generic [ref=e95]: 本周待办
              - img [ref=e97]
            - generic [ref=e101]: "14"
            - generic [ref=e102]: 0 本周已完成
          - generic [ref=e104]:
            - generic [ref=e105]:
              - generic [ref=e106]: 本周完成
              - img [ref=e108]
            - generic [ref=e112]: "0"
            - generic [ref=e113]: 次提交
          - generic [ref=e115]:
            - generic [ref=e116]:
              - generic [ref=e117]: 平均得分
              - img [ref=e119]
            - generic [ref=e123]: "66.0"
            - generic [ref=e124]: 基于 4 次公布成绩
          - generic [ref=e126]:
            - generic [ref=e127]:
              - generic [ref=e128]: 已完成率
              - img [ref=e130]
            - generic [ref=e135]: 0%
            - generic [ref=e136]: 本周任务
        - generic [ref=e137]:
          - generic [ref=e138]:
            - generic [ref=e139]:
              - generic [ref=e140]:
                - generic [ref=e141]:
                  - heading "学习任务" [level=2] [ref=e142]
                  - paragraph [ref=e143]: 按截止时间排序 · 共 21 项
                - generic [ref=e144]:
                  - button "全部" [ref=e145]
                  - button "待完成" [ref=e146]
                  - button "模拟" [ref=e147]
                  - button "测验" [ref=e148]
                  - button "主观题" [ref=e149]
              - generic [ref=e150]:
                - generic [ref=e152]:
                  - img [ref=e154]
                  - generic [ref=e156]:
                    - generic [ref=e157]:
                      - generic [ref=e158]: 模拟对话
                      - generic [ref=e159]: 已过期
                      - generic [ref=e160]: 扣 20%
                      - generic [ref=e161]:
                        - img
                        - text: 已过期 2月21日
                    - generic [ref=e162]: 客户理财咨询模拟
                    - generic [ref=e163]:
                      - generic [ref=e164]: 个人理财规划
                      - generic [ref=e165]: ·理财基础概念
                      - generic [ref=e166]: ·什么是个人理财
                      - generic [ref=e167]: ·课前
                  - link "开始" [ref=e168] [cursor=pointer]:
                    - /url: /sim/2e700d5e-fa7e-4f13-b000-03f660414b89
                    - img
                    - text: 开始
                - generic [ref=e170]:
                  - img [ref=e172]
                  - generic [ref=e175]:
                    - generic [ref=e176]:
                      - generic [ref=e177]: 测验
                      - generic [ref=e178]: 已过期
                      - generic [ref=e179]: 扣 20%
                      - generic [ref=e180]:
                        - img
                        - text: 已过期 2月26日
                    - generic [ref=e181]: 测验1
                    - generic [ref=e182]:
                      - generic [ref=e183]: 个人理财规划
                      - generic [ref=e184]: ·理财基础概念
                      - generic [ref=e185]: ·收支管理
                      - generic [ref=e186]: ·课后
                  - link "开始" [ref=e187] [cursor=pointer]:
                    - /url: /tasks/2587a565-e28d-4bbb-8b39-1335473cd88c
                    - img
                    - text: 开始
                - generic [ref=e189]:
                  - img [ref=e191]
                  - generic [ref=e193]:
                    - generic [ref=e194]:
                      - generic [ref=e195]: 模拟对话
                      - generic [ref=e196]: 已过期
                      - generic [ref=e197]: 扣 20%
                      - generic [ref=e198]:
                        - img
                        - text: 已过期 2月28日
                    - generic [ref=e199]: 客户理财咨询模拟
                    - generic [ref=e200]:
                      - generic [ref=e201]: 个人理财规划
                      - generic [ref=e202]: ·理财基础概念
                      - generic [ref=e203]: ·财务目标设定
                      - generic [ref=e204]: ·课中
                  - link "开始" [ref=e205] [cursor=pointer]:
                    - /url: /sim/da3724bf-cdb5-43c4-b8a4-2849ac97f191
                    - img
                    - text: 开始
                - generic [ref=e207]:
                  - img [ref=e209]
                  - generic [ref=e212]:
                    - generic [ref=e213]:
                      - generic [ref=e214]: 测验
                      - generic [ref=e215]: 已过期
                      - generic [ref=e216]: 扣 20%
                      - generic [ref=e217]:
                        - img
                        - text: 已过期 2月28日
                    - generic [ref=e218]: 理财基础知识测验
                    - generic [ref=e219]:
                      - generic [ref=e220]: 个人理财规划
                      - generic [ref=e221]: ·理财基础概念
                      - generic [ref=e222]: ·收支管理
                      - generic [ref=e223]: ·课中
                      - generic [ref=e224]: ·0/2 次尝试
                  - link "开始" [ref=e225] [cursor=pointer]:
                    - /url: /tasks/017f5aa6-f12f-4f48-a747-0f90cf6040a7
                    - img
                    - text: 开始
                - generic [ref=e227]:
                  - img [ref=e229]
                  - generic [ref=e231]:
                    - generic [ref=e232]:
                      - generic [ref=e233]: 模拟对话
                      - generic [ref=e234]: 已过期
                      - generic [ref=e235]: 扣 20%
                      - generic [ref=e236]:
                        - img
                        - text: 已过期 3月7日
                    - generic [ref=e237]: 客户理财咨询模拟
                    - generic [ref=e238]:
                      - generic [ref=e239]: 个人理财规划
                      - generic [ref=e240]: ·风险与资产配置
                      - generic [ref=e241]: ·资产配置策略
                      - generic [ref=e242]: ·课后
                      - generic [ref=e243]: ·0/3 次尝试
                  - link "开始" [ref=e244] [cursor=pointer]:
                    - /url: /sim/e34afdc0-dc06-4072-aa5c-d1b945de0850
                    - img
                    - text: 开始
              - link "查看全部 21 项 →" [ref=e246] [cursor=pointer]:
                - /url: /tasks
            - generic [ref=e247]:
              - generic [ref=e248]:
                - heading "最近成绩" [level=2] [ref=e249]
                - link "查看全部 →" [ref=e250] [cursor=pointer]:
                  - /url: /grades
              - generic [ref=e251]:
                - link "模拟对话 客户理财咨询模拟 5月6日 已分析 · 等待教师公布" [ref=e252] [cursor=pointer]:
                  - /url: /tasks/f1494008-e987-4576-b5e5-4a304d0ec822
                  - generic [ref=e253]:
                    - generic [ref=e254]:
                      - img
                      - text: 模拟对话
                    - generic [ref=e255]: 客户理财咨询模拟
                    - generic [ref=e256]: 5月6日
                    - generic [ref=e258]: 已分析 · 等待教师公布
                - link "测验 理财基础知识测验 5月6日 0/70" [ref=e259] [cursor=pointer]:
                  - /url: /tasks/483fbaf6-60d2-4444-a5fe-da03536b1215
                  - generic [ref=e260]:
                    - generic [ref=e261]:
                      - img
                      - text: 测验
                    - generic [ref=e262]: 理财基础知识测验
                    - generic [ref=e263]: 5月6日
                    - generic [ref=e266]:
                      - text: "0"
                      - generic [ref=e267]: /70
                - link "模拟对话 [QA-V2-202604300250] 客户风险沟通模拟 4月30日 88/100" [ref=e268] [cursor=pointer]:
                  - /url: /tasks/c0c0c1e5-36e3-41ff-82d3-c978d5bd2b11
                  - generic [ref=e269]:
                    - generic [ref=e270]:
                      - img
                      - text: 模拟对话
                    - generic [ref=e271]: "[QA-V2-202604300250] 客户风险沟通模拟"
                    - generic [ref=e272]: 4月30日
                    - generic [ref=e276]:
                      - text: "88"
                      - generic [ref=e277]: /100
          - generic [ref=e278]:
            - generic [ref=e279]:
              - heading "公告" [level=2] [ref=e281]
              - generic [ref=e282]:
                - generic [ref=e286]:
                  - generic [ref=e287]: 第一周作业提醒
                  - generic [ref=e288]:
                    - generic [ref=e289]: 个人理财规划
                    - generic [ref=e290]: ·
                    - generic [ref=e291]: 4月29日
                - generic [ref=e295]:
                  - generic [ref=e296]: 欢迎来到个人理财规划课程
                  - generic [ref=e297]:
                    - generic [ref=e298]: 个人理财规划
                    - generic [ref=e299]: ·
                    - generic [ref=e300]: 4月29日
                - generic [ref=e304]:
                  - generic [ref=e305]: 第一周作业提醒
                  - generic [ref=e306]:
                    - generic [ref=e307]: 个人理财规划
                    - generic [ref=e308]: ·
                    - generic [ref=e309]: 4月22日
            - generic [ref=e310]:
              - generic [ref=e311]:
                - heading "未来课程" [level=2] [ref=e312]
                - generic [ref=e313]: 未来 5 节
              - generic [ref=e314]:
                - link "明天 周日 10:25-12:00 个人规划" [ref=e315] [cursor=pointer]:
                  - /url: /courses/8f7f653c-9177-44f6-b764-80f7f779b2ef
                  - generic [ref=e316]:
                    - generic [ref=e318]:
                      - generic [ref=e319]: 明天 周日
                      - generic [ref=e320]: 10:25-12:00
                    - generic [ref=e322]: 个人规划
                    - img [ref=e323]
                - link "明天 周日 14:00-15:35 个人规划" [ref=e325] [cursor=pointer]:
                  - /url: /courses/8f7f653c-9177-44f6-b764-80f7f779b2ef
                  - generic [ref=e326]:
                    - generic [ref=e328]:
                      - generic [ref=e329]: 明天 周日
                      - generic [ref=e330]: 14:00-15:35
                    - generic [ref=e332]: 个人规划
                    - img [ref=e333]
                - link "明天 周日 15:55-17:30 个人规划" [ref=e335] [cursor=pointer]:
                  - /url: /courses/8f7f653c-9177-44f6-b764-80f7f779b2ef
                  - generic [ref=e336]:
                    - generic [ref=e338]:
                      - generic [ref=e339]: 明天 周日
                      - generic [ref=e340]: 15:55-17:30
                    - generic [ref=e342]: 个人规划
                    - img [ref=e343]
                - link "5月18日 周一 10:00-11:40 个人理财规划 教室 金融楼 301" [ref=e345] [cursor=pointer]:
                  - /url: /courses/940bbe23-6172-40bf-bc7f-b22a1840a1de
                  - generic [ref=e346]:
                    - generic [ref=e348]:
                      - generic [ref=e349]: 5月18日 周一
                      - generic [ref=e350]: 10:00-11:40
                    - generic [ref=e351]:
                      - generic [ref=e352]: 个人理财规划
                      - generic [ref=e353]: 教室 金融楼 301
                    - img [ref=e354]
                - link "5月20日 周三 14:00-15:40 个人理财规划 教室 金融楼 301" [ref=e356] [cursor=pointer]:
                  - /url: /courses/e6fc049c-756f-4442-86da-35a6cdbadd6e
                  - generic [ref=e357]:
                    - generic [ref=e359]:
                      - generic [ref=e360]: 5月20日 周三
                      - generic [ref=e361]: 14:00-15:40
                    - generic [ref=e362]:
                      - generic [ref=e363]: 个人理财规划
                      - generic [ref=e364]: 教室 金融楼 301
                    - img [ref=e365]
  - region "Notifications alt+T":
    - list:
      - listitem [ref=e367]:
        - img [ref=e369]
        - generic [ref=e373]: 登录成功
  - alert [ref=e374]
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import { loginAs, cleanupSmokeSbPosts } from "./_setup";
  3  | 
  4  | /**
  5  |  * Smoke 04: student 发自由问 (无 taskId) → assert post created.
  6  |  *
  7  |  * 不强行触发 AI reply (依赖外网 + provider key), 验证 createPost 路径 + DB 落地.
  8  |  * 自清理: 删 smoke 测试期间新建的 SB post.
  9  |  */
  10 | test("smoke-04 student 自由问 SB", async ({ browser }) => {
  11 |   const titleTag = `smoke-04-free-${Date.now()}`;
  12 |   const studentPage = await loginAs(browser, "student1");
  13 |   const r = studentPage.request;
  14 | 
  15 |   const createRes = await r.post("/api/study-buddy/posts", {
  16 |     data: {
  17 |       title: titleTag,
  18 |       question: "smoke 测试: 什么是分散投资? 简短解释一下",
  19 |       mode: "direct",
  20 |       anonymous: false,
  21 |     },
  22 |   });
  23 |   expect([200, 201]).toContain(createRes.status());
  24 |   const json = await createRes.json();
  25 |   expect(json.success).toBe(true);
  26 |   expect(json.data?.title).toBe(titleTag);
  27 | 
  28 |   // 列表能看到
  29 |   const listRes = await r.get(`/api/study-buddy/posts?take=20`);
  30 |   expect(listRes.status()).toBe(200);
  31 |   const listJson = await listRes.json();
  32 |   const found = (listJson.data?.items ?? []).find(
  33 |     (p: { title?: string }) => p.title === titleTag,
  34 |   );
> 35 |   expect(found).toBeDefined();
     |                 ^ Error: expect(received).toBeDefined()
  36 | 
  37 |   // cleanup
  38 |   await cleanupSmokeSbPosts(r, titleTag);
  39 | });
  40 | 
```