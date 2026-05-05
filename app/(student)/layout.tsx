import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getSession } from "@/lib/auth/guards";
import type { UserRole } from "@/lib/types";

export default async function StudentLayout({
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

  return (
    <div className="min-h-screen">
      <Sidebar initialRole={initialRole} initialName={initialName} />
      <main className="flex min-h-screen flex-col lg:pl-[232px]">
        <Topbar initialRole={initialRole} initialName={initialName} />
        {/* 手机端 Sidebar mobile bar 高 56px (h-14)，所以 pt-16 即够；桌面端无需顶部 padding */}
        <div className="flex-1 p-4 pt-16 md:p-6 lg:pt-6">{children}</div>
      </main>
    </div>
  );
}
