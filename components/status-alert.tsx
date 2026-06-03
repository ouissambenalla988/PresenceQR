import { IconAlertCircle, IconCircleCheck, IconLoader2 } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

type StatusAlertProps = {
  message: string;
  tone?: "error" | "success" | "loading" | "neutral";
};

export function StatusAlert({ message, tone = "neutral" }: StatusAlertProps) {
  const Icon =
    tone === "error"
      ? IconAlertCircle
      : tone === "success"
        ? IconCircleCheck
        : IconLoader2;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-sm",
        tone === "error" &&
          "border-destructive/25 bg-destructive/10 text-destructive",
        tone === "success" &&
          "border-emerald-200 bg-emerald-50 text-emerald-800",
        tone === "loading" &&
          "border-blue-200 bg-blue-50 text-blue-800",
        tone === "neutral" && "bg-muted/50 text-muted-foreground",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          tone === "loading" && "animate-spin",
        )}
      />
      <span>{message}</span>
    </div>
  );
}
