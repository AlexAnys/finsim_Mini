"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface Me {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl: string | null;
}

export default function SettingsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/users/me");
        const json = await res.json();
        if (!json.success) {
          toast.error(json.error?.message || "加载账户信息失败");
          return;
        }
        if (!cancelled) {
          setMe(json.data);
          setName(json.data.name || "");
          setAvatarUrl(json.data.avatarUrl || "");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveProfile() {
    if (!name.trim()) {
      toast.error("姓名不能为空");
      return;
    }
    setSavingProfile(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), avatarUrl: avatarUrl.trim() || null }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "保存失败");
        return;
      }
      setMe(json.data);
      toast.success("账户资料已更新");
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword() {
    if (newPassword.length < 6) {
      toast.error("新密码至少 6 个字符");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("两次输入的新密码不一致");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/users/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "修改密码失败");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("密码已更新");
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center text-ink-4">
        <Loader2 className="mr-2 size-4 animate-spin" />
        加载账户设置...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-[12px] font-semibold text-brand">账户设置</p>
        <h1 className="mt-1 text-3xl font-bold tracking-[-0.02em] text-ink">个人资料与安全</h1>
        <p className="mt-2 text-sm text-ink-4">
          邮箱作为登录身份暂不支持自助修改，如需调整请联系管理员。
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">基础资料</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>姓名</Label>
                <Input value={name} onChange={(event) => setName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>身份</Label>
                <Input value={roleLabel(me?.role)} readOnly className="bg-paper-alt text-ink-4" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>邮箱</Label>
                <Badge variant="outline" className="rounded-md text-[11px]">
                  邮箱只读
                </Badge>
              </div>
              <Input value={me?.email || ""} readOnly className="bg-paper-alt text-ink-4" />
            </div>
            <div className="space-y-2">
              <Label>头像 URL</Label>
              <Input
                value={avatarUrl}
                onChange={(event) => setAvatarUrl(event.target.value)}
                placeholder="可选：粘贴头像图片地址"
              />
            </div>
            <Button onClick={saveProfile} disabled={savingProfile}>
              {savingProfile ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
              保存资料
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="size-5 text-brand" />
              修改密码
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>当前密码</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
              />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>新密码</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label>确认新密码</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
              />
            </div>
            <Button
              onClick={savePassword}
              disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="w-full"
            >
              {savingPassword && <Loader2 className="mr-2 size-4 animate-spin" />}
              更新密码
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function roleLabel(role?: string) {
  if (role === "teacher") return "教师";
  if (role === "admin") return "管理员";
  return "学生";
}
