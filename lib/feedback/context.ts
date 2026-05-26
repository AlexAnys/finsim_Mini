/**
 * 反馈定位上下文采集（AC10 Tier-1 自动 + AC11 Tier-2 点选元素）。
 *
 * 目标：让一条反馈对 coding agent **可定位**——附上「这是哪个页面源码文件、哪些路由 ID、
 * 当前开着哪个弹窗/向导第几步、页面标题」，以及（可选）用户点选的出问题元素的稳定标识。
 *
 * 纯逻辑部分（routeToSourcePath / extractRouteIds）可单测；读 DOM 的部分（detectOpenDialog /
 * describeElement）仅客户端调用。全部对缺失/异常安全降级（返回 null/undefined，绝不抛错卡提交）。
 */

export interface FeedbackContext {
  sourcePath?: string; // 由路由推导的页面源码文件路径，如 app/(student)/tasks/[id]/page.tsx
  routeIds?: Record<string, string>; // 关键路由 ID，如 { taskInstanceId: "..." }（动态段值）
  dialog?: { title: string; step?: string } | null; // 当前打开的弹窗/向导名 + 步骤
  pageTitle?: string; // document.title
  element?: CapturedElement | null; // AC11 用户点选的元素
}

export interface CapturedElement {
  text?: string; // 可见文字（截断）
  ariaLabel?: string;
  testId?: string; // data-testid（若有）
  role?: string;
  domPath: string; // 可读的 标签+文字 路径，如 main > section > button「提交」
  rect?: { x: number; y: number; w: number; h: number }; // 视口坐标（用于截图高亮 / 复核）
}

/**
 * 路由 → 页面源码文件路径。
 *
 * Next App Router：URL 不含 route group（(auth)/(student)/(simulation)），动态段为 [xxx]。
 * 这里按已知路由表把 live pathname 还原成 app/.../page.tsx。匹配不到返回 undefined（降级）。
 */
const ROUTE_GROUPS: { authPrefixes: string[]; studentExact: string[] } = {
  // URL 前缀 → 实际 app 目录前缀（route group 在 URL 隐藏）
  authPrefixes: ["/login", "/register"],
  // 学生路由：URL 无前缀，但落在 app/(student)/ 下
  studentExact: ["/dashboard", "/courses", "/grades", "/schedule", "/settings", "/study-buddy", "/tasks"],
};

// 已知动态路由模板（用占位标注哪段是 ID）。顺序：更具体的在前。
const DYNAMIC_TEMPLATES: { test: RegExp; file: string; idKeys: string[] }[] = [
  { test: /^\/sim\/[^/]+$/, file: "app/(simulation)/sim/[id]/page.tsx", idKeys: ["taskInstanceId"] },
  { test: /^\/courses\/[^/]+$/, file: "app/(student)/courses/[id]/page.tsx", idKeys: ["courseId"] },
  { test: /^\/tasks\/[^/]+$/, file: "app/(student)/tasks/[id]/page.tsx", idKeys: ["taskInstanceId"] },
  { test: /^\/teacher\/courses\/[^/]+$/, file: "app/teacher/courses/[id]/page.tsx", idKeys: ["courseId"] },
  { test: /^\/teacher\/instances\/[^/]+\/insights$/, file: "app/teacher/instances/[id]/insights/page.tsx", idKeys: ["taskInstanceId"] },
  { test: /^\/teacher\/instances\/[^/]+$/, file: "app/teacher/instances/[id]/page.tsx", idKeys: ["taskInstanceId"] },
  { test: /^\/teacher\/tasks\/drafts\/[^/]+$/, file: "app/teacher/tasks/drafts/[id]/page.tsx", idKeys: ["draftId"] },
  { test: /^\/teacher\/tasks\/[^/]+$/, file: "app/teacher/tasks/[id]/page.tsx", idKeys: ["taskId"] },
];

export function routeToSourcePath(pathname: string): string | undefined {
  if (!pathname) return undefined;
  const path = pathname.split("?")[0].replace(/\/+$/, "") || "/";

  // 1) 动态路由模板优先
  for (const t of DYNAMIC_TEMPLATES) {
    if (t.test.test(path)) return t.file;
  }
  // 2) auth
  if (ROUTE_GROUPS.authPrefixes.includes(path)) return `app/(auth)${path}/page.tsx`;
  // 3) 学生精确路由（route group 隐藏）
  if (ROUTE_GROUPS.studentExact.includes(path)) return `app/(student)${path}/page.tsx`;
  // 4) 其余静态路由：teacher/* 与 admin/* 直接是路径段
  if (path.startsWith("/teacher/") || path.startsWith("/admin/")) {
    return `app${path}/page.tsx`;
  }
  return undefined;
}

