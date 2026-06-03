"use client";

import { FormEvent, useState } from "react";
import type * as React from "react";
import { useRouter } from "next/navigation";
import { IconClipboardCheck, IconPresentation } from "@tabler/icons-react";

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

export function TeacherSessionActions({
  compact = false,
  courses,
}: TeacherSessionActionsProps) {
  return (
    <div className={compact ? "grid gap-2" : "flex flex-col gap-3 sm:flex-row"}>
      <SessionSheet
        actionType="roll_call"
        buttonLabel="Start roll call"
        compact={compact}
        courses={courses}
        icon={<IconClipboardCheck className="size-4" />}
        title="Start roll call"
      />
      <SessionSheet
        actionType="presentation"
        buttonLabel="Start presentation session"
        compact={compact}
        courses={courses}
        icon={<IconPresentation className="size-4" />}
        title="Start presentation session"
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
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSessionTypeChange(value: SessionType) {
    setSessionType(value);
    setPeriod(periodsBySessionType[value][0]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      actionType,
      year,
      section,
      group: String(formData.get("group") ?? ""),
      courseId,
      sessionType,
      date: String(formData.get("date") ?? ""),
      period,
    };

    if (!payload.courseId || !payload.date || !payload.period || !payload.section) {
      setError("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as {
        success?: boolean;
        message?: string;
      };

      if (!response.ok || !data.success) {
        setError(data.message ?? "Could not create session.");
        return;
      }

      setMessage(data.message ?? "Session created successfully.");
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network/server error. Please try again.");
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
            Choose the class, course, date, and period for this session.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="grid gap-5 px-8 pb-8">
            <SelectField
              label="Year"
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

          <div className="space-y-2">
            <Label htmlFor={`${actionType}-group`}>Group</Label>
            <Input
              id={`${actionType}-group`}
              name="group"
              placeholder="Optional"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label>Element / Course</Label>
            <Select
              value={courseId}
              onValueChange={setCourseId}
              disabled={courses.length === 0 || isSubmitting}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a course" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((course) => (
                  <SelectItem key={course.code} value={course.code}>
                    {course.name ? `${course.code} - ${course.name}` : course.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {courses.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No courses found in the courses table.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Session type</Label>
            <Select
              value={sessionType}
              onValueChange={handleSessionTypeChange}
              disabled={isSubmitting}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="course">course</SelectItem>
                <SelectItem value="TP">TP</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${actionType}-date`}>Date</Label>
            <Input
              id={`${actionType}-date`}
              name="date"
              type="date"
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Period</Label>
            <Select value={period} onValueChange={setPeriod} disabled={isSubmitting}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodsBySessionType[sessionType].map((periodOption) => (
                  <SelectItem key={periodOption} value={periodOption}>
                    {periodOption}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={!courseId || isSubmitting}>
            {isSubmitting ? "Creating..." : "Create session"}
          </Button>

          {error ? (
            <div className="border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          {message ? (
            <div className="border bg-muted/40 p-3 text-sm text-muted-foreground">
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
