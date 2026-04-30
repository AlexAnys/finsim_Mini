"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
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

  const [createOpen, setCreateOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<StudentGroup | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftMemberIds, setDraftMemberIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);

  const fetchClasses = useCallback(async () => {
    const res = await fetch("/api/lms/classes");
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || "加载班级失败");
    setClasses(json.data || []);
    if (!selectedClassId && json.data?.[0]?.id) setSelectedClassId(json.data[0].id);
  }, [selectedClassId]);

  const fetchGroups = useCallback(async () => {
    const res = await fetch("/api/groups");
    const json = await res.json();
    if (json.success) setGroups(json.data || []);
  }, []);

  const fetchMembers = useCallback(async (classId: string) => {
    if (!classId) return;
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/lms/classes/${classId}/members`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "加载成员失败");
      setMembers(json.data || []);
    } catch {
      toast.error("加载班级成员失败");
    } finally {
      setMembersLoading(false);
    }
  }, []);

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
    if (selectedClassId) fetchMembers(selectedClassId);
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

  function openCreate() {
    setDraftName("");
    setDraftMemberIds(new Set());
    setCreateOpen(true);
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
        <Button onClick={openCreate} disabled={!selectedClassId}>
          <Plus className="mr-2 size-4" />
          新建分组
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[280px_1fr_1.2fr]">
        <Card className="border-line bg-surface shadow-fs">
          <CardHeader>
            <CardTitle className="text-base">班级</CardTitle>
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
                    setSelectedClassId(cls.id);
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
              {membersLoading && <Loader2 className="size-4 animate-spin text-ink-4" />}
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

            <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
              {filteredMembers.map((member) => {
                const groupsForMember = memberGroupMap.get(member.id) ?? [];
                return (
                  <div key={member.id} className="rounded-lg border border-line bg-paper p-3">
                    <div className="flex items-center gap-3">
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
              {filteredMembers.length === 0 && (
                <div className="rounded-lg border border-dashed border-line bg-paper-alt py-10 text-center text-sm text-ink-4">
                  没有符合筛选条件的学生
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

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
