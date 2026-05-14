import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getSession } from "@/lib/auth/guards";
import { ForbiddenState } from "@/components/states/forbidden";
import type { UserRole } from "@/lib/types";

export default async function AdminLayout({
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
  const isAdmin = initialRole === "admin";

  return (
    <div className="min-h-screen">
      <Sidebar initialRole={initialRole} initialName={initialName} />
      <main className="flex min-h-screen flex-col lg:pl-[232px]">
        <Topbar initialRole={initialRole} initialName={initialName} />
        <div className="flex-1 p-6 pt-20 lg:pt-6">
          {isAdmin ? (
            children
          ) : (
            <ForbiddenState
              title="管理员页面"
              description="该页面仅对管理员可见。"
              primaryAction={{
                label: "返回工作台",
                href: initialRole === "teacher" ? "/teacher/dashboard" : "/dashboard",
              }}
              fullPage={false}
            />
          )}
        </div>
      </main>
    </div>
  );
}
