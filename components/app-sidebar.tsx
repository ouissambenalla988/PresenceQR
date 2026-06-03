"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type * as React from "react";
import { useState } from "react";
import {
  IconBook2,
  IconChevronRight,
  IconCircleHelp,
  IconDashboard,
  IconLogout,
  IconPresentation,
  IconSettings,
  IconUserCircle,
  IconUserCog,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TeacherSessionActions } from "@/components/teacher-session-actions";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { StudentCourseDisplay } from "@/lib/course-display";

type AppSidebarProps = {
  courses: StudentCourseDisplay[];
  email: string;
  name?: string | null;
  role: string;
};

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: IconDashboard },
  { href: "/courses", label: "Courses", icon: IconBook2 },
  { href: "/settings", label: "Settings", icon: IconSettings },
];

export function AppSidebar({ courses, email, name, role }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const displayName = name || email;
  const displayRole = role.charAt(0).toUpperCase() + role.slice(1);

  async function signOut() {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-80 shrink-0 border-r border-black/5 bg-[#fbfbf9]/95 px-4 py-4 shadow-[10px_0_40px_rgba(0,0,0,0.03)] backdrop-blur md:flex md:flex-col">
        <SidebarContent
          courses={courses}
          displayName={displayName}
          displayRole={displayRole}
          email={email}
          isSigningOut={isSigningOut}
          menuOpen={menuOpen}
          pathname={pathname}
          role={role}
          setMenuOpen={setMenuOpen}
          signOut={signOut}
        />
      </aside>

      <header className="sticky top-0 z-20 border-b bg-background/85 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-4">
          <Link href="/dashboard" className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="SchoolApp+ logo"
              width={34}
              height={34}
              className="rounded-xl"
            />
            <div>
              <p className="font-semibold leading-none">SchoolApp+</p>
              <p className="text-xs text-muted-foreground">Student portal</p>
            </div>
          </Link>
          <Button variant="outline" size="sm" onClick={() => setMenuOpen((value) => !value)}>
            Menu
          </Button>
        </div>
        {menuOpen ? (
          <div className="mt-4 rounded-2xl border bg-background p-3 shadow-xl">
            <SidebarContent
              courses={courses}
              displayName={displayName}
              displayRole={displayRole}
              email={email}
              isSigningOut={isSigningOut}
              menuOpen={menuOpen}
              pathname={pathname}
              role={role}
              setMenuOpen={setMenuOpen}
              signOut={signOut}
              compact
            />
          </div>
        ) : null}
      </header>
    </>
  );
}

function SidebarContent({
  compact = false,
  courses,
  displayName,
  displayRole,
  email,
  isSigningOut,
  menuOpen,
  pathname,
  role,
  setMenuOpen,
  signOut,
}: {
  compact?: boolean;
  courses: StudentCourseDisplay[];
  displayName: string;
  displayRole: string;
  email: string;
  isSigningOut: boolean;
  menuOpen: boolean;
  pathname: string;
  role: string;
  setMenuOpen: (open: boolean) => void;
  signOut: () => void;
}) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", compact && "gap-4")}>
      {!compact ? (
        <Link href="/dashboard" className="flex items-center gap-3 rounded-2xl px-2 py-2">
          <Image
            src="/logo.png"
            alt="SchoolApp+ logo"
            width={42}
            height={42}
            className="rounded-2xl shadow-sm"
          />
          <div>
            <p className="font-semibold leading-none">SchoolApp+</p>
            <p className="mt-1 text-xs text-muted-foreground">Student portal</p>
          </div>
        </Link>
      ) : null}

      <div className={cn("mt-8", compact && "mt-0")}>
        <p className="px-3 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Workspace
        </p>
        <nav className="mt-3 grid gap-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-foreground text-background shadow-lg shadow-black/10"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span className="flex items-center gap-3">
                  <Icon className="size-4" />
                  {item.label}
                </span>
                <IconChevronRight
                  className={cn(
                    "size-4 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100",
                    active && "opacity-80",
                  )}
                />
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-8 rounded-2xl border bg-background p-3 shadow-sm">
        <p className="px-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Quick actions
        </p>
        {role === "teacher" ? (
          <div className="mt-3 grid gap-2">
            <TeacherSessionActions courses={courses} compact />
          </div>
        ) : (
          <div className="mt-3 grid gap-2">
            <Link
              href="/courses"
              className="flex items-center justify-between rounded-xl border bg-muted/30 px-3 py-2 text-sm font-medium transition hover:bg-muted"
            >
              <span className="flex items-center gap-2">
                <IconBook2 className="size-4" />
                My courses
              </span>
              <Badge variant="secondary">{courses.length}</Badge>
            </Link>
          </div>
        )}
      </div>

      <div className="mt-8 rounded-2xl border bg-gradient-to-br from-background to-muted/40 p-3 shadow-sm md:mt-auto">
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-muted"
        >
          <div className="flex size-10 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background shadow-sm">
            {getInitial(displayName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
          <Badge variant="secondary">{displayRole}</Badge>
        </button>

        {menuOpen ? (
          <div className="mt-3 grid gap-1 border-t pt-3 text-sm">
            <MenuItem icon={<IconUserCircle className="size-4" />} label="Profile management" />
            <MenuItem icon={<IconUserCog className="size-4" />} label="Account status" trailing={displayRole} />
            <Link
              href="/settings"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <IconSettings className="size-4" />
              Settings
            </Link>
            <MenuItem icon={<IconCircleHelp className="size-4" />} label="Help and support" />
            <button
              type="button"
              onClick={signOut}
              disabled={isSigningOut}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-destructive transition hover:bg-destructive/10 disabled:opacity-60"
            >
              <IconLogout className="size-4" />
              {isSigningOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  trailing,
}: {
  icon: React.ReactNode;
  label: string;
  trailing?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-2 text-muted-foreground">
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      {trailing ? <span className="text-xs">{trailing}</span> : null}
    </div>
  );
}

function getInitial(value: string) {
  return value[0]?.toUpperCase() ?? "S";
}
