"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ClassOption {
  id: string;
  name: string;
  code: string | null;
  academicYear: string | null;
}

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);

  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"student" | "teacher" | "">("");
  const [classId, setClassId] = useState("");
  const [adminKey, setAdminKey] = useState("");

  // Fetch classes when role changes to student
  useEffect(() => {
    if (role === "student" && classes.length === 0) {
      setClassesLoading(true);
      fetch("/api/classes")
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setClasses(data.data);
          }
        })
        .catch(() => {
          toast.error("获取班级列表失败");
        })
        .finally(() => {
          setClassesLoading(false);
        });
    }
  }, [role, classes.length]);

  function validate(): boolean {
    if (!name.trim()) {
      toast.error("请输入姓名");
      return false;
    }
    if (!email.trim()) {
      toast.error("请输入邮箱");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast.error("邮箱格式不正确");
      return false;
    }
    if (password.length < 6) {
      toast.error("密码至少6个字符");
      return false;
    }
    if (password !== confirmPassword) {
      toast.error("两次输入的密码不一致");
      return false;
    }
    if (!role) {
      toast.error("请选择角色");
      return false;
    }
    if (role === "student" && !classId) {
      toast.error("学生必须选择班级");
      return false;
    }
    if (role === "teacher" && !adminKey.trim()) {
      toast.error("教师注册需要输入注册密钥");
      return false;
    }
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validate()) return;

    setIsLoading(true);

    try {
      // Step 1: Register
      const registerRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          name: name.trim(),
          role,
          classId: role === "student" ? classId : undefined,
          adminKey: role === "teacher" ? adminKey.trim() : undefined,
        }),
      });

      const registerData = await registerRes.json();

      if (!registerData.success) {
        toast.error(registerData.error?.message || "注册失败");
        return;
      }

      toast.success("注册成功，正在自动登录...");

      // Step 2: Auto login
      const signInResult = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });

      if (signInResult?.error) {
        toast.error("自动登录失败，请手动登录");
        router.push("/login");
        return;
      }

      // Step 3: Redirect based on role
      if (role === "teacher") {
        router.push("/teacher/dashboard");
      } else {
        router.push("/student/dashboard");
      }
      router.refresh();
    } catch {
      toast.error("注册失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-primary">
          FinSim
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          金融模拟教学平台
        </p>
      </div>

      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">注册</CardTitle>
          <CardDescription>创建账号以使用平台</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">姓名</Label>
              <Input
                id="name"
                type="text"
                placeholder="请输入姓名"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                autoComplete="name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                placeholder="请输入邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="至少6个字符"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认密码</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="再次输入密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">角色</Label>
              <Select
                value={role}
                onValueChange={(value: string) => {
                  setRole(value as "student" | "teacher");
                  setClassId("");
                  setAdminKey("");
                }}
                disabled={isLoading}
              >
                <SelectTrigger id="role" className="w-full">
                  <SelectValue placeholder="请选择角色" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">学生</SelectItem>
                  <SelectItem value="teacher">教师</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {role === "student" && (
              <div className="space-y-2">
                <Label htmlFor="classId">班级</Label>
                <Select
                  value={classId}
                  onValueChange={setClassId}
                  disabled={isLoading || classesLoading}
                >
                  <SelectTrigger id="classId" className="w-full">
                    <SelectValue
                      placeholder={
                        classesLoading ? "加载中..." : "请选择班级"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                        {cls.code ? ` (${cls.code})` : ""}
                      </SelectItem>
                    ))}
                    {!classesLoading && classes.length === 0 && (
                      <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                        暂无可选班级
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {role === "teacher" && (
              <div className="space-y-2">
                <Label htmlFor="adminKey">教师注册密钥</Label>
                <Input
                  id="adminKey"
                  type="password"
                  placeholder="请输入教师注册密钥"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "注册中..." : "注册"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            已有账号？{" "}
            <Link
              href="/login"
              className="text-primary underline-offset-4 hover:underline font-medium"
            >
              立即登录
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
