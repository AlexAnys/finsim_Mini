import { Sidebar } from "@/components/sidebar";
import { getSession } from "@/lib/auth/guards";
import type { UserRole } from "@/lib/types";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const initialRole = session?.user?.role as UserRole | undefined;

  return (
    <div className="min-h-screen">
      <Sidebar
        initialRole={initialRole}
        initialName={session?.user?.name ?? null}
      />
      <main className="lg:pl-[232px]">
        <div className="p-6 pt-20 lg:pt-6">{children}</div>
      </main>
    </div>
  );
}
