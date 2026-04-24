"use client";

import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Bell, Sparkles, LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deriveCrumbs } from "@/lib/layout/breadcrumbs";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TopbarProps {
  initialRole?: UserRole;
  initialName?: string | null;
}

function getInitial(name: string | undefined | null): string {
  if (!name) return "U";
  return name.charAt(0).toUpperCase();
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

export function Topbar({ initialRole, initialName }: TopbarProps = {}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as
    | { name?: string | null; role?: UserRole; email?: string | null }
    | undefined;
  const role = (user?.role as UserRole | undefined) ?? initialRole;
  const displayName = user?.name ?? initialName ?? undefined;

  const crumbs = deriveCrumbs(pathname ?? "/", role);

  const handleSignOut = () => {
    signOut({ callbackUrl: "/login" });
  };

  return (
    <div className="hidden lg:flex sticky top-0 z-30 h-14 items-center gap-3.5 border-b border-line bg-paper px-7">
      <nav aria-label="面包屑" className="flex items-center text-[13px]">
        {crumbs.map((c, i) => (
          <span key={`${c.label}-${i}`} className="flex items-center">
            {i > 0 && <span className="mx-1.5 text-ink-5">/</span>}
            <span
              className={cn(
                c.isLast ? "font-medium text-ink-2" : "text-ink-4",
              )}
            >
              {c.label}
            </span>
          </span>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-ink-4 hover:text-ink-2"
          title="通知"
          aria-label="通知"
        >
          <Bell className="size-[15px]" />
        </Button>

        <Button
          variant="secondary"
          size="sm"
          className="bg-brand-soft text-brand hover:bg-brand-soft-2"
          title="AI 助手"
        >
          <Sparkles className="size-[13px]" />
          AI 助手
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ml-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              aria-label="用户菜单"
            >
              <Avatar className="size-8">
                <AvatarFallback className="bg-brand text-[12px] font-semibold text-brand-fg">
                  {getInitial(displayName)}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-[13px] font-semibold text-ink-2">
                  {displayName || "用户"}
                </span>
                <span className="text-[11px] text-ink-4">
                  {getRoleLabel(role)}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <UserIcon className="mr-2 size-4" />
              账户设置
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-danger focus:text-danger"
            >
              <LogOut className="mr-2 size-4" />
              登出
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
