"use client";

import { FormEvent, useState } from "react";
import type * as React from "react";
import { useRouter } from "next/navigation";
import { IconCalendar, IconClipboardCheck, IconClock, IconPresentation } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type ActionType = "roll_call" | "presentation";
type SessionType = "course" | "TP";

type CourseOption = {
  code: string;
  name: string | null;
};

type TeacherSessionActionsProps = {
  compact?: boolean;
  courses: CourseOption[];
};

const years = ["1", "2", "3", "4", "5"];
const sections = ["sec1", "sec2", "sec3", "sec4", "sec5", "sec6", "sec7", "sec8"];

const periodsBySessionType: Record<SessionType, string[]> = {
  TP: ["08:30 - 11:30", "11:30 - 14:30", "13:30 - 16:30", "16:30 - 19:30"],
  course: ["08:30 - 10:30", "10:30 - 12:30", "14:30 - 16:30", "16:30 - 18:30"],
};

const CUSTOM_PERIOD = "custom";

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

export function TeacherSessionActions({
  compact = false,
  courses,
}: TeacherSessionActionsProps) {
  return (
    <div className={compact ? "grid gap-2" : "flex flex-col gap-3 sm:flex-row"}>
      <SessionSheet
        actionType="roll_call"
        buttonLabel="Démarrer l'appel"
        compact={compact}
        courses={courses}
        icon={<IconClipboardCheck className="size-4" />}
        title="Démarrer l'appel"
      />
      <SessionSheet
        actionType="presentation"
        buttonLabel="Démarrer une présentation"
        compact={compact}
        courses={courses}
        icon={<IconPresentation className="size-4" />}
        title="Démarrer une présentation"
      />
    </div>
  );
}

