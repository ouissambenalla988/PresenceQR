import { IconInbox } from "@tabler/icons-react";

type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ description, title }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed bg-muted/25 px-6 py-10 text-center">
      <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border">
        <IconInbox className="size-5 text-muted-foreground" />
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
