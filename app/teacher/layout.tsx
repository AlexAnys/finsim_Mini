import { Sidebar } from "@/components/sidebar";

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      {/* Main content area: offset for sidebar on desktop, offset for topbar on mobile */}
      <main className="lg:pl-60">
        <div className="p-6 pt-20 lg:pt-6">{children}</div>
      </main>
    </div>
  );
}
