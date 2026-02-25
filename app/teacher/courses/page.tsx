"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Loader2,
  AlertCircle,
  Users,
  Plus,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface CourseClassItem {
  id: string;
  classId: string;
  class: { id: string; name: string };
}

interface Course {
  id: string;
  courseTitle: string;
  courseCode: string | null;
  description: string | null;
  createdAt: string;
  class: {
    id: string;
    name: string;
  };
  classes?: CourseClassItem[];
}

interface ClassItem {
  id: string;
  name: string;
  _count: { students: number };
}

export default function TeacherCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state
  const [courseTitle, setCourseTitle] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [description, setDescription] = useState("");
  const [classId, setClassId] = useState("");

  async function fetchData() {
    try {
      const [coursesRes, classesRes] = await Promise.all([
        fetch("/api/lms/courses"),
        fetch("/api/lms/classes"),
      ]);
      const coursesJson = await coursesRes.json();
      const classesJson = await classesRes.json();

      if (!coursesJson.success) {
        setError(coursesJson.error?.message || "加载课程失败");
        return;
      }
      setCourses(coursesJson.data);

      if (classesJson.success) {
        setClasses(classesJson.data);
      }
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function handleCreate() {
    if (!courseTitle.trim()) {
      setFormError("请输入课程名称");
      return;
    }
    if (!classId) {
      setFormError("请选择班级");
      return;
    }

    setCreating(true);
    setFormError(null);

    try {
      const res = await fetch("/api/lms/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseTitle: courseTitle.trim(),
          courseCode: courseCode.trim() || undefined,
          description: description.trim() || undefined,
          classId,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setFormError(json.error?.message || "创建失败");
        return;
      }

      // Reset form and refresh
      setCourseTitle("");
      setCourseCode("");
      setDescription("");
      setClassId("");
      setDialogOpen(false);
      setLoading(true);
      fetchData();
    } catch {
      setFormError("网络错误，请稍后重试");
    } finally {
      setCreating(false);
    }
  }

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">课程管理</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4 mr-2" />
              创建课程
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建新课程</DialogTitle>
              <DialogDescription>
                填写课程基本信息，选择关联班级。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="courseTitle">课程名称 *</Label>
                <Input
                  id="courseTitle"
                  placeholder="例如：个人理财规划"
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="courseCode">课程代码</Label>
                <Input
                  id="courseCode"
                  placeholder="例如：FIN101"
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">课程描述</Label>
                <Textarea
                  id="description"
                  placeholder="简要描述课程内容..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="classId">关联班级 *</Label>
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger>
                    <SelectValue placeholder="请选择班级" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}（{c._count.students} 人）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {formError && (
                <p className="text-sm text-destructive">{formError}</p>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={creating}
              >
                取消
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    创建中...
                  </>
                ) : (
                  "确认创建"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {courses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="size-12 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">暂无课程</p>
            <p className="text-sm text-muted-foreground">点击上方按钮创建第一门课程</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Card key={course.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <BookOpen className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">
                      {course.courseTitle}
                    </CardTitle>
                    {course.courseCode && (
                      <CardDescription>{course.courseCode}</CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {course.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {course.description}
                  </p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  {course.classes && course.classes.length > 0 ? (
                    course.classes.map((cc) => (
                      <Badge key={cc.id} variant="secondary" className="flex items-center gap-1">
                        <Users className="size-3" />
                        {cc.class.name}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Users className="size-3" />
                      {course.class.name}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    创建于 {new Date(course.createdAt).toLocaleDateString("zh-CN")}
                  </span>
                </div>
                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/teacher/courses/${course.id}`}>管理课程</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