function SessionSheet({
  actionType,
  buttonLabel,
  compact,
  courses,
  icon,
  title,
}: {
  actionType: ActionType;
  buttonLabel: string;
  compact: boolean;
  courses: CourseOption[];
  icon: React.ReactNode;
  title: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(years[0]);
  const [section, setSection] = useState(sections[0]);
  const [courseId, setCourseId] = useState(courses[0]?.code ?? "");
  const [sessionType, setSessionType] = useState<SessionType>("course");
  const [period, setPeriod] = useState(periodsBySessionType.course[0]);
  const [customStartTime, setCustomStartTime] = useState("08:00");
  const [date, setDate] = useState(todayIso());
  const [lateToleranceMinutes, setLateToleranceMinutes] = useState(15);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isCustomPeriod = period === CUSTOM_PERIOD;

  function handleSessionTypeChange(value: SessionType) {
    setSessionType(value);
    setPeriod(periodsBySessionType[value][0]);
  }

  function handlePeriodChange(value: string) {
    setPeriod(value);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const formData = new FormData(event.currentTarget);

    if (isCustomPeriod && !/^\d{2}:\d{2}$/.test(customStartTime)) {
      setError("Veuillez saisir une heure de début valide (HH:mm).");
      return;
    }

    const payload = {
      actionType,
      year,
      section,
      group: String(formData.get("group") ?? ""),
      room: String(formData.get("room") ?? ""),
      courseId,
      sessionType,
      date,
      period,
      customStartTime: isCustomPeriod ? customStartTime : undefined,
      lateToleranceMinutes,
    };

    if (!payload.courseId || !payload.date || !payload.period || !payload.section) {
      setError("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as {
        success?: boolean;
        message?: string;
        sessionId?: string;
      };

      if (!response.ok || !data.success) {
        setError(data.message ?? "Impossible de créer la séance.");
        return;
      }

      setOpen(false);
      if (data.sessionId) {
        router.push(`/sessions/${data.sessionId}`);
      } else {
        router.refresh();
      }
    } catch {
      setError("Erreur réseau. Veuillez réessayer.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant={actionType === "roll_call" ? "default" : "outline"}
          className={compact ? "w-full justify-start rounded-xl tracking-normal normal-case" : "rounded-xl"}
        >
          {icon}
          {buttonLabel}
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            Choisissez la classe, le cours, la date et le créneau pour cette séance.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="grid gap-5 px-8 pb-8">
          <SelectField
            label="Année"
            value={year}
            onValueChange={setYear}
            values={years}
            disabled={isSubmitting}
          />
          <SelectField
            label="Section"
            value={section}
            onValueChange={setSection}
            values={sections}
            disabled={isSubmitting}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`${actionType}-group`}>Groupe</Label>
              <Input
                id={`${actionType}-group`}
                name="group"
                placeholder="Optionnel"
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${actionType}-room`}>Salle</Label>
              <Input
                id={`${actionType}-room`}
                name="room"
                placeholder="ex. 24"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Course */}
          <div className="space-y-2">
            <Label>Élément / Cours</Label>
            <Select
              value={courseId}
              onValueChange={setCourseId}
              disabled={courses.length === 0 || isSubmitting}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sélectionner un cours" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((course) => (
                  <SelectItem key={course.code} value={course.code}>
                    {course.name ? `${course.code} — ${course.name}` : course.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {courses.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun cours disponible.</p>
            ) : null}
          </div>

          {/* Session type */}
          <div className="space-y-2">
            <Label>Type de séance</Label>
            <Select value={sessionType} onValueChange={handleSessionTypeChange} disabled={isSubmitting}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="course">Cours</SelectItem>
                <SelectItem value="TP">TP</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={`${actionType}-date`}>Date</Label>
              <button
                type="button"
                onClick={() => setDate(todayIso())}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1 rounded-lg border bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-40"
              >
                <IconCalendar className="size-3" />
                Aujourd&apos;hui
              </button>
            </div>
            <Input
              id={`${actionType}-date`}
              name="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          {/* Period */}
          <div className="space-y-2">
            <Label>Créneau</Label>
            <Select value={period} onValueChange={handlePeriodChange} disabled={isSubmitting}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodsBySessionType[sessionType].map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
                <SelectItem value={CUSTOM_PERIOD}>
                  <span className="flex items-center gap-2">
                    <IconClock className="size-3.5" />
                    Autre créneau…
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom period time input */}
          {isCustomPeriod ? (
            <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Créneau personnalisé
              </p>
              <div className="space-y-2">
                <Label htmlFor={`${actionType}-custom-start`}>Heure de début</Label>
                <Input
                  id={`${actionType}-custom-start`}
                  type="time"
                  value={customStartTime}
                  onChange={(e) => setCustomStartTime(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
            </div>
          ) : null}

          {/* Late tolerance */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={`${actionType}-tolerance`}>
                Délai de retard autorisé
              </Label>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {lateToleranceMinutes} min
              </span>
            </div>
            <input
              id={`${actionType}-tolerance`}
              type="range"
              min={0}
              max={60}
              step={5}
              value={lateToleranceMinutes}
              onChange={(e) => setLateToleranceMinutes(Number(e.target.value))}
              disabled={isSubmitting}
              className="w-full accent-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Les étudiants peuvent scanner pendant encore{" "}
              <strong>{lateToleranceMinutes} minutes</strong> après l'heure de début.
            </p>
          </div>

          <Button type="submit" disabled={!courseId || isSubmitting}>
            {isSubmitting ? "Création en cours…" : "Créer la séance"}
          </Button>

          {error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          {message ? (
            <div className="rounded-xl border bg-muted/40 p-3 text-sm text-muted-foreground">
              {message}
            </div>
          ) : null}
        </form>
      </SheetContent>
    </Sheet>
  );
}

function SelectField({
  label,
  onValueChange,
  value,
  values,
  disabled = false,
}: {
  label: string;
  onValueChange: (value: string) => void;
  value: string;
  values: string[];
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {values.map((item) => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
