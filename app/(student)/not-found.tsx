import { NotFoundState } from "@/components/states/not-found";

export default function StudentNotFound() {
  return (
    <NotFoundState
      title="页面不见了"
      description="你要找的页面不存在。可以回到学习空间继续。"
      primaryAction={{ label: "回到学习空间", href: "/dashboard" }}
      secondaryAction={{ label: "查看课程", href: "/courses" }}
      fullPage={false}
    />
  );
}
