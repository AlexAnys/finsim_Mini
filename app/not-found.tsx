import { NotFoundState } from "@/components/states/not-found";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-paper">
      <NotFoundState
        secondaryAction={{ label: "去登录", href: "/login" }}
      />
    </div>
  );
}
