import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getSession } from "@/lib/auth/guards";
import { ForbiddenState } from "@/components/states/forbidden";
import type { UserRole } from "@/lib/types";

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  const initialRole = session.user.role as UserRole | undefined;
  const initialName = session.user.name ?? null;
  const isTeacherRole = initialRole === "teacher" || initialRole === "admin";

  return (
    <div className="min-h-screen">
      <Sidebar initialRole={initialRole} initialName={initialName} />
      <main className="flex min-h-screen flex-col lg:pl-[232px]">
        <Topbar initialRole={initialRole} initialName={initialName} />
        <div className="flex-1 p-6 pt-20 lg:pt-6">
          {isTeacherRole ? (
            children
          ) : (
            <ForbiddenState
              title="你还不能看这个页面"
              description="教师工作台仅对教师和管理员可见。如果是误操作，可以回到学习空间。"
              primaryAction={{
                label: "回到学习空间",
                href: "/dashboard",
              }}
              secondaryAction={{
                label: "联系管理员",
                href: "mailto:admin@finsim.edu.cn",
              }}
              fullPage={false}
            />
          )}
        </div>
      </main>
    </div>
  );
}