/** 从 pathname 抽动态段 ID（按模板的 idKeys 命名）。无动态段返回 undefined。 */
export function extractRouteIds(pathname: string): Record<string, string> | undefined {
  if (!pathname) return undefined;
  const path = pathname.split("?")[0].replace(/\/+$/, "") || "/";
  for (const t of DYNAMIC_TEMPLATES) {
    const m = path.match(t.test);
    if (m) {
      // 取每个动态段的实际值：按 / 分割，挑出与模板 [..] 对应位置的段
      const segs = path.split("/").filter(Boolean);
      const ids: Record<string, string> = {};
      // 动态段是非固定词的段；简单起见用 idKeys 顺序对应「路径里的非固定段」
      const dynSegs = segs.filter((s) => !/^(sim|courses|tasks|teacher|instances|drafts|insights|admin)$/.test(s));
      t.idKeys.forEach((k, i) => {
        if (dynSegs[i]) ids[k] = dynSegs[i];
      });
      return Object.keys(ids).length > 0 ? ids : undefined;
    }
  }
  return undefined;
}

/**
 * 探测当前打开的弹窗/向导名 + 步骤（读 DOM，仅客户端）。
 *
 * 通用做法：找最上层 open 状态的 radix dialog（data-slot=dialog-content 或 role=dialog），
 * 读其无障碍标题（DialogTitle 文本）；步骤从向导 stepper 的 aria-current/激活项推断。
 * 无弹窗返回 null。对结构差异安全降级。
 */
export function detectOpenDialog(): { title: string; step?: string } | null {
  if (typeof document === "undefined") return null;
  try {
    const dialogs = Array.from(
      document.querySelectorAll<HTMLElement>('[role="dialog"][data-state="open"], [data-slot="dialog-content"][data-state="open"]'),
    );
    if (dialogs.length === 0) return null;
    const top = dialogs[dialogs.length - 1]; // 最后挂载的视为最上层

    // 标题：优先 aria-labelledby 指向的元素，其次 [data-slot=dialog-title]
    let title = "";
    const labelledBy = top.getAttribute("aria-labelledby");
    if (labelledBy) {
      const el = document.getElementById(labelledBy);
      if (el) title = (el.textContent || "").trim();
    }
    if (!title) {
      const titleEl = top.querySelector('[data-slot="dialog-title"]');
      if (titleEl) title = (titleEl.textContent || "").trim();
    }
    if (!title) title = "（未命名弹窗）";

    // 步骤：找 aria-current 的步骤项，或文本含「第 N 步 / Step」的激活项
    let step: string | undefined;
    const current = top.querySelector('[aria-current="step"], [aria-current="true"]');
    if (current) step = (current.textContent || "").trim().slice(0, 40) || undefined;

    return { title: title.slice(0, 120), step };
  } catch {
    return null;
  }
}

/**
 * 描述一个被点选的元素的稳定标识（AC11）。
 *
 * 生产构建下 class 名被压缩 → **不依赖 CSS 选择器**，优先抓 文字 / aria-label / data-testid /
 * role，并生成「标签+文字」的可读 DOM 路径。对任何异常安全降级。
 */
export function describeElement(el: Element | null): CapturedElement | null {
  if (!el || typeof window === "undefined") return null;
  try {
    const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80) || undefined;
    const ariaLabel = el.getAttribute("aria-label")?.trim() || undefined;
    const testId = el.getAttribute("data-testid")?.trim() || undefined;
    const role = el.getAttribute("role")?.trim() || undefined;

    // 可读 DOM 路径：从元素向上最多 5 层，每层「标签[#id][「短文字」]」
    const parts: string[] = [];
    let cur: Element | null = el;
    let depth = 0;
    while (cur && depth < 5 && cur.tagName?.toLowerCase() !== "body") {
      const tag = cur.tagName.toLowerCase();
      const id = cur.id ? `#${cur.id}` : "";
      const ownText =
        Array.from(cur.childNodes)
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => n.textContent || "")
          .join("")
          .trim()
          .slice(0, 20) || "";
      parts.unshift(`${tag}${id}${ownText ? `「${ownText}」` : ""}`);
      cur = cur.parentElement;
      depth++;
    }
    const domPath = parts.join(" > ");

    const r = (el as HTMLElement).getBoundingClientRect?.();
    const rect = r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : undefined;

    return { text, ariaLabel, testId, role, domPath, rect };
  } catch {
    return null;
  }
}

/** 组装 AC10 自动上下文（客户端调用）。element 由 AC11 单独传入合并。 */
export function collectFeedbackContext(pathname: string): FeedbackContext {
  const ctx: FeedbackContext = {};
  const sourcePath = routeToSourcePath(pathname);
  if (sourcePath) ctx.sourcePath = sourcePath;
  const routeIds = extractRouteIds(pathname);
  if (routeIds) ctx.routeIds = routeIds;
  ctx.dialog = detectOpenDialog();
  if (typeof document !== "undefined") ctx.pageTitle = document.title?.slice(0, 200) || undefined;
  return ctx;
}
