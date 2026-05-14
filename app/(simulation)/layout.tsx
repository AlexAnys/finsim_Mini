import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/guards";

export default async function SimulationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  return <div className="min-h-screen bg-slate-50">{children}</div>;
}
