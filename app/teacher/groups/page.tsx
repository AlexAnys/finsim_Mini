"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  Users,
  ChevronDown,
  ChevronRight,
  Pencil,
} from "lucide-react";

// --------------- Types ---------------

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

interface GroupMemberStudent {
  id: string;
  name: string;
  email: string;
}

interface GroupMember {
  student: GroupMemberStudent;
}

interface StudentGroup {
  id: string;
  name: string;
  type: string;
  classId: string;
  class: { id: string; name: string };
  members: GroupMember[];
  _count: { members: number };
  createdAt: string;
}

// --------------- Component ---------------

export default function TeacherGroupsPage() {
  const [classes, setClasses] = useState<LmsClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab 1: Class Members
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [members, setMembers] = useState<ClassMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Tab 2: Groups
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(
    new Set()
  );

  // Create group dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createClassId, setCreateClassId] = useState("");
  const [createClassMembers, setCreateClassMembers] = useState<ClassMember[]>(
    []
  );
  const [createSelectedStudents, setCreateSelectedStudents] = useState<
    Set<string>
  >(new Set());
  const [createMembersLoading, setCreateMembersLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // Edit group dialog
  const [editGroup, setEditGroup] = useState<StudentGroup | null>(null);
  const [editName, setEditName] = useState("");
  const [editClassMembers, setEditClassMembers] = useState<ClassMember[]>([]);
  const [editSelectedStudents, setEditSelectedStudents] = useState<Set<string>>(
    new Set()
  );
  const [editMembersLoading, setEditMembersLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Delete group
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);

  // --------------- Fetch helpers ---------------

  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetch("/api/lms/classes");
      const json = await res.json();
      if (json.success) setClasses(json.data || []);
    } catch {
      setError("加载班级列表失败");
    }
  }, []);

  const fetchGroups = useCallback(async () => {
    setGroupsLoading(true);
    try {
      const res = await fetch("/api/groups");
      const json = await res.json();
      if (json.success) setGroups(json.data || []);
    } catch {
      // silent — groups tab will show empty
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  const fetchClassMembers = useCallback(
    async (classId: string): Promise<ClassMember[]> => {
      const res = await fetch(`/api/lms/classes/${classId}/members`);
      const json = await res.json();
      if (json.success) return json.data || [];
      return [];
    },
    []
  );

  useEffect(() => {
    async function init() {
      await Promise.all([fetchClasses(), fetchGroups()]);
      setLoading(false);
    }
    init();
  }, [fetchClasses, fetchGroups]);

  // --------------- Tab 1 handlers ---------------

  async function handleClassSelect(classId: string) {
    setSelectedClassId(classId);
    if (!classId) {
      setMembers([]);
      return;
    }
    setMembersLoading(true);
    try {
      const data = await fetchClassMembers(classId);
      setMembers(data);
    } catch {
      toast.error("加载班级成员失败");
    } finally {
      setMembersLoading(false);
    }
  }

  // --------------- Tab 2: Create group ---------------

  function openCreateDialog() {
    setCreateName("");
    setCreateClassId("");
    setCreateClassMembers([]);
    setCreateSelectedStudents(new Set());
    setShowCreateDialog(true);
  }

  async function handleCreateClassChange(classId: string) {
    setCreateClassId(classId);
    setCreateSelectedStudents(new Set());
    if (!classId) {
      setCreateClassMembers([]);
      return;
    }
    setCreateMembersLoading(true);
    try {
      const data = await fetchClassMembers(classId);
      setCreateClassMembers(data);
    } catch {
      toast.error("加载班级成员失败");
    } finally {
      setCreateMembersLoading(false);
    }
  }

  function toggleCreateStudent(studentId: string) {
    setCreateSelectedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  async function handleCreateGroup() {
    if (!createName.trim()) {
      toast.error("请输入分组名称");
      return;
    }
    if (!createClassId) {
      toast.error("请选择班级");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: createClassId,
          name: createName.trim(),
          type: "manual",
          studentIds: Array.from(createSelectedStudents),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "创建失败");
        return;
      }
      toast.success("分组已创建");
      setShowCreateDialog(false);
      fetchGroups();
    } catch {
      toast.error("创建失败，请重试");
    } finally {
      setCreating(false);
    }
  }

  // --------------- Tab 2: Edit group ---------------

  async function openEditDialog(group: StudentGroup) {
    setEditGroup(group);
    setEditName(group.name);
    const currentMemberIds = new Set(
      group.members.map((m) => m.student.id)
    );
    setEditSelectedStudents(currentMemberIds);
    setEditMembersLoading(true);
    try {
      const data = await fetchClassMembers(group.classId);
      setEditClassMembers(data);
    } catch {
      toast.error("加载班级成员失败");
    } finally {
      setEditMembersLoading(false);
    }
  }

  function toggleEditStudent(studentId: string) {
    setEditSelectedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  async function handleSaveEdit() {
    if (!editGroup) return;
    if (!editName.trim()) {
      toast.error("请输入分组名称");
      return;
    }
    setSaving(true);

    const originalIds = new Set(editGroup.members.map((m) => m.student.id));
    const addStudentIds = Array.from(editSelectedStudents).filter(
      (id) => !originalIds.has(id)
    );
    const removeStudentIds = Array.from(originalIds).filter(
      (id) => !editSelectedStudents.has(id)
    );

    try {
      const res = await fetch(`/api/groups/${editGroup.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          addStudentIds: addStudentIds.length > 0 ? addStudentIds : undefined,
          removeStudentIds:
            removeStudentIds.length > 0 ? removeStudentIds : undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "保存失败");
        return;
      }
      toast.success("分组已更新");
      setEditGroup(null);
      fetchGroups();
    } catch {
      toast.error("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  // --------------- Tab 2: Delete group ---------------

  async function handleDeleteGroup() {
    if (!deleteGroupId) return;
    try {
      const res = await fetch(`/api/groups/${deleteGroupId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "删除失败");
        return;
      }
      toast.success("分组已删除");
      setGroups((prev) => prev.filter((g) => g.id !== deleteGroupId));
    } catch {
      toast.error("删除失败，请重试");
    } finally {
      setDeleteGroupId(null);
    }
  }

  // --------------- Expand / Collapse ---------------

  function toggleExpand(groupId: string) {
    setExpandedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  // --------------- Render ---------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">加载中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2">
        <AlertCircle className="size-8 text-destructive" />
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">班级与分组管理</h1>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">班级成员</TabsTrigger>
          <TabsTrigger value="groups">学生分组</TabsTrigger>
        </TabsList>

        {/* ============= Tab 1: 班级成员 ============= */}
        <TabsContent value="members" className="space-y-4">
          <div className="flex items-center gap-4">
            <Label className="shrink-0">选择班级</Label>
            <Select value={selectedClassId} onValueChange={handleClassSelect}>
              <SelectTrigger className="w-[260px]">
                <SelectValue placeholder="请选择班级" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name}（{cls._count.students} 人）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {membersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">加载中...</span>
            </div>
          ) : selectedClassId && members.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="size-12 text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">该班级暂无成员</p>
              </CardContent>
            </Card>
          ) : selectedClassId && members.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  共 {members.length} 名学生
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>姓名</TableHead>
                      <TableHead>邮箱</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {m.email}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="size-12 text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">
                  请先选择一个班级查看成员
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============= Tab 2: 学生分组 ============= */}
        <TabsContent value="groups" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              共 {groups.length} 个分组
            </p>
            <Button onClick={openCreateDialog}>
              <Plus className="size-4 mr-1" />
              创建分组
            </Button>
          </div>

          {groupsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">加载中...</span>
            </div>
          ) : groups.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="size-12 text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">暂无分组</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {groups.map((group) => {
                const isExpanded = expandedGroupIds.has(group.id);
                return (
                  <Card key={group.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          className="flex min-w-0 items-center gap-2 text-left"
                          aria-expanded={isExpanded}
                          onClick={() => toggleExpand(group.id)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="size-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="size-4 text-muted-foreground" />
                          )}
                          <span className="truncate text-base font-semibold leading-none">
                            {group.name}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {group.class.name}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {group._count.members} 人
                          </Badge>
                        </button>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(group)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteGroupId(group.id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    {isExpanded && (
                      <CardContent className="pt-0">
                        <Separator className="mb-3" />
                        {group.members.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-2">
                            该分组暂无成员
                          </p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>姓名</TableHead>
                                <TableHead>邮箱</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.members.map((m) => (
                                <TableRow key={m.student.id}>
                                  <TableCell className="font-medium">
                                    {m.student.name}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {m.student.email}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ============= Create Group Dialog ============= */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>创建分组</DialogTitle>
            <DialogDescription>
              选择班级并勾选要加入分组的学生
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>分组名称</Label>
              <Input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="输入分组名称"
              />
            </div>
            <div className="space-y-2">
              <Label>班级</Label>
              <Select
                value={createClassId}
                onValueChange={handleCreateClassChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择班级" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}（{cls._count.students} 人）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {createClassId && (
              <div className="space-y-2">
                <Label>
                  选择学生（已选 {createSelectedStudents.size} 人）
                </Label>
                {createMembersLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">
                      加载中...
                    </span>
                  </div>
                ) : createClassMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    该班级暂无学生
                  </p>
                ) : (
                  <div className="max-h-[240px] overflow-y-auto border rounded-md p-2 space-y-1">
                    {createClassMembers.map((student) => (
                      <label
                        key={student.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                      >
                        <Checkbox
                          checked={createSelectedStudents.has(student.id)}
                          onCheckedChange={() =>
                            toggleCreateStudent(student.id)
                          }
                        />
                        <span className="text-sm">{student.name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {student.email}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
            >
              取消
            </Button>
            <Button onClick={handleCreateGroup} disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  创建中...
                </>
              ) : (
                "创建"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============= Edit Group Dialog ============= */}
      <Dialog open={!!editGroup} onOpenChange={() => setEditGroup(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑分组</DialogTitle>
            <DialogDescription>修改分组名称或调整成员</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>分组名称</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="输入分组名称"
              />
            </div>
            {editGroup && (
              <div className="space-y-2">
                <Label>
                  班级: {editGroup.class.name} - 已选{" "}
                  {editSelectedStudents.size} 人
                </Label>
                {editMembersLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">
                      加载中...
                    </span>
                  </div>
                ) : editClassMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    该班级暂无学生
                  </p>
                ) : (
                  <div className="max-h-[240px] overflow-y-auto border rounded-md p-2 space-y-1">
                    {editClassMembers.map((student) => (
                      <label
                        key={student.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                      >
                        <Checkbox
                          checked={editSelectedStudents.has(student.id)}
                          onCheckedChange={() =>
                            toggleEditStudent(student.id)
                          }
                        />
                        <span className="text-sm">{student.name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {student.email}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditGroup(null)}>
              取消
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  保存中...
                </>
              ) : (
                "保存"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============= Delete Confirm Dialog ============= */}
      <AlertDialog
        open={!!deleteGroupId}
        onOpenChange={() => setDeleteGroupId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              删除分组后不可恢复，确认要删除吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGroup}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
