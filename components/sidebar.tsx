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
  CalendarDays,
  Users,
  Search,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Wordmark } from "@/components/ui/wordmark";
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

function getSectionLabel(role: UserRole | undefined): string {
  return role === "teacher" || role === "admin" ? "教师工作台" : "学习空间";
}

function getInitials(name: string | undefined | null): string {
  if (!name) return "U";
  return name.charAt(0).toUpperCase();
}

interface SidebarContentProps {
  onNavigate?: () => void;
  initialRole?: UserRole;
  initialName?: string | null;
}

function SidebarContent({
  onNavigate,
  initialRole,
  initialName,
}: SidebarContentProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as
    | { name?: string; role?: UserRole; email?: string }
    | undefined;
  const role = (user?.role as UserRole | undefined) ?? initialRole;
  const displayName = user?.name ?? initialName ?? undefined;
  const navItems = getNavItems(role);

  const handleSignOut = () => {
    signOut({ callbackUrl: "/login" });
  };

  return (
    <div className="flex h-full flex-col bg-paper-alt">
      {/* Wordmark */}
      <div className="px-5 pt-[22px] pb-[18px]">
        <Wordmark size={28} />
      </div>

      {/* Search placeholder (⌘K — actual command palette TBD) */}
      <div className="px-3">
        <div className="relative flex items-center rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink-5">
          <Search className="mr-2 size-3.5 shrink-0" aria-hidden="true" />
          <span className="flex-1">搜索...</span>
          <kbd className="ml-auto rounded bg-paper px-1.5 py-px font-mono text-[10.5px] text-ink-5">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 pt-[18px]">
        <div className="px-2.5 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-5">
          {getSectionLabel(role)}
        </div>
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "relative mb-0.5 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
                isActive
                  ? "bg-brand-soft text-brand font-semibold"
                  : "text-ink-3 hover:bg-paper hover:text-ink-2"
              )}
            >
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-sm bg-brand"
                />
              )}
              <item.icon
                className={cn(
                  "size-[15px] shrink-0",
                  isActive ? "text-brand" : "text-ink-4"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User card */}
      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2.5 px-1 py-1">
          <Avatar size="default" className="size-8">
            <AvatarFallback className="bg-brand text-[13px] font-semibold text-brand-fg">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-semibold text-ink-2">
              {displayName || "用户"}
            </p>
            <p className="truncate text-[11px] text-ink-4">
              {getRoleLabel(role)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            className="size-7 shrink-0 text-ink-5 hover:text-destructive"
            title="登出"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

interface SidebarProps {
  initialRole?: UserRole;
  initialName?: string | null;
}

export function Sidebar({ initialRole, initialName }: SidebarProps = {}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-[232px] lg:flex-col border-r border-line">
        <SidebarContent initialRole={initialRole} initialName={initialName} />
      </aside>

      {/* Mobile trigger */}
      <div className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center border-b border-line bg-paper px-4 lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[232px] p-0"
            showCloseButton={false}
          >
            <SheetTitle className="sr-only">导航菜单</SheetTitle>
            <SidebarContent
              onNavigate={() => setOpen(false)}
              initialRole={initialRole}
              initialName={initialName}
            />
          </SheetContent>
        </Sheet>
        <div className="ml-3">
          <Wordmark size={24} />
        </div>
      </div>
    </>
  );
}
