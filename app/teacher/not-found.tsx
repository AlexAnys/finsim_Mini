import { NotFoundState } from "@/components/states/not-found";

export default function TeacherNotFound() {
  return (
    <NotFoundState
      title="页面不见了"
      description="你要找的页面不存在。可以回到教师工作台继续。"
      primaryAction={{ label: "回到教师工作台", href: "/teacher/dashboard" }}
      secondaryAction={{ label: "查看课程", href: "/teacher/courses" }}
      fullPage={false}
    />
  );
}
