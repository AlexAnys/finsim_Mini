/** Load every page before enabling selection so "all filtered" never means the first 100. */
export async function loadRosterList<T>(url: string): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; ; page++) {
    const response = await fetch(`${url}?take=200&page=${page}`);
    const json = await response.json();
    if (!response.ok || !json.success || !Array.isArray(json.data)) throw new Error(json.error?.message || "加载列表失败，请重试");
    rows.push(...json.data);
    if (json.data.length < 200) return rows;
  }
}
