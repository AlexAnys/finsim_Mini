"use client";

// PR-STU-2 · 学生 /study-buddy 重布局（按 mockup `.harness/mockups/design/student-buddy.jsx`）
// - 左 340px：post 列表（课程 tag + 状态 + 标题 + 模式 + 时间）
// - 右 flex-1：对话头（课程·任务·模式·标题）+ messages 滚动 + composer
// - 数据：GET /api/study-buddy/posts + GET /api/lms/dashboard/summary（client-side join 派生 课程名）
// - 业务逻辑保留（PR-STU-2 不改 service / API / schema）：
//     · 创建 post → POST /api/study-buddy/posts（学生需显式选择关联任务，避免问题被隐式绑定到错误上下文）
//     · 跟进消息 → POST /api/ai/study-buddy/reply
//     · pending 时 3s 轮询单 post 直到 status 转 answered/error
//     · Socratic vs Direct 由 post 创建时锁定，跟进只展示不可改
//     · 匿名同上，由 post 创建时锁定

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { StudyBuddyList } from "@/components/study-buddy/study-buddy-list";
import { StudyBuddyConversation } from "@/components/study-buddy/study-buddy-conversation";
import { StudyBuddyNewPostDialog } from "@/components/study-buddy/study-buddy-new-post-dialog";
import {
  joinStudyBuddyPosts,
  sortPostsByCreatedDesc,
  type DashboardTaskLite,
  type RawStudyBuddyPost,
  type StudyBuddyMode,
  type StudyBuddyPostRow,
} from "@/lib/utils/study-buddy-transforms";

interface DashboardSummary {
  tasks?: Array<{
    id: string;
    title?: string;
    taskName?: string;
    taskId?: string;
    course?: { id?: string; courseTitle?: string } | null;
  }>;
}

