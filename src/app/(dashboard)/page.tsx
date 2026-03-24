import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Mic2, Users, ScanLine } from "lucide-react";
import { getDashboardStats, getEdition } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const stats = await getDashboardStats();
  const edition = await getEdition();

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          {edition?.name || "No event selected"} {edition?.venue ? `— ${edition.venue}` : ""}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 mb-8">
        {[
          { label: "Sessions", value: stats.sessions, icon: Calendar },
          { label: "Speakers", value: stats.speakers, icon: Mic2 },
          { label: "Attendees", value: stats.attendees, icon: Users },
          { label: "Checked In", value: stats.checkedIn, icon: ScanLine },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-md bg-yellow-500/10 p-2">
                <stat.icon className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold tabular-nums">
                  {stat.value}
                </p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Getting started guide */}
      <Card>
        <CardContent className="p-6">
          <h2 className="font-heading text-lg font-semibold mb-4">
            Get started
          </h2>
          <div className="space-y-3">
            {[
              { step: 1, text: "Create your CFP link and share it with potential speakers", done: stats.speakers > 0 },
              { step: 2, text: "Import your schedule or add sessions manually", done: stats.sessions > 0 },
              { step: 3, text: "Connect your Telegram group for agent notifications", done: false },
              { step: 4, text: "Add attendees and generate QR tickets", done: stats.attendees > 0 },
            ].map((item) => (
              <div key={item.step} className="flex items-center gap-3 text-sm">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                    item.done
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-stone-100 text-stone-500"
                  }`}
                >
                  {item.done ? "✓" : item.step}
                </span>
                <span className={item.done ? "text-muted-foreground line-through" : ""}>
                  {item.text}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
