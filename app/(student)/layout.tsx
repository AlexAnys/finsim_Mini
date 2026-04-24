import { Sidebar } from "@/components/sidebar";

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="lg:pl-[232px]">
        <div className="p-6 pt-20 lg:pt-6">{children}</div>
      </main>
    </div>
  );
}
