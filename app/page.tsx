import Link from "next/link";
import Image from "next/image";
import { IconArrowRight } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,oklch(0.97_0.04_92),transparent_35%),linear-gradient(180deg,#ffffff,#f4f3ef)] px-6 py-16">
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="SchoolApp+ logo"
              width={44}
              height={44}
              className="rounded-2xl shadow-sm"
            />
            <span className="font-semibold">SchoolApp+</span>
          </div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            School management starter
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
            SchoolApp+
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            A clean foundation for managing school workflows, starting with
            Supabase authentication and a protected dashboard.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/sign-in">
              Sign in
              <IconArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/sign-up">Create account</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/dashboard">Open dashboard</Link>
          </Button>
        </div>

        <div className="grid gap-4 border-t pt-8 sm:grid-cols-3">
          {[
            "Secure email auth",
            "Protected app routes",
            "Server-side session checks",
          ].map((item) => (
            <div key={item} className="rounded-lg border bg-card p-4 text-card-foreground">
              <p className="font-medium">{item}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
