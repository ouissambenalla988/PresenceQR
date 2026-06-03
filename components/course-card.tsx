import Link from "next/link";
import { IconArrowRight, IconBook2 } from "@tabler/icons-react";

import { getCourseLabel, type StudentCourseDisplay } from "@/lib/course-display";

export function CourseCard({ course }: { course: StudentCourseDisplay }) {
  return (
    <Link
      href={`/courses/${encodeURIComponent(course.code)}`}
      className="group rounded-2xl border bg-background p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-lg hover:shadow-black/5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/20 text-primary-foreground ring-1 ring-primary/20">
          <IconBook2 className="size-5" />
        </div>
        <IconArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-foreground" />
      </div>
      <p className="mt-5 font-semibold">{course.code}</p>
      <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
        {course.name ?? getCourseLabel(course)}
      </p>
    </Link>
  );
}
