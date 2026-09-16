"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ImportResult = {
  previewHash: string;
  rows: { rowNumber: number; name: string; email: string; studentNumber?: string; status: string; message: string }[];
  summary: { total: number; ready: number; created: number; enrolled: number; skipped: number; failed: number };
};
function downloadTemplate() {
  const content = "\uFEFF姓名,邮箱,学号\r\n";
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = "学生导入模板.csv"; link.click();
  URL.revokeObjectURL(url);
}

export function ImportStudentsDialog(props: { classId: string; className: string; onClose: () => void; onComplete: () => Promise<void> }) {
  const [initialPassword, setInitialPassword] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [committed, setCommitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(action: "preview" | "commit") {
    if (!file) return;
    setBusy(true); setError("");
    try {
      const body = new FormData(); body.set("file", file); body.set("action", action);
      if (initialPassword) body.set("initialPassword", initialPassword);
      if (action === "commit" && result) body.set("previewHash", result.previewHash);
      const response = await fetch(`/api/lms/classes/${props.classId}/import`, { method: "POST", body });
      const json = await response.json();
      if (!json.success) throw new Error(json.error?.message || "导入失败，请重新预览");
      setResult(json.data); setCommitted(action === "commit");
      if (action === "commit") await props.onComplete();
    } catch (err) { setError(err instanceof Error ? err.message : "网络异常，请重试；已有账号不会重复创建。"); }
    finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={open => !open && !busy && props.onClose()}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>批量导入学生</DialogTitle>
        <DialogDescription>导入到「{props.className}」。上传名单后先核对结果，再确认创建。</DialogDescription>
      </DialogHeader>
      <div className="space-y-3 text-sm">
        <Button variant="outline" onClick={downloadTemplate}>下载名单模板（Excel 可打开）</Button>
        <p>支持 Excel（.xlsx、.xls）和 CSV，最多 200 行、2 MB。姓名、邮箱为必填列；学号仅供本次核对，不会保存到账号。</p>
        <p>新账号使用下方设置的初始密码，由老师私下交付，学生登录后可修改。同班账号自动跳过；未分班账号直接入班，原密码不变。其他班已有学生请在人员列表中转班。</p>
        <div className="space-y-2"><Label htmlFor="roster-file">选择学生名单</Label>
          <Input id="roster-file" type="file" accept=".xlsx,.xls,.csv" disabled={busy} onChange={e => {
            setFile(e.target.files?.[0] ?? null); setResult(null); setCommitted(false); setError("");
          }} />
        </div>
        <div className="space-y-2"><Label htmlFor="roster-password">新账号初始密码（仅新建账号需要）</Label>
          <Input id="roster-password" type="password" autoComplete="new-password" disabled={busy} value={initialPassword} onChange={e => {
            setInitialPassword(e.target.value); setResult(null); setCommitted(false); setError("");
          }} placeholder="至少 6 个字符；已有账号不会改密" />
          <p className="text-xs text-ink-4">无需在名单中添加密码列；也可使用名单中选填的「初始密码」列为新账号分别设置。</p>
        </div>
        {result && <div className="space-y-3" aria-live="polite">
          <p className="rounded-lg bg-paper-alt p-3 font-semibold">
            {committed ? `已创建 ${result.summary.created} 人，已有账号入班 ${result.summary.enrolled ?? 0} 人` : `可导入 ${result.summary.ready} 人`} · 跳过 {result.summary.skipped} 人 · {committed ? "失败" : "需修正"} {result.summary.failed} 人
          </p>
          <div className="max-h-72 overflow-auto rounded-md border border-line">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-paper-alt"><tr><th className="p-2">行</th><th className="p-2">姓名 / 邮箱</th><th className="p-2">核对结果</th></tr></thead>
              <tbody>{result.rows.map(row => <tr key={row.rowNumber} className="border-t border-line">
                <td className="p-2">{row.rowNumber}</td><td className="max-w-60 break-all p-2">{row.name}<br />{row.email}{row.studentNumber && <><br />学号：{row.studentNumber}</>}</td>
                <td className={`p-2 ${["invalid", "conflict", "failed"].includes(row.status) ? "text-danger" : "text-ink-4"}`}>{row.message}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <p className="text-xs text-ink-4">只处理可导入的行。需修正的行可修改名单后重新上传；重试会跳过已成功创建的账号。</p>
        </div>}
        {error && <p role="alert" className="text-danger">{error}</p>}
      </div>
      <DialogFooter>
        <Button variant="outline" disabled={busy} onClick={props.onClose}>{committed ? "完成" : "取消"}</Button>
        {result && !committed ? <Button disabled={busy || !result.summary.ready} onClick={() => submit("commit")}>{busy ? "正在导入…" : `确认导入 ${result.summary.ready} 人`}</Button>
          : <Button disabled={busy || !file} onClick={() => submit("preview")}>{busy ? "正在校验…" : committed ? "重新校验 / 重试" : "上传并预览"}</Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
