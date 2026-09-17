"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Choice = { id: string; name: string };
type Preview = {
  previewToken: string; canApply: boolean; selectedCount: number; changeCount: number; skippedCount: number;
  sourceClass: Choice; targetClass: Choice; targetGroup: Choice | null; newGroupName?: string;
  warnings: string[]; blockers: string[];
  impact: { removedMemberships: number; preservedSubmissions: number; pendingAssignments: number; pendingTasks?: (Choice & { studentCount: number })[]; lostCourses: Choice[]; gainedCourses: Choice[] };
  appliedCount?: number;
};
const selectStyle = "h-10 w-full rounded-md border border-line bg-surface px-3 text-sm";

export function BulkRosterDialog(props: {
  sourceClass: Choice; classes: Choice[]; groups: (Choice & { classId: string })[]; studentIds: string[];
  onClose: () => void; onComplete: (message: string) => Promise<void>;
}) {
  const [studentIds] = useState(props.studentIds);
  const [mode, setMode] = useState<"transfer" | "group">("group");
  const [targetClassId, setTargetClassId] = useState(props.sourceClass.id);
  const [targetGroupId, setTargetGroupId] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [groupMode, setGroupMode] = useState("add");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const targetGroups = props.groups.filter(g => g.classId === targetClassId);
  const hasGroup = targetGroupId && (targetGroupId !== "new" || newGroupName.trim());
  const valid = studentIds.length <= 200 && targetClassId && (mode === "transfer" ? targetClassId !== props.sourceClass.id : hasGroup);
  function change() { setPreview(null); setError(""); }
  async function submit(isPreview: boolean) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/lms/classes/${props.sourceClass.id}/roster`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, studentIds, targetClassId, groupMode,
          ...(targetGroupId === "new" ? { newGroupName: newGroupName.trim() } : targetGroupId ? { targetGroupId } : {}),
          preview: isPreview, ...(!isPreview ? { previewToken: preview?.previewToken } : {}),
        }),
      });
      const json = await response.json();
      if (!json.success) { setPreview(null); throw new Error(json.error?.message || "操作失败，请重试"); }
      if (isPreview || !json.data.canApply) setPreview(json.data);
      else {
        const data: Preview = json.data;
        await props.onComplete(`已完成 ${data.appliedCount ?? 0} 人，跳过 ${data.skippedCount} 人，失败 0 人。`);
        props.onClose();
      }
    } catch (err) { setError(err instanceof Error ? err.message : "网络异常，请重试；重复确认不会重复添加。"); }
    finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={open => !open && !busy && props.onClose()}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>批量管理学生</DialogTitle>
        <DialogDescription>已选 {studentIds.length} 人 · 来源：{props.sourceClass.name}。先预览，再确认。</DialogDescription>
      </DialogHeader>
      <fieldset disabled={busy} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="roster-mode">操作</Label>
          <select id="roster-mode" className={selectStyle} value={mode} onChange={e => {
            const next = e.target.value as "transfer" | "group";
            setMode(next); setTargetClassId(next === "group" ? props.sourceClass.id : ""); setTargetGroupId(""); change();
          }}><option value="group">分配 / 调整小组</option><option value="transfer">转到其他班级</option></select>
        </div>
        {mode === "transfer" && <div className="space-y-2"><Label htmlFor="roster-class">目标班级</Label>
          <select id="roster-class" className={selectStyle} value={targetClassId} onChange={e => { setTargetClassId(e.target.value); setTargetGroupId(""); change(); }}>
            <option value="">请选择目标班级</option>
            {props.classes.filter(c => c.id !== props.sourceClass.id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <p className="text-xs text-ink-4">每位学生只能归属一个班级。转班会退出原班及原班全部小组，学习记录保留。</p>
        </div>}
        <div className="space-y-2"><Label htmlFor="roster-group">目标小组{mode === "transfer" ? "（可选）" : ""}</Label>
          <select id="roster-group" className={selectStyle} disabled={!targetClassId} value={targetGroupId} onChange={e => { setTargetGroupId(e.target.value); change(); }}>
            <option value="">{mode === "transfer" ? "只转班，暂不分组" : "请选择小组"}</option>
            {targetGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            <option value="new">＋ 新建小组并加入</option>
          </select>
          {targetGroupId === "new" && <><Label htmlFor="roster-group-name">新小组名称</Label><Input id="roster-group-name" maxLength={200} value={newGroupName} onChange={e => { setNewGroupName(e.target.value); change(); }} placeholder="输入名称，确认时一起创建" /></>}
        </div>
        {mode === "group" && <div className="space-y-2"><Label htmlFor="roster-group-mode">原有小组</Label>
          <select id="roster-group-mode" className={selectStyle} value={groupMode} onChange={e => { setGroupMode(e.target.value); change(); }}>
            <option value="add">保留原有小组，加入目标组</option><option value="replace">退出我管理的本班其他组，调到目标组</option>
          </select>
        </div>}
      </fieldset>
      {studentIds.length > 200 && <p role="alert" className="text-sm text-danger">每次最多操作 200 人，请缩小选择范围。</p>}
      {preview && <div className="space-y-2 rounded-lg border border-line bg-paper-alt p-4 text-sm" aria-live="polite">
        <p className="font-semibold">确认预览：{preview.changeCount} 人待处理，{preview.skippedCount} 人无需重复处理</p>
        <p>{preview.sourceClass.name} → {preview.targetClass.name}{preview.targetGroup ? ` / ${preview.targetGroup.name}` : preview.newGroupName ? ` / 新建 ${preview.newGroupName}` : ""}</p>
        <p>移除 {preview.impact.removedMemberships} 条小组关系；保留 {preview.impact.preservedSubmissions} 条提交记录。</p>
        {preview.impact.lostCourses.length > 0 && <p>离开课程：{preview.impact.lostCourses.map(c => c.name).join("、")}</p>}
        {preview.impact.gainedCourses.length > 0 && <p>加入课程：{preview.impact.gainedCourses.map(c => c.name).join("、")}</p>}
        {preview.warnings.map((text, i) => <p key={i}>{text}</p>)}
        {!!preview.impact.pendingTasks?.length && <ul className="list-disc pl-4 text-xs">{preview.impact.pendingTasks.map(task => <li key={task.id}>{task.name}：{task.studentCount} 人尚未提交</li>)}</ul>}
        {preview.blockers.map((text, i) => <p key={i} className="text-danger">{text}</p>)}
      </div>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <DialogFooter>
        <Button variant="outline" disabled={busy} onClick={props.onClose}>取消</Button>
        {preview ? <Button disabled={busy || !preview.canApply} onClick={() => submit(false)}>{busy ? "正在处理…" : "确认执行"}</Button>
          : <Button disabled={busy || !valid} onClick={() => submit(true)}>{busy ? "正在核对…" : "预览操作影响"}</Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
