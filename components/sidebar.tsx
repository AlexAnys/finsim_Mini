"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  BookOpen,
  Trophy,
  Bot,
  LogOut,
  Menu,
  GraduationCap,
  CalendarDays,
  Users,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import type { UserRole } from "@/lib/types";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const studentNav: NavItem[] = [
  { label: "仪表盘", href: "/dashboard", icon: LayoutDashboard },
  { label: "我的课程", href: "/courses", icon: BookOpen },
  { label: "我的成绩", href: "/grades", icon: Trophy },
  { label: "课表管理", href: "/schedule", icon: CalendarDays },
];

const teacherNav: NavItem[] = [
  { label: "仪表盘", href: "/teacher/dashboard", icon: LayoutDashboard },
  { label: "课程管理", href: "/teacher/courses", icon: BookOpen },
  { label: "课表管理", href: "/teacher/schedule", icon: CalendarDays },
  { label: "班级管理", href: "/teacher/groups", icon: Users },
  { label: "AI 助手", href: "/teacher/ai-assistant", icon: Bot },
];

function getNavItems(role: UserRole | undefined): NavItem[] {
  if (role === "teacher" || role === "admin") return teacherNav;
  return studentNav;
}

function getRoleLabel(role: UserRole | undefined): string {
  switch (role) {
    case "teacher":
      return "教师";
    case "admin":
      return "管理员";
    case "student":
      return "学生";
    default:
      return "";
  }
}

function getInitials(name: string | undefined | null): string {
  if (!name) return "U";
  return name.charAt(0).toUpperCase();
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as
    | { name?: string; role?: UserRole; email?: string }
    | undefined;
  const role = user?.role as UserRole | undefined;
  const navItems = getNavItems(role);

  const handleSignOut = () => {
    signOut({ callbackUrl: "/login" });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 px-6">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <GraduationCap className="size-5" />
        </div>
        <span className="text-xl font-bold tracking-tight text-foreground">
          FinSim
        </span>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "size-5 shrink-0",
                  isActive ? "text-primary" : ""
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User Info */}
      <div className="mt-auto border-t p-4">
        <div className="flex items-center gap-3">
          <Avatar size="default">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
              {getInitials(user?.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 truncate">
            <p className="truncate text-sm font-medium text-foreground">
              {user?.name || "用户"}
            </p>
            <p className="text-xs text-muted-foreground">
              {getRoleLabel(role)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            className="shrink-0 text-muted-foreground hover:text-destructive"
            title="登出"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-60 lg:flex-col border-r bg-background">
        <SidebarContent />
      </aside>

      {/* Mobile trigger */}
      <div className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center border-b bg-background px-4 lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-60 p-0" showCloseButton={false}>
            <SheetTitle className="sr-only">导航菜单</SheetTitle>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <div className="ml-3 flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <GraduationCap className="size-4" />
          </div>
          <span className="text-lg font-bold">FinSim</span>
        </div>
      </div>
    </>
  );
}
