"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { toast } from "sonner";
import {
  Bot,
  X,
  Send,
  Loader2,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STUDY_BUDDY_POS_KEY = "finsim_studybuddy_pos";
const STUDY_BUDDY_DEFAULT_OFFSET = 80;

interface StudyBuddyPosition {
  x: number;
  y: number;
}

interface StudyBuddyDragState {
  offsetX: number;
  offsetY: number;
  startX: number;
  startY: number;
  width: number;
  height: number;
  suppressClick: boolean;
}

function getDefaultStudyBuddyPosition(): StudyBuddyPosition {
  if (typeof window === "undefined") {
    return { x: 0, y: 0 };
  }

  return {
    x: Math.max(0, window.innerWidth - STUDY_BUDDY_DEFAULT_OFFSET),
    y: Math.max(0, window.innerHeight - STUDY_BUDDY_DEFAULT_OFFSET),
  };
}

function clampStudyBuddyPosition(
  position: StudyBuddyPosition,
  width: number,
  height: number
): StudyBuddyPosition {
  if (typeof window === "undefined") {
    return position;
  }

  return {
    x: Math.max(0, Math.min(position.x, window.innerWidth - width)),
    y: Math.max(0, Math.min(position.y, window.innerHeight - height)),
  };
}

function readStudyBuddyPosition(): StudyBuddyPosition | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(STUDY_BUDDY_POS_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as Partial<StudyBuddyPosition>;
    if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
      return { x: parsed.x as number, y: parsed.y as number };
    }
  } catch {
    return null;
  }

  return null;
}

interface StudyBuddyPost {
  id: string;
  taskId: string;
  title: string;
  question: string;
  mode: "socratic" | "direct";
  anonymous: boolean;
  status: string;
  aiReply: string | null;
  messages: Array<{ role: string; content: string; createdAt: string }>;
  createdAt: string;
}

interface StudyBuddyPanelProps {
  taskId: string;
  taskInstanceId: string;
}

