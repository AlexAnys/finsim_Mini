import { NextRequest } from "next/server";

/**
 * Request builder helpers for route handler 三角测试.
 * 返回 NextRequest (Next.js route handler 第一参类型).
 */

const BASE = "http://localhost:3000";

export function buildJsonRequest(
  path: string,
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
): NextRequest {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  return new NextRequest(url, init as ConstructorParameters<typeof NextRequest>[1]);
}

export function buildGetRequest(path: string, searchParams?: Record<string, string>): NextRequest {
  const url = new URL(path.startsWith("http") ? path : `${BASE}${path}`);
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      url.searchParams.set(k, v);
    }
  }
  return new NextRequest(url.toString());
}

export async function readJson<T = unknown>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

/** Next.js route handler 第二参 (params) — segment 动态路由用 */
export function makeRouteContext<P extends Record<string, string>>(params: P) {
  return { params: Promise.resolve(params) };
}
