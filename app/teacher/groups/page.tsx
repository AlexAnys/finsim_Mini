"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Loader2, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { BulkRosterDialog } from "@/components/teacher-roster/bulk-roster-dialog";
import { ImportStudentsDialog } from "@/components/teacher-roster/import-students-dialog";
import { loadRosterList } from "@/components/teacher-roster/load-list";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LmsClass {
  id: string;
  name: string;
  academicYear?: string | null;
  _count: { students: number };
}

interface ClassMember {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
}

interface StudentGroup {
  id: string;
  name: string;
  type: string;
  classId: string;
  class: { id: string; name: string };
  members: Array<{ student: { id: string; name: string; email: string } }>;
  _count: { members: number };
  createdAt: string;
}

const ALL_GROUPS = "__all_groups";
const UNGROUPED = "__ungrouped";

export default function TeacherGroupsPage() {
  const [classes, setClasses] = useState<LmsClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [members, setMembers] = useState<ClassMember[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState(ALL_GROUPS);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [operationResult, setOperationResult] = useState("");
  const [membersError, setMembersError] = useState("");
  const memberRequest = useRef(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<StudentGroup | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftMemberIds, setDraftMemberIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);

  const [createClassOpen, setCreateClassOpen] = useState(false);
  const [classNameDraft, setClassNameDraft] = useState("");
  const [classYearDraft, setClassYearDraft] = useState("");
  const [creatingClass, setCreatingClass] = useState(false);

  const fetchClasses = useCallback(async () => {
    const rows = await loadRosterList<LmsClass>("/api/lms/classes");
    setClasses(rows);
    setSelectedClassId(current => current || rows[0]?.id || "");
  }, []);

  const fetchGroups = useCallback(async () => {
    setGroups(await loadRosterList<StudentGroup>("/api/groups"));
  }, []);

  const fetchMembers = useCallback(async (classId: string) => {
    const request = ++memberRequest.current;
    setMembers([]); setMembersError("");
    if (!classId) return;
    setMembersLoading(true);
    try {
      const rows = await loadRosterList<ClassMember>(`/api/lms/classes/${classId}/members`);
      if (request === memberRequest.current) setMembers(rows);
    } catch (err) {
      if (request === memberRequest.current) setMembersError(err instanceof Error ? err.message : "加载班级成员失败");
    } finally {
      if (request === memberRequest.current) setMembersLoading(false);
    }
  }, []);

  async function refreshRoster(message?: string) {
    if (message) { setOperationResult(message); setSelectedMemberIds(new Set()); }
    const results = await Promise.allSettled([fetchClasses(), fetchGroups(), fetchMembers(selectedClassId)]);
    if (results.some(result => result.status === "rejected")) toast.error("操作已完成，部分列表刷新失败，请刷新页面核对");
  }

  useEffect(() => {
    async function init() {
      try {
        await Promise.all([fetchClasses(), fetchGroups()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [fetchClasses, fetchGroups]);

  useEffect(() => {
    fetchMembers(selectedClassId);
    setSelectedMemberIds(new Set());
    setOperationResult("");
  }, [fetchMembers, selectedClassId]);

  const selectedClass = classes.find((item) => item.id === selectedClassId) ?? null;
  const classGroups = groups.filter((group) => group.classId === selectedClassId);
  const memberGroupMap = useMemo(() => {
    const map = new Map<string, StudentGroup[]>();
    for (const group of classGroups) {
      for (const member of group.members) {
        const arr = map.get(member.student.id) ?? [];
        arr.push(group);
        map.set(member.student.id, arr);
      }
    }
    return map;
  }, [classGroups]);
  const ungroupedCount = members.filter((member) => !memberGroupMap.has(member.id)).length;
  const filteredMembers = members.filter((member) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || member.name.toLowerCase().includes(q) || member.email.toLowerCase().includes(q);
    const groupsForMember = memberGroupMap.get(member.id) ?? [];
    const matchesGroup =
      groupFilter === ALL_GROUPS ||
      (groupFilter === UNGROUPED && groupsForMember.length === 0) ||
      groupsForMember.some((group) => group.id === groupFilter);
    return matchesSearch && matchesGroup;
  });
  const allFilteredSelected =
    filteredMembers.length > 0 &&
    filteredMembers.every((member) => selectedMemberIds.has(member.id));

  function openCreate() {
    setDraftName("");
    setDraftMemberIds(new Set(selectedMemberIds));
    setCreateOpen(true);
  }

  function openCreateClass() {
    setClassNameDraft("");
    setClassYearDraft("");
    setCreateClassOpen(true);
  }

  function openEdit(group: StudentGroup) {
    setEditGroup(group);
    setDraftName(group.name);
    setDraftMemberIds(new Set(group.members.map((member) => member.student.id)));
  }

  function toggleDraftMember(id: string) {
    setDraftMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectedMember(id: string) {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const member of filteredMembers) next.delete(member.id);
      } else {
        for (const member of filteredMembers) next.add(member.id);
      }
      return next;
    });
  }

  async function saveCreate() {
    if (!selectedClassId || !draftName.trim()) {
      toast.error("请选择班级并填写分组名称");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: selectedClassId,
          name: draftName.trim(),
          type: "manual",
          studentIds: Array.from(draftMemberIds),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "创建失败");
        return;
      }
      toast.success("分组已创建");
      setCreateOpen(false);
      await fetchGroups();
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!editGroup || !draftName.trim()) return;
    const original = new Set(editGroup.members.map((member) => member.student.id));
    const next = draftMemberIds;
    const addStudentIds = Array.from(next).filter((id) => !original.has(id));
    const removeStudentIds = Array.from(original).filter((id) => !next.has(id));
    setSaving(true);
    try {
      const res = await fetch(`/api/groups/${editGroup.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draftName.trim(),
          addStudentIds,
          removeStudentIds,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "保存失败");
        return;
      }
      toast.success("分组已更新");
      setEditGroup(null);
      await fetchGroups();
    } finally {
      setSaving(false);
    }
  }

  async function deleteGroup() {
    if (!deleteGroupId) return;
    try {
      const res = await fetch(`/api/groups/${deleteGroupId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "删除失败");
        return;
      }
      toast.success("分组已删除");
      setDeleteGroupId(null);
      await fetchGroups();
    } catch {
      toast.error("删除失败");
    }
  }

  async function saveCreateClass() {
    const name = classNameDraft.trim();
    if (!name) {
      toast.error("请输入班级名称");
      return;
    }
    setCreatingClass(true);
    try {
      const res = await fetch("/api/lms/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          academicYear: classYearDraft.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "新建班级失败");
        return;
      }
      toast.success("班级已创建");
      setCreateClassOpen(false);
      setClassNameDraft("");
      setClassYearDraft("");
      const newId: string | undefined = json.data?.id;
      await fetchClasses();
      if (newId) {
        setSelectedClassId(newId);
        setGroupFilter(ALL_GROUPS);
        setSearch("");
      }
    } catch {
      toast.error("新建班级失败");
    } finally {
      setCreatingClass(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center text-ink-4">
        <Loader2 className="mr-2 size-4 animate-spin" />
        加载班级...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center gap-2 text-danger">
        <AlertCircle className="size-8" />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold text-brand">班级管理</p>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.02em] text-ink">班级与分组管理</h1>
          <p className="mt-2 text-sm text-ink-4">先选班级，再管理学习分组和人员信息。</p>
        </div>
        <Button onClick={openCreate} disabled={!selectedClassId || membersLoading || Boolean(membersError)}>
          <Plus className="mr-2 size-4" />
          新建分组
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[280px_1fr_1.2fr]">
        <Card className="border-line bg-surface shadow-fs">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">班级概览</CardTitle>
              <Button size="sm" variant="outline" onClick={openCreateClass}>
                <Plus className="mr-1 size-4" />
                新建班级
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {classes.map((cls) => {
              const active = cls.id === selectedClassId;
              const countGroups = groups.filter((group) => group.classId === cls.id).length;
              return (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => {
                    if (cls.id === selectedClassId) return;
                    setMembers([]); setSelectedMemberIds(new Set()); setSelectedClassId(cls.id);
                    setGroupFilter(ALL_GROUPS);
                    setSearch("");
                  }}
                  className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                    active ? "border-brand bg-brand-soft text-brand" : "border-line bg-paper hover:bg-paper-alt"
                  }`}
                >
                  <div className="font-semibold">{cls.name}</div>
                  <div className="mt-1 text-xs text-ink-4">{cls._count.students} 名学生 · {countGroups} 个分组</div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-line bg-surface shadow-fs">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">分组情况</CardTitle>
              <Badge variant="outline">{classGroups.length} 组</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <Metric label="学生" value={members.length} />
              <Metric label="未分组" value={ungroupedCount} />
              <Metric label="平均组员" value={classGroups.length ? Math.round(members.length / classGroups.length) : 0} />
            </div>

            {classGroups.length === 0 ? (
              <div className="rounded-lg border border-dashed border-line bg-paper-alt py-10 text-center text-sm text-ink-4">
                当前班级还没有分组
              </div>
            ) : (
              <div className="space-y-2">
                {classGroups.map((group) => (
                  <div key={group.id} className="rounded-lg border border-line bg-paper p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-semibold text-ink">{group.name}</span>
                          <Badge variant="secondary">{group._count.members} 人</Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {group.members.slice(0, 8).map((member) => (
                            <span key={member.student.id} className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] text-brand">
                              {member.student.name}
                            </span>
                          ))}
                          {group.members.length > 8 && <span className="text-xs text-ink-5">+{group.members.length - 8}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(group)} title="编辑分组">
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => setDeleteGroupId(group.id)} title="删除分组">
                          <Trash2 className="size-4 text-danger" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-line bg-surface shadow-fs">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">人员信息</CardTitle>
              <div className="flex items-center gap-2">
                {membersLoading && <Loader2 className="size-4 animate-spin text-ink-4" />}
                <Button size="sm" variant="outline" disabled={!selectedClassId} onClick={() => setImportOpen(true)}>批量导入学生</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 md:grid-cols-[1fr_180px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-5" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索姓名或邮箱" className="pl-9" />
              </div>
              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_GROUPS}>全部学生</SelectItem>
                  <SelectItem value={UNGROUPED}>未分组</SelectItem>
                  {classGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-paper-alt px-3 py-2">
              <Checkbox
                disabled={membersLoading || Boolean(membersError) || filteredMembers.length === 0}
                checked={allFilteredSelected}
                onCheckedChange={toggleAllFiltered}
                aria-label="选择当前筛选学生"
              />
              <span className="text-xs text-ink-4">
                全选筛选结果 {filteredMembers.length} 人 · 已选 <b className="text-ink">{selectedMemberIds.size}</b> 人
              </span>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Button size="sm" className="h-8" onClick={() => setBulkOpen(true)}
                  disabled={membersLoading || Boolean(membersError) || selectedMemberIds.size === 0}>
                  批量管理
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8"
                  onClick={() => setSelectedMemberIds(new Set())}
                  disabled={selectedMemberIds.size === 0}
                >
                  清空
                </Button>
              </div>
            </div>

            {operationResult && <p role="status" className="rounded-md bg-brand-soft p-3 text-sm text-brand">{operationResult}</p>}
            {selectedMemberIds.size > filteredMembers.filter(member => selectedMemberIds.has(member.id)).length && <p className="text-xs text-ink-4">已选人数包含被当前筛选隐藏的学生；批量操作会处理全部已选学生。</p>}
            {membersError && <div role="alert" className="text-sm text-danger">{membersError}<Button variant="link" onClick={() => fetchMembers(selectedClassId)}>重新加载</Button></div>}
            <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
              {filteredMembers.map((member) => {
                const groupsForMember = memberGroupMap.get(member.id) ?? [];
                return (
                  <div key={member.id} className="rounded-lg border border-line bg-paper p-3">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedMemberIds.has(member.id)}
                        onCheckedChange={() => toggleSelectedMember(member.id)}
                        aria-label={`选择 ${member.name}`}
                      />
                      <div className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-ink">{member.name}</div>
                        <div className="truncate text-xs text-ink-4">{member.email}</div>
                      </div>
                      <Badge variant="outline">{groupsForMember.length ? `${groupsForMember.length} 组` : "未分组"}</Badge>
                    </div>
                    {groupsForMember.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {groupsForMember.map((group) => (
                          <span key={group.id} className="rounded bg-paper-alt px-2 py-0.5 text-[11px] text-ink-4">{group.name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {!membersLoading && !membersError && filteredMembers.length === 0 && (
                <div className="rounded-lg border border-dashed border-line bg-paper-alt py-10 text-center text-sm text-ink-4">
                  没有符合筛选条件的学生
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {bulkOpen && selectedClass && <BulkRosterDialog sourceClass={selectedClass} classes={classes} groups={groups}
        studentIds={Array.from(selectedMemberIds)} onClose={() => setBulkOpen(false)} onComplete={refreshRoster} />}
      {importOpen && selectedClass && <ImportStudentsDialog classId={selectedClass.id} className={selectedClass.name}
        onClose={() => setImportOpen(false)} onComplete={() => refreshRoster()} />}

      <Dialog open={createClassOpen} onOpenChange={setCreateClassOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新建班级</DialogTitle>
            <DialogDescription>创建后将立即出现在左侧班级列表，可直接选用。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>班级名称 <span className="text-danger">*</span></Label>
              <Input
                value={classNameDraft}
                onChange={(event) => setClassNameDraft(event.target.value)}
                placeholder="例如：2024 级金融 1 班"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>学年（选填）</Label>
              <Input
                value={classYearDraft}
                onChange={(event) => setClassYearDraft(event.target.value)}
                placeholder="例如：2024-2025"
                maxLength={20}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateClassOpen(false)}>取消</Button>
            <Button onClick={saveCreateClass} disabled={creatingClass || !classNameDraft.trim()}>
              {creatingClass && <Loader2 className="mr-2 size-4 animate-spin" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GroupDialog
        open={createOpen}
        title="新建分组"
        description={selectedClass ? `班级：${selectedClass.name}` : "请选择班级"}
        members={members}
        name={draftName}
        selectedIds={draftMemberIds}
        saving={saving}
        onOpenChange={setCreateOpen}
        onNameChange={setDraftName}
        onToggleMember={toggleDraftMember}
        onSave={saveCreate}
      />

      <GroupDialog
        open={Boolean(editGroup)}
        title="编辑分组"
        description={editGroup ? `班级：${editGroup.class.name}` : ""}
        members={members}
        name={draftName}
        selectedIds={draftMemberIds}
        saving={saving}
        onOpenChange={(open) => !open && setEditGroup(null)}
        onNameChange={setDraftName}
        onToggleMember={toggleDraftMember}
        onSave={saveEdit}
      />

      <AlertDialog open={Boolean(deleteGroupId)} onOpenChange={() => setDeleteGroupId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除分组？</AlertDialogTitle>
            <AlertDialogDescription>删除后不会删除学生账号，但该分组关系会被移除。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={deleteGroup} className="bg-danger text-white hover:bg-danger/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-line bg-paper-alt p-3">
      <div className="text-[11px] text-ink-4">{label}</div>
      <div className="mt-1 text-2xl font-bold text-ink">{value}</div>
    </div>
  );
}

function GroupDialog(props: {
  open: boolean;
  title: string;
  description: string;
  members: ClassMember[];
  name: string;
  selectedIds: Set<string>;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onNameChange: (name: string) => void;
  onToggleMember: (id: string) => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogDescription>{props.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>分组名称</Label>
            <Input value={props.name} onChange={(event) => props.onNameChange(event.target.value)} placeholder="例如：风险沟通练习组" />
          </div>
          <div className="space-y-2">
            <Label>选择学生（{props.selectedIds.size} 人）</Label>
            <div className="max-h-[320px] space-y-1 overflow-y-auto rounded-lg border border-line p-2">
              {props.members.map((member) => (
                <label key={member.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 hover:bg-paper-alt">
                  <Checkbox checked={props.selectedIds.has(member.id)} onCheckedChange={() => props.onToggleMember(member.id)} />
                  <Users className="size-4 text-ink-5" />
                  <span className="text-sm font-medium text-ink-2">{member.name}</span>
                  <span className="ml-auto text-xs text-ink-4">{member.email}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>取消</Button>
          <Button onClick={props.onSave} disabled={props.saving}>
            {props.saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
