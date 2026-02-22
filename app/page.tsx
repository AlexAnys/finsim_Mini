import { redirect } from "next/navigation";

export default function HomePage() {
  // Redirect to login page; authenticated users will be redirected
  // to their respective dashboard by middleware or auth logic
  redirect("/login");
}
