import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, CalendarDays } from "lucide-react";

interface ScheduleCardProps {
  slot: {
    id: string;
    courseName: string;
    timeLabel: string;
    classroom: string | null;
    weekNumber: number;
    weekType: string;
  };
}

export function ScheduleCard({ slot }: ScheduleCardProps) {
  return (
    <Card className="py-2 gap-1">
      <CardContent className="flex items-center gap-3">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-green-50 text-green-600">
          <CalendarDays className="size-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-medium leading-tight">{slot.courseName}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="size-3" />{slot.timeLabel}</span>
            {slot.classroom && <span className="flex items-center gap-1"><MapPin className="size-3" />{slot.classroom}</span>}
            <Badge variant="outline" className="text-xs px-1.5 py-0">第{slot.weekNumber}周</Badge>
            {slot.weekType !== "all" && (
              <Badge variant="outline" className="text-xs px-1.5 py-0">{slot.weekType === "odd" ? "单周" : "双周"}</Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