export default function StudyBuddyPage() {
  const [rawPosts, setRawPosts] = useState<RawStudyBuddyPost[]>([]);
  const [dashboardTasks, setDashboardTasks] = useState<DashboardTaskLite[]>([]);
  const [studentName, setStudentName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Composer state
  const [followUpInput, setFollowUpInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  // New post dialog state
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newQuestion, setNewQuestion] = useState("");
  const [newMode, setNewMode] = useState<StudyBuddyMode>("socratic");
  const [newAnonymous, setNewAnonymous] = useState(false);
  const [newTaskInstanceId, setNewTaskInstanceId] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // 初始拉两个端点（并行）
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [postsRes, dashRes] = await Promise.all([
          fetch("/api/study-buddy/posts"),
          fetch("/api/lms/dashboard/summary"),
        ]);
        const postsJson = await postsRes.json();
        if (!postsJson.success) {
          if (!cancelled) {
            setError(postsJson.error?.message || "加载失败");
            setLoading(false);
          }
          return;
        }
        const items: RawStudyBuddyPost[] = postsJson.data || [];

        // dashboard summary 失败不阻塞列表 — courseName 退化为 null
        let tasks: DashboardTaskLite[] = [];
        try {
          const dashJson = await dashRes.json();
          if (dashJson.success) {
            const summary = dashJson.data as DashboardSummary;
            tasks = (summary.tasks ?? []).map((t) => ({
              id: t.id,
              title: t.title,
              taskName: t.taskName,
              taskId: t.taskId,
              course: t.course ?? null,
            }));
          }
        } catch {
          // 静默吞 — fallback null
        }

        // 学生姓名从 posts 自带的 student.name 取（service include 透传）
        const name =
          items.find((p) => p.student?.name)?.student?.name ?? null;

        if (!cancelled) {
          setRawPosts(items);
          setDashboardTasks(tasks);
          setStudentName(name);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("网络错误，请稍后重试");
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // 派生：sorted joined rows
  const posts = useMemo(
    () =>
      sortPostsByCreatedDesc(joinStudyBuddyPosts(rawPosts, dashboardTasks)),
    [rawPosts, dashboardTasks],
  );

  const selectableTasks = useMemo(
    () => dashboardTasks.filter((task) => Boolean(task.taskId)),
    [dashboardTasks],
  );

  useEffect(() => {
    if (
      newTaskInstanceId &&
      !selectableTasks.some((task) => task.id === newTaskInstanceId)
    ) {
      setNewTaskInstanceId("");
    }
  }, [newTaskInstanceId, selectableTasks]);

  // 默认选中第一条
  const selectedPost = useMemo<StudyBuddyPostRow | null>(() => {
    if (posts.length === 0) return null;
    if (selectedId) {
      const found = posts.find((p) => p.id === selectedId);
      if (found) return found;
    }
    return posts[0];
  }, [posts, selectedId]);

  // 学生首字（avatar 占位）— 优先 dashboard.summary.studentName，否则中性 "我"
  const studentInitial = useMemo(() => {
    const n = studentName?.trim();
    if (!n) return "我";
    // 取最后一个字（中文姓名通常名在后），fallback 第一个字符
    return n.charAt(n.length - 1) || n.charAt(0);
  }, [studentName]);

  // 当所选 post 处于 pending 时，轮询全 post 列表直到该 post 转 answered/error
  useEffect(() => {
    if (!selectedPost || selectedPost.status !== "pending") return;
    const id = selectedPost.id;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/study-buddy/posts");
        const json = await res.json();
        if (json.success) {
          const items: RawStudyBuddyPost[] = json.data || [];
          const updated = items.find((p) => p.id === id);
          if (updated && updated.status !== "pending") {
            setRawPosts(items);
          }
        }
      } catch {
        // ignore
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedPost]);

  async function handleCreatePost() {
    if (!newTitle.trim() || !newQuestion.trim()) {
      toast.error("请填写标题和问题");
      return;
    }
    const selectedTask = selectableTasks.find(
      (task) => task.id === newTaskInstanceId,
    );
    if (!selectedTask?.taskId) {
      toast.error(
        selectableTasks.length > 0
          ? "请选择要关联的任务"
          : "当前学期暂无可关联的任务，无法发起对话",
      );
      return;
    }
    setIsCreating(true);
    try {
      const res = await fetch("/api/study-buddy/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: selectedTask.taskId,
          taskInstanceId: selectedTask.id,
          title: newTitle.trim(),
          question: newQuestion.trim(),
          mode: newMode,
          anonymous: newAnonymous,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "创建失败");
        return;
      }
      toast.success("问题已提交，灵析 AI 正在思考…");
      setShowNewDialog(false);
      setNewTitle("");
      setNewQuestion("");
      setNewMode("socratic");
      setNewAnonymous(false);
      setNewTaskInstanceId("");

      // 立即把新 post 注入列表（等待 3s 轮询补全 messages/aiReply）
      const created = json.data as RawStudyBuddyPost | null;
      if (created) {
        setRawPosts((prev) => [created, ...prev]);
        setSelectedId(created.id);
      } else {
        // fallback：重拉列表
        const refresh = await fetch("/api/study-buddy/posts");
        const refreshJson = await refresh.json();
        if (refreshJson.success) {
          setRawPosts(refreshJson.data || []);
        }
      }
    } catch {
      toast.error("创建失败，请重试");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleSendFollowUp() {
    if (!selectedPost || !followUpInput.trim() || isSending) return;
    if (selectedPost.status === "pending") return;

    const content = followUpInput.trim();
    setIsSending(true);
    try {
      const res = await fetch("/api/ai/study-buddy/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: selectedPost.id,
          content,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "发送失败");
        return;
      }

      // 乐观更新：在 rawPosts 中找到对应 post，append student 消息 + 转 pending
      setRawPosts((prev) =>
        prev.map((p) =>
          p.id === selectedPost.id
            ? {
                ...p,
                status: "pending",
                messages: [
                  ...(p.messages ?? []),
                  {
                    role: "student",
                    content,
                    createdAt: new Date().toISOString(),
                  },
                ],
              }
            : p,
        ),
      );
      setFollowUpInput("");
    } catch {
      toast.error("发送失败，请重试");
    } finally {
      setIsSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-ink-5" />
        <span className="ml-2 text-sm text-ink-4">加载中…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-20">
        <AlertCircle className="size-8 text-danger" />
        <p className="text-sm text-danger">{error}</p>
      </div>
    );
  }

  // 整页用全宽容器破出 layout 的 p-6，撑满可用区域
  // 视高公式：viewport - topbar(56px) - layout p-6 上下 (24+24=48px) = 100vh - 6.5rem
  // 留 0.5rem 余量，最终 calc(100vh - 7rem)；mobile 走 stack 流式（无固定高度）
  return (
    <div className="-mx-6 -my-6 flex flex-col bg-paper lg:h-[calc(100vh-3rem)] lg:flex-row lg:overflow-hidden">
      <StudyBuddyList
        posts={posts}
        selectedId={selectedPost?.id ?? null}
        onSelect={setSelectedId}
        onNewClick={() => setShowNewDialog(true)}
      />
      <StudyBuddyConversation
        post={selectedPost}
        studentInitial={studentInitial}
        composerValue={followUpInput}
        onComposerChange={setFollowUpInput}
        onSendFollowUp={handleSendFollowUp}
        isSendingFollowUp={isSending}
        onCreateNew={() => setShowNewDialog(true)}
      />
      <StudyBuddyNewPostDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        title={newTitle}
        question={newQuestion}
        mode={newMode}
        anonymous={newAnonymous}
        tasks={selectableTasks}
        selectedTaskInstanceId={newTaskInstanceId}
        isSubmitting={isCreating}
        onTitleChange={setNewTitle}
        onQuestionChange={setNewQuestion}
        onModeChange={setNewMode}
        onAnonymousChange={setNewAnonymous}
        onSelectedTaskInstanceIdChange={setNewTaskInstanceId}
        onSubmit={handleCreatePost}
      />
    </div>
  );
}
