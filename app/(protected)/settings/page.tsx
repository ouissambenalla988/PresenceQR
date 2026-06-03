import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Account settings"
        description="Profile and preference controls will live here as the product grows."
      />

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Profile and app preferences will live here.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="rounded-2xl border border-dashed bg-muted/25 p-6 text-sm text-muted-foreground">
            Settings page coming soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