export function StudyBuddyPanel({ taskId, taskInstanceId }: StudyBuddyPanelProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"form" | "history" | "chat">("form");

  // Form state
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<"socratic" | "direct">("socratic");
  const [anonymous, setAnonymous] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // History state
  const [posts, setPosts] = useState<StudyBuddyPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [selectedPost, setSelectedPost] = useState<StudyBuddyPost | null>(null);
  const [followUpInput, setFollowUpInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<StudyBuddyDragState | null>(null);
  const suppressNextClickRef = useRef(false);
  const [position, setPosition] = useState<StudyBuddyPosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const initialPosition = readStudyBuddyPosition() ?? getDefaultStudyBuddyPosition();
    const element = buttonRef.current;
    const width = element?.offsetWidth ?? STUDY_BUDDY_DEFAULT_OFFSET;
    const height = element?.offsetHeight ?? STUDY_BUDDY_DEFAULT_OFFSET;

    setPosition(clampStudyBuddyPosition(initialPosition, width, height));
  }, []);

  useEffect(() => {
    if (!position) return;

    try {
      window.localStorage.setItem(STUDY_BUDDY_POS_KEY, JSON.stringify(position));
    } catch {
      // localStorage may be unavailable in private browsing modes.
    }
  }, [position]);

  useEffect(() => {
    if (!position) return;

    const element = open ? panelRef.current : buttonRef.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const clamped = clampStudyBuddyPosition(position, rect.width, rect.height);
    if (clamped.x !== position.x || clamped.y !== position.y) {
      setPosition(clamped);
    }
  }, [open, position]);

  useEffect(() => {
    function handleResize() {
      const element = open ? panelRef.current : buttonRef.current;
      if (!element) return;

      const rect = element.getBoundingClientRect();
      setPosition((current) =>
        current ? clampStudyBuddyPosition(current, rect.width, rect.height) : current
      );
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [open]);

  useEffect(() => {
    if (!isDragging) return;

    function handleMouseMove(event: MouseEvent) {
      const dragState = dragStateRef.current;
      if (!dragState) return;

      if (
        dragState.suppressClick &&
        (Math.abs(event.clientX - dragState.startX) > 3 ||
          Math.abs(event.clientY - dragState.startY) > 3)
      ) {
        suppressNextClickRef.current = true;
      }

      setPosition(
        clampStudyBuddyPosition(
          {
            x: event.clientX - dragState.offsetX,
            y: event.clientY - dragState.offsetY,
          },
          dragState.width,
          dragState.height
        )
      );
    }

    function handleMouseUp() {
      dragStateRef.current = null;
      setIsDragging(false);
    }

    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = "move";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.body.style.cursor = previousCursor;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  function handleDragStart(
    event: ReactMouseEvent<HTMLElement>,
    element: HTMLElement | null,
    options: { ignoreInteractive?: boolean; suppressClick?: boolean } = {}
  ) {
    if (event.button !== 0 || !element) return;

    const target = event.target as HTMLElement;
    if (
      options.ignoreInteractive &&
      target.closest("button, input, textarea, select, a, [role='button']")
    ) {
      return;
    }

    const rect = element.getBoundingClientRect();
    dragStateRef.current = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      startX: event.clientX,
      startY: event.clientY,
      width: rect.width,
      height: rect.height,
      suppressClick: Boolean(options.suppressClick),
    };
    setPosition({ x: rect.left, y: rect.top });
    setIsDragging(true);
    event.preventDefault();
  }

  const floatingStyle = position
    ? { left: position.x, top: position.y }
    : { right: 24, bottom: 24 };

  const fetchPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const res = await fetch(`/api/study-buddy/posts?taskId=${taskId}&taskInstanceId=${taskInstanceId}`);
      const json = await res.json();
      if (json.success) {
        setPosts(json.data || []);
      }
    } catch {
      // silent fail
    } finally {
      setLoadingPosts(false);
    }
  }, [taskId, taskInstanceId]);

  useEffect(() => {
    if (open && view === "history") {
      fetchPosts();
    }
  }, [open, view, fetchPosts]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedPost?.messages]);

  // Auto-refresh selected post if pending
  useEffect(() => {
    if (!selectedPost || selectedPost.status !== "pending") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/study-buddy/posts?taskId=${taskId}&taskInstanceId=${taskInstanceId}`);
        const json = await res.json();
        if (json.success) {
          const updated = (json.data || []).find(
            (p: StudyBuddyPost) => p.id === selectedPost.id
          );
          if (updated && updated.status !== "pending") {
            setSelectedPost(updated);
            setPosts((prev) =>
              prev.map((p) => (p.id === updated.id ? updated : p))
            );
          }
        }
      } catch {
        // ignore
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedPost, taskId, taskInstanceId]);

  async function handleCreate() {
    if (!title.trim() || !question.trim()) {
      toast.error("请填写标题和问题");
      return;
    }
    setIsCreating(true);
    try {
      const res = await fetch("/api/study-buddy/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          taskInstanceId,
          title,
          question,
          mode,
          anonymous,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "提交失败");
        return;
      }
      toast.success("问题已提交，AI 正在思考...");
      setTitle("");
      setQuestion("");
      setMode("socratic");
      setAnonymous(false);
      setView("history");
      fetchPosts();
    } catch {
      toast.error("提交失败，请重试");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleFollowUp() {
    if (!selectedPost || !followUpInput.trim() || isSending) return;
    setIsSending(true);
    try {
      const res = await fetch("/api/ai/study-buddy/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: selectedPost.id,
          content: followUpInput,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "发送失败");
        return;
      }
      const newMsg = {
        role: "student",
        content: followUpInput,
        createdAt: new Date().toISOString(),
      };
      setSelectedPost((prev) =>
        prev
          ? { ...prev, messages: [...prev.messages, newMsg], status: "pending" }
          : prev
      );
      setFollowUpInput("");
    } catch {
      toast.error("发送失败，请重试");
    } finally {
      setIsSending(false);
    }
  }

  if (!open) {
    return (
      <button
        ref={buttonRef}
        onMouseDown={(event) =>
          handleDragStart(event, buttonRef.current, { suppressClick: true })
        }
        onClick={() => {
          if (suppressNextClickRef.current) {
            suppressNextClickRef.current = false;
            return;
          }
          setOpen(true);
        }}
        className="fixed z-50 flex size-14 cursor-move items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-transform hover:scale-105 hover:bg-blue-700"
        style={floatingStyle}
      >
        <Bot className="size-6" />
      </button>
    );
  }

  return (
    <div
      ref={panelRef}
      className="fixed z-50"
      style={floatingStyle}
      onMouseDown={(event) =>
        handleDragStart(event, panelRef.current, { ignoreInteractive: true })
      }
    >
      <Card className="w-[340px] shadow-2xl">
        <CardHeader className="cursor-move pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="size-4" />
              Study Buddy
            </CardTitle>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => setOpen(false)}>
              <X className="size-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">AI 学习助手，随时为你解答</p>
          {/* Tab switcher */}
          <div className="mt-2 flex gap-1">
            <Button
              variant={view === "form" ? "default" : "ghost"}
              size="sm"
              className="h-7 flex-1 text-xs"
              onClick={() => { setView("form"); setSelectedPost(null); }}
            >
              新建提问
            </Button>
            <Button
              variant={view === "history" ? "default" : "ghost"}
              size="sm"
              className="h-7 flex-1 text-xs"
              onClick={() => { setView("history"); setSelectedPost(null); }}
            >
              历史提问 ({posts.length})
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-3 pt-0">
          {view === "form" && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">标题</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="简要描述你的问题"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">问题详情</Label>
                <Textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="详细描述你遇到的问题..."
                  rows={3}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">回答模式</Label>
                <Select
                  value={mode}
                  onValueChange={(v) => setMode(v as "socratic" | "direct")}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="socratic">启发式</SelectItem>
                    <SelectItem value="direct">直接解答</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={anonymous}
                  onCheckedChange={setAnonymous}
                  className="scale-75"
                />
                <Label className="text-xs">匿名提问</Label>
              </div>
              <Button
                onClick={handleCreate}
                disabled={isCreating}
                className="w-full"
                size="sm"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="size-3 animate-spin" />
                    提交中...
                  </>
                ) : (
                  <>
                    <Send className="size-3" />
                    发送给 Study Buddy
                  </>
                )}
              </Button>
            </div>
          )}

          {view === "history" && !selectedPost && (
            <div className="space-y-2">
              {loadingPosts ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : posts.length === 0 ? (
                <div className="py-8 text-center">
                  <Bot className="mx-auto size-8 text-muted-foreground" />
                  <p className="mt-2 text-xs text-muted-foreground">
                    还没有提过问题
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[320px]">
                  <div className="space-y-2 pr-2">
                    {posts.map((post) => (
                      <div
                        key={post.id}
                        className="flex cursor-pointer items-start gap-2 rounded-lg border p-2 transition-colors hover:bg-muted/50"
                        onClick={() => { setSelectedPost(post); setView("history"); }}
                      >
                        <MessageCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{post.title}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <Badge
                              variant={
                                post.status === "answered" ? "default"
                                : post.status === "error" ? "destructive"
                                : "secondary"
                              }
                              className="text-[10px] px-1 py-0"
                            >
                              {post.status === "answered" ? "已回复"
                               : post.status === "error" ? "回复失败"
                               : "等待中"}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {post.messages.length} 条消息
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}

          {view === "history" && selectedPost && (
            <div className="space-y-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1 text-xs"
                onClick={() => setSelectedPost(null)}
              >
                &larr; 返回列表
              </Button>
              <p className="text-sm font-medium">{selectedPost.title}</p>
              <ScrollArea className="h-[260px]">
                <div className="space-y-2 pr-2">
                  {selectedPost.messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${
                        msg.role === "student" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                          msg.role === "student"
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-muted rounded-bl-sm"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  {selectedPost.status === "pending" && (
                    <div className="flex justify-start">
                      <div className="rounded-xl rounded-bl-sm bg-muted px-3 py-2">
                        <Loader2 className="size-3 animate-spin text-muted-foreground" />
                      </div>
                    </div>
                  )}
                  {selectedPost.status === "error" && (
                    <div className="flex justify-start">
                      <div className="rounded-xl rounded-bl-sm bg-red-50 px-3 py-2 text-xs text-red-600">
                        AI 回复失败，请重试
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              <div className="flex gap-1">
                <Input
                  value={followUpInput}
                  onChange={(e) => setFollowUpInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleFollowUp();
                    }
                  }}
                  placeholder="继续提问..."
                  disabled={isSending || selectedPost.status === "pending"}
                  className="h-8 text-xs"
                />
                <Button
                  onClick={handleFollowUp}
                  disabled={
                    !followUpInput.trim() ||
                    isSending ||
                    selectedPost.status === "pending"
                  }
                  size="icon"
                  className="size-8 shrink-0"
                >
                  {isSending ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Send className="size-3" />
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
