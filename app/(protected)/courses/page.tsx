import { CourseCard } from "@/components/course-card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAccessibleCourses } from "@/lib/school-data";
import { createClient } from "@/lib/supabase/server";

export default async function CoursesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const courses = await getAccessibleCourses(supabase, user);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Courses"
        title="All courses"
        description="Browse every course available to your account."
      />

      <Card>
        <CardHeader>
          <CardTitle>Courses</CardTitle>
          <CardDescription>
            Courses available to your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {courses.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {courses.map((course) => (
                <CourseCard key={course.code} course={course} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No courses available"
              description="Courses will appear here once they are available to your account."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
