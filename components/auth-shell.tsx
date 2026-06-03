import Image from "next/image";
import Link from "next/link";
import { IconArrowLeft, IconBook2, IconCalendarCheck, IconSparkles } from "@tabler/icons-react";

type AuthShellProps = {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
};

export function AuthShell({
  children,
  description,
  eyebrow,
  title,
}: AuthShellProps) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,oklch(0.96_0.04_95),transparent_34%),linear-gradient(135deg,#fafaf8,#f2f1ed)] px-4 py-6">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl overflow-hidden rounded-3xl border bg-background/85 shadow-2xl shadow-black/10 backdrop-blur lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden border-r bg-foreground p-10 text-background lg:flex lg:flex-col">
          <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:42px_42px]" />
          <div className="relative z-10">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-sm font-medium text-white/85 transition hover:bg-white/15 hover:text-white"
            >
              <IconArrowLeft className="size-4" />
              Back to home
            </Link>
          </div>

          <div className="relative z-10 mt-auto max-w-xl">
            <div className="mb-8 flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="SchoolApp+ logo"
                width={52}
                height={52}
                className="rounded-2xl bg-white p-1"
              />
              <div>
                <p className="text-xl font-semibold">SchoolApp+</p>
                <p className="text-sm text-white/60">Student portal</p>
              </div>
            </div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/50">
              {eyebrow}
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight">
              {title}
            </h1>
            <p className="mt-4 max-w-md text-base leading-7 text-white/65">
              {description}
            </p>
            <div className="mt-8 grid gap-3">
              {[
                ["Manage your courses", IconBook2],
                ["Track sessions and attendance", IconCalendarCheck],
                ["Connect with your school platform", IconSparkles],
              ].map(([label, Icon]) => (
                <div
                  key={String(label)}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75"
                >
                  <Icon className="size-4 text-white" />
                  {String(label)}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex min-h-[calc(100vh-3rem)] flex-col justify-center px-5 py-8 sm:px-10">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <Image
                src="/logo.png"
                alt="SchoolApp+ logo"
                width={32}
                height={32}
                className="rounded-lg"
              />
              SchoolApp+
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <IconArrowLeft className="size-4" />
              Home
            </Link>
          </div>
          <div className="mx-auto w-full max-w-md">{children}</div>
        </section>
      </div>
    </main>
  );
}
