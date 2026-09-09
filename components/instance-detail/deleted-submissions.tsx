"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
interface DeletedRow { id: string; student: { name: string }; deletedAt: string; score: string | null }
export function DeletedSubmissions({ instanceId, onRestore }: { instanceId: string; onRestore: () => void }) {
  const [rows, setRows] = useState<DeletedRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    try {
      const json = await (await fetch(`/api/submissions?taskInstanceId=${instanceId}&deleted=true&pageSize=100`)).json();
      if (!json.success) throw new Error(json.error?.message || "加载失败");
      setRows(json.data.items);
    } catch (err) { toast.error(err instanceof Error ? err.message : "加载失败"); }
    finally { setBusy(false); }
  }
  async function restore(id: string) {
    setBusy(true);
    try {
      const json = await (await fetch(`/api/submissions/${id}/restore`, { method: "POST" })).json();
      if (!json.success) throw new Error(json.error?.message || "恢复失败");
      toast.success("提交已恢复"); await load(); onRestore();
    } catch (err) { toast.error(err instanceof Error ? err.message : "恢复失败"); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 rounded-lg border p-4">
    <Button variant="outline" disabled={busy} onClick={() => rows ? setRows(null) : void load()}>{rows ? "收起已删除提交" : "查看已删除提交 / 恢复"}</Button>
    {rows && <><p className="text-sm text-muted-foreground">删除的作答和原始成绩仍保留，可在此恢复。恢复未完成的批改后，可重新发起批改。</p>
      {rows.length === 0 ? <p className="text-sm">没有已删除的提交</p> : rows.map(row => <div key={row.id} className="flex items-center justify-between gap-3"><span>{row.student.name} · {row.score ?? "未出分"} · {new Date(row.deletedAt).toLocaleString("zh-CN")}</span><Button disabled={busy} variant="secondary" onClick={() => void restore(row.id)}>恢复提交</Button></div>)}
    </>}
  </section>;
}
