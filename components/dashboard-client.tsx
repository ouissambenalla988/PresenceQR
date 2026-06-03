"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconArrowRight } from "@tabler/icons-react";

import { CourseCard } from "@/components/course-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import type { StudentCourseDisplay } from "@/lib/course-display";

type DashboardClientProps = {
  hasProfile: boolean;
  initialCourses: StudentCourseDisplay[];
  platformError?: string;
  shouldImportCourses: boolean;
};

type ImportResponse = {
  success?: boolean;
  courseCodes?: string[];
  courses?: StudentCourseDisplay[];
  message?: string;
};

export function DashboardClient({
  hasProfile,
  initialCourses,
  platformError,
  shouldImportCourses,
}: DashboardClientProps) {
  const router = useRouter();
  const didAutoImport = useRef(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(
    platformError ?? null,
  );
  const [importStatus, setImportStatus] = useState<string | null>(
    hasProfile && shouldImportCourses
      ? "Checking your registered courses..."
      : null,
  );
  const [importError, setImportError] = useState<string | null>(null);
  const [courses, setCourses] = useState(initialCourses);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const importCourses = useCallback(async () => {
    setImportError(null);
    setIsImporting(true);
    setImportStatus("Fetching courses from SchoolApp...");

    try {
      setImportStatus("Saving courses...");
      const response = await fetch("/api/student-courses/import", {
        method: "POST",
      });
      const data = (await response.json()) as ImportResponse;

      if (!response.ok || !data.success) {
        setImportError(data.message ?? "Could not import courses. Try again.");
        setImportStatus(null);
        return;
      }

      setCourses(
        data.courses ??
          data.courseCodes?.map((courseCode) => ({
            code: courseCode,
            name: null,
          })) ??
          [],
      );
      setImportStatus("Courses imported successfully.");
      router.refresh();
    } catch {
      setImportError("Could not import courses. Try again.");
      setImportStatus(null);
    } finally {
      setIsImporting(false);
    }
  }, [router]);

  useEffect(() => {
    if (!hasProfile || !shouldImportCourses || didAutoImport.current) {
      return;
    }

    didAutoImport.current = true;
    void importCourses();
  }, [hasProfile, importCourses, shouldImportCourses]);

  async function handleConnect(formData: FormData) {
    setConnectionError(null);
    setConnectionStatus("Connecting to SchoolApp...");
    setIsConnecting(true);

    try {
      setConnectionStatus("Checking your school account...");
      const response = await fetch("/api/schoolapp-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(formData.get("email")),
          password: String(formData.get("password")),
        }),
      });
      const data = (await response.json()) as ImportResponse;

      if (!response.ok || !data.success) {
        setConnectionError(
          data.message ??
            "School platform login failed. Please check your SchoolApp credentials.",
        );
        setConnectionStatus(null);
        return;
      }

      setConnectionStatus("Saving your profile...");
      await importCourses();
      router.push("/dashboard?uncompleted=true");
      router.refresh();
    } catch {
      setConnectionError("Network/server error. Please try again.");
      setConnectionStatus(null);
    } finally {
      setIsConnecting(false);
    }
  }

  if (!hasProfile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Complete your student profile</CardTitle>
          <CardDescription>
            Your account was created, but we could not connect it to
            your SchoolApp student account. Please enter your SchoolApp email
            and password again to complete your profile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleConnect} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="schoolapp-email">SchoolApp email</Label>
              <Input
                id="schoolapp-email"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schoolapp-password">SchoolApp password</Label>
              <Input
                id="schoolapp-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>

            {connectionError ? (
              <div className="border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {connectionError}
              </div>
            ) : null}
            {connectionStatus ? (
              <div className="flex items-center gap-2 border bg-muted/40 p-3 text-sm text-muted-foreground">
                {isConnecting ? <Spinner /> : null}
                <span>{connectionStatus}</span>
              </div>
            ) : null}

            <Button type="submit" disabled={isConnecting}>
              {isConnecting ? <Spinner /> : null}
              Complete profile
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Courses</CardTitle>
            <CardDescription>
              A quick preview of your registered courses.
            </CardDescription>
          </div>
          {courses.length > 0 ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/courses">
                View all courses
                <IconArrowRight className="size-4" />
              </Link>
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {importStatus ? (
          <div className="flex items-center gap-2 border bg-muted/40 p-3 text-sm text-muted-foreground">
            {isImporting ? <Spinner /> : null}
            <span>{importStatus}</span>
          </div>
        ) : null}
        {importError ? (
          <div className="border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {importError}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {courses.length > 0 ? (
            courses.slice(0, 5).map((course) => (
              <CourseCard key={course.code} course={course} />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No imported courses yet.
            </p>
          )}
        </div>

        {importError && courses.length === 0 ? (
          <Button
            type="button"
            variant="outline"
            disabled={isImporting}
            onClick={() => void importCourses()}
          >
            {isImporting ? <Spinner /> : null}
            Retry course import
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
