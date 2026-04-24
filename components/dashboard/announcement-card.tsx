"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Megaphone } from "lucide-react";

interface AnnouncementCardProps {
  announcement: {
    id: string;
    title: string;
    content?: string;
    body?: string;
    createdAt: string;
    course?: { courseTitle: string };
    creator?: { name: string };
  };
  role: "student" | "teacher";
}

export function AnnouncementCard({ announcement, role }: AnnouncementCardProps) {
  return (
    <Card className="py-3 gap-2">
      <CardContent className="flex items-start gap-3">
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-ochre-soft text-ochre">
          <Megaphone className="size-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-tight">{announcement.title}</p>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {announcement.body || announcement.content}
          </p>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            {role === "student" && announcement.creator?.name && (
              <span>{announcement.creator.name}</span>
            )}
            <span>
              {new Date(announcement.createdAt).toLocaleDateString("zh-CN", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
