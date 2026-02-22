"use client";

import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import {
  Loader2,
  AlertCircle,
  Bot,
  Send,
  Plus,
  MessageCircle,
  ChevronLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

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

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "等待回复", variant: "secondary" },
  answered: { label: "已回复", variant: "default" },
  error: { label: "回复失败", variant: "destructive" },
};

const modeLabels: Record<string, string> = {
  socratic: "引导式",
  direct: "直接回答",
};

export default function StudyBuddyPage() {
  const [posts, setPosts] = useState<StudyBuddyPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<StudyBuddyPost | null>(null);
  const [followUpInput, setFollowUpInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // New post form
  const [newTitle, setNewTitle] = useState("");
  const [newQuestion, setNewQuestion] = useState("");
  const [newMode, setNewMode] = useState<"socratic" | "direct">("socratic");
  const [newAnonymous, setNewAnonymous] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  async function fetchPosts() {
    try {
      const res = await fetch("/api/study-buddy/posts");
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || "加载失败");
        return;
      }
      setPosts(json.data || []);
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPosts();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedPost?.messages]);

  // Auto-refresh selected post if pending
  useEffect(() => {
    if (!selectedPost || selectedPost.status !== "pending") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/study-buddy/posts`);
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
  }, [selectedPost]);

  async function handleCreatePost() {
    if (!newTitle.trim() || !newQuestion.trim()) {
      toast.error("请填写标题和问题");
      return;
    }
    setIsCreating(true);
    try {
      // We need a taskId - for now use a placeholder that the API can handle
      const res = await fetch("/api/study-buddy/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: "00000000-0000-0000-0000-000000000000", // generic
          title: newTitle,
          question: newQuestion,
          mode: newMode,
          anonymous: newAnonymous,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "创建失败");
        return;
      }
      toast.success("问题已提交，AI 正在思考...");
      setShowNewDialog(false);
      setNewTitle("");
      setNewQuestion("");
      setNewMode("socratic");
      setNewAnonymous(false);
      fetchPosts();
    } catch {
      toast.error("创建失败，请重试");
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

      // Optimistic update
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

  // Chat detail view
  if (selectedPost) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedPost(null)}
          className="gap-1"
        >
          <ChevronLeft className="size-4" />
          返回列表
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{selectedPost.title}</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{modeLabels[selectedPost.mode]}</Badge>
                <Badge
                  variant={
                    (statusLabels[selectedPost.status] || statusLabels.pending).variant
                  }
                >
                  {(statusLabels[selectedPost.status] || statusLabels.pending).label}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-340px)]">
              <div className="space-y-3 p-4">
                {selectedPost.messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "student" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                        msg.role === "student"
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted rounded-bl-md"
                      }`}
                    >
                      {msg.role !== "student" && (
                        <div className="mb-1 flex items-center gap-1 text-xs opacity-70">
                          <Bot className="size-3" />
                          学习伙伴
                        </div>
                      )}
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      <p
                        className={`mt-1 text-[10px] ${
                          msg.role === "student"
                            ? "text-primary-foreground/60"
                            : "text-muted-foreground"
                        }`}
                      >
                        {new Date(msg.createdAt).toLocaleTimeString("zh-CN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
                {selectedPost.status === "pending" && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                      <Loader2 className="text-muted-foreground size-4 animate-spin" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Follow-up input */}
            <div className="border-t p-4">
              <div className="flex gap-2">
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
                />
                <Button
                  onClick={handleFollowUp}
                  disabled={
                    !followUpInput.trim() ||
                    isSending ||
                    selectedPost.status === "pending"
                  }
                  size="icon"
                >
                  {isSending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">学习伙伴</h1>
        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4 mr-1" />
              提问
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>向学习伙伴提问</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>标题</Label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="简要描述你的问题"
                />
              </div>
              <div className="space-y-2">
                <Label>问题详情</Label>
                <Textarea
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="详细描述你遇到的问题..."
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label>回答模式</Label>
                <Select
                  value={newMode}
                  onValueChange={(v) => setNewMode(v as "socratic" | "direct")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="socratic">引导式 (通过提问引导你思考)</SelectItem>
                    <SelectItem value="direct">直接回答</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={newAnonymous}
                  onCheckedChange={setNewAnonymous}
                />
                <Label>匿名提问</Label>
              </div>
              <Button
                onClick={handleCreatePost}
                disabled={isCreating}
                className="w-full"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    提交中...
                  </>
                ) : (
                  "提交问题"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {posts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Bot className="size-16 text-muted-foreground" />
            <p className="mt-4 text-lg font-medium">还没有提过问题</p>
            <p className="text-sm text-muted-foreground mt-1">
              遇到学习难题？向 AI 学习伙伴提问吧
            </p>
            <Button className="mt-4" onClick={() => setShowNewDialog(true)}>
              <Plus className="size-4 mr-1" />
              开始提问
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const statusCfg = statusLabels[post.status] || statusLabels.pending;
            return (
              <Card
                key={post.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedPost(post)}
              >
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="flex size-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                    <MessageCircle className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{post.title}</p>
                      <Badge variant={statusCfg.variant} className="shrink-0">
                        {statusCfg.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {post.question}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {modeLabels[post.mode]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {post.messages.length} 条消息
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(post.createdAt).toLocaleDateString("zh-CN")}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
