import {
  getCourseCode,
  getCourseName,
  type CourseRowLike,
  type StudentCourseDisplay,
} from "@/lib/course-display";
import { createClient } from "@/lib/supabase/server";

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type StaffRow = {
  name: string | null;
};

export type StudentCourseRow = {
  course_id?: string | number | null;
  [key: string]: unknown;
};

export type SessionRow = {
  id: string;
  date: string | null;
  session_date: string | null;   // generated = date (Flutter compat)
  session_time: string | null;   // generated from period+isTP (Flutter compat)
  teacher_id: string;
  courses_id: string;
  isTP: boolean;
  period: number;
  class: string;
  room: string | null;
  event: "roll" | "presentation" | "both" | string;
  status: "active" | "finished" | "cancelled";
  qr_token: string | null;
  qr_expires_at: string | null;
};

const staffUserIdColumns = ["user_id", "id", "teacher_id", "auth_user_id"];

export async function getConfirmedStaff(
  supabase: SupabaseServerClient,
  userId: string,
) {
  for (const column of staffUserIdColumns) {
    const { data, error } = await supabase
      .from("staff")
      .select("name")
      .eq(column, userId)
      .maybeSingle<StaffRow>();

    if (!error && data) {
      return data;
    }
  }

  return null;
}

export async function getStaffNameByUserId(
  supabase: SupabaseServerClient,
  userId: string,
) {
  const staff = await getConfirmedStaff(supabase, userId);
  return staff?.name ?? "Unavailable";
}

export function mapStudentCoursesToDisplay(
  studentCourses: StudentCourseRow[],
  courses: CourseRowLike[],
) {
  const coursesByCode = new Map(
    courses.map((course) => [getCourseCode(course), getCourseName(course)]),
  );

  return studentCourses
    .map((studentCourse) => {
      const code = String(studentCourse.course_id ?? "");
      if (!code) {
        return null;
      }

      return {
        code,
        name: coursesByCode.get(code) ?? null,
      };
    })
    .filter((course): course is StudentCourseDisplay => Boolean(course));
}

export async function getAccessibleCourses(
  supabase: SupabaseServerClient,
  user: { id: string; user_metadata?: { role?: string } },
) {
  const { data: courses } = await supabase.from("courses").select("*");

  if (user.user_metadata?.role === "teacher") {
    const staff = await getConfirmedStaff(supabase, user.id);
    if (!staff) {
      return [];
    }

    return ((courses ?? []) as CourseRowLike[])
      .map((course) => ({
        code: getCourseCode(course),
        name: getCourseName(course),
      }))
      .filter((course) => course.code);
  }

  const { data: studentCourses } = await supabase
    .from("student_courses")
    .select("*");

  return mapStudentCoursesToDisplay(
    (studentCourses ?? []) as StudentCourseRow[],
    (courses ?? []) as CourseRowLike[],
  );
}

export function getPeriodLabel(isTP: boolean, period: number) {
  const coursePeriods = [
    "08:30 - 10:30",
    "10:30 - 12:30",
    "14:30 - 16:30",
    "16:30 - 18:30",
  ];
  const tpPeriods = [
    "08:30 - 11:30",
    "11:30 - 14:30",
    "13:30 - 16:30",
    "16:30 - 19:30",
  ];

  return (isTP ? tpPeriods : coursePeriods)[period - 1] ?? `Period ${period}`;
}

export function getSessionEventLabels(event: string) {
  if (event === "both") {
    return ["Roll call", "Presentation"];
  }

  if (event === "presentation") {
    return ["Presentation"];
  }

  return ["Roll call"];
}
