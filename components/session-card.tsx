import Link from "next/link";
import {
  IconArrowRight,
  IconCalendarEvent,
  IconClock,
  IconDoor,
  IconUser,
} from "@tabler/icons-react";

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

const statusStyles: Record<string, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400",
  finished: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400",
  cancelled: "border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400",
};

const statusLabels: Record<string, string> = {
  active: "En cours",
  finished: "Terminée",
  cancelled: "Annulée",
};

export function SessionCard({ session, teacherName }: SessionCardProps) {
  const statusClass = statusStyles[session.status] ?? statusStyles.finished;
  const statusLabel = statusLabels[session.status] ?? session.status;

  return (
    <Link
      href={`/sessions/${session.id}`}
      className="group block rounded-2xl border bg-background p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-lg hover:shadow-black/5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2.5">
          {/* Course code + badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-foreground/5 px-2.5 py-0.5 font-mono text-sm font-bold tracking-wide text-foreground">
              {session.courses_id}
            </span>
            <Badge variant="secondary">{session.isTP ? "TP" : "Cours"}</Badge>
            {getSessionEventLabels(session.event).map((label) => (
              <Badge key={label} variant="outline">
                {label}
              </Badge>
            ))}
            <Badge variant="outline" className={statusClass}>
              {statusLabel}
            </Badge>
          </div>

          {/* Date */}
          <p className="text-sm font-semibold text-foreground">
            {session.date ?? "—"}
          </p>

          {/* Meta row */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <IconClock className="size-3.5" />
              {getPeriodLabel(session.isTP, Number(session.period))}
            </span>
            <span className="inline-flex items-center gap-1">
              <IconCalendarEvent className="size-3.5" />
              {session.class}
            </span>
            {session.room ? (
              <span className="inline-flex items-center gap-1">
                <IconDoor className="size-3.5" />
                Salle {session.room}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <IconUser className="size-3.5" />
              {teacherName}
            </span>
          </div>
        </div>

        <IconArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-foreground" />
      </div>
    </Link>
  );
}
