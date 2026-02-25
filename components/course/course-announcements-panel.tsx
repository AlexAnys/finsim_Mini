"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  Megaphone,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface Announcement {
  id: string;
  title: string;
  body: string;
  status: string;
  createdAt: string;
  creator?: { name: string };
}

export function CourseAnnouncementsPanel({ courseId }: { courseId: string }) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [creating, setCreating] = useState(false);

  async function fetchAnnouncements() {
    try {
      const res = await fetch(`/api/lms/announcements?courseId=${courseId}`);
      const json = await res.json();
      if (json.success) setAnnouncements(json.data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAnnouncements();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  async function handleCreate() {
    if (!title.trim() || !body.trim()) {
      toast.error("请填写标题和内容");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/lms/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          title: title.trim(),
          body: body.trim(),
          status: "published",
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "发布失败");
        return;
      }
      toast.success("公告已发布");
      setTitle("");
      setBody("");
      setShowForm(false);
      fetchAnnouncements();
    } catch {
      toast.error("发布失败，请重试");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">加载公告...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">课程公告</h3>
        <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="size-3 mr-1" />
          发布公告
        </Button>
      </div>

      {showForm && (
        <div className="space-y-3 rounded-lg border p-3">
          <div className="space-y-1.5">
            <Label className="text-xs">标题</Label>
            <Input
              placeholder="公告标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">内容</Label>
            <Textarea
              placeholder="公告内容..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={creating}>
              {creating ? (
                <><Loader2 className="size-3 animate-spin mr-1" /> 发布中...</>
              ) : (
                "发布"
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              取消
            </Button>
          </div>
        </div>
      )}

      <Separator />

      {announcements.length === 0 ? (
        <div className="text-center py-8">
          <Megaphone className="size-10 text-muted-foreground mx-auto" />
          <p className="mt-2 text-sm text-muted-foreground">暂无公告</p>
        </div>
      ) : (
        <div className="space-y-2">
          {announcements.map((ann) => (
            <Card key={ann.id}>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  {ann.title}
                  <Badge variant="outline" className="text-[10px]">
                    {ann.status === "published" ? "已发布" : ann.status}
                  </Badge>
                </CardTitle>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  {ann.creator?.name && <span>{ann.creator.name}</span>}
                  <span>{new Date(ann.createdAt).toLocaleString("zh-CN")}</span>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                  {ann.body}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
