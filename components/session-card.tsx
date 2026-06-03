import Link from "next/link";
import { IconArrowRight, IconCalendarEvent, IconClock } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import {
  getPeriodLabel,
  getSessionEventLabels,
  type SessionRow,
} from "@/lib/school-data";

type SessionCardProps = {
  session: SessionRow;
  teacherName: string;
};

export function SessionCard({ session, teacherName }: SessionCardProps) {
  return (
    <Link
      href={`/sessions/${session.id}`}
      className="group block rounded-2xl border bg-background p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-lg hover:shadow-black/5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{session.isTP ? "TP" : "Course"}</Badge>
            {getSessionEventLabels(session.event).map((label) => (
              <Badge key={label} variant="outline">
                {label}
              </Badge>
            ))}
          </div>
          <p className="font-semibold">{session.date ?? "No date"}</p>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <IconClock className="size-4" />
              {getPeriodLabel(session.isTP, Number(session.period))}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <IconCalendarEvent className="size-4" />
              Class {session.class}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">Teacher: {teacherName}</p>
        </div>
        <IconArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-foreground" />
      </div>
    </Link>
  );
}
