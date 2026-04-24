"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { courseColorForId, tagColors } from "@/lib/design/tokens";
import { relativeTimeFromNow } from "@/lib/utils/dashboard-formatters";

export interface AnnouncementSummaryItem {
  id: string;
  title: string;
  courseId: string | null;
  courseTitle: string;
  createdAt: string;
  unread: boolean;
  href?: string;
}

interface AnnouncementSummaryProps {
  items: AnnouncementSummaryItem[];
  unreadCount: number;
}

export function AnnouncementSummary({
  items,
  unreadCount,
}: AnnouncementSummaryProps) {
  return (
    <section>
      <header className="mb-2.5 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink-2">公告</h2>
        {unreadCount > 0 && (
          <Badge variant="secondary" className="bg-danger-soft text-danger">
            {unreadCount} 未读
          </Badge>
        )}
      </header>
      {items.length === 0 ? (
        <Card className="py-6">
          <p className="text-center text-sm text-ink-4">暂无公告</p>
        </Card>
      ) : (
        <Card className="py-0 gap-0 overflow-hidden">
          {items.map((a, i) => {
            const tagKey = a.courseId ? courseColorForId(a.courseId) : "tagA";
            const tc = tagColors[tagKey];
            const body = (
              <div
                className={`flex items-start gap-2.5 px-3.5 py-3 ${
                  i < items.length - 1 ? "border-b border-line-2" : ""
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                    a.unread ? "bg-danger" : "bg-transparent"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div
                    className={`truncate text-[12.5px] text-ink ${
                      a.unread ? "font-semibold" : "font-medium"
                    }`}
                  >
                    {a.title}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-4">
                    <span
                      className="font-medium"
                      style={{ color: tc.fg }}
                    >
                      {a.courseTitle}
                    </span>
                    <span className="text-ink-5">·</span>
                    <span>{relativeTimeFromNow(a.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
            return a.href ? (
              <Link
                key={a.id}
                href={a.href}
                className="block transition-colors hover:bg-surface-tint"
              >
                {body}
              </Link>
            ) : (
              <div key={a.id}>{body}</div>
            );
          })}
        </Card>
      )}
    </section>
  );
}
