import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Mic2, Users, ScanLine } from "lucide-react";
import { getDashboardStats, getEdition } from "@/lib/queries";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [stats, edition, t] = await Promise.all([
    getDashboardStats(),
    getEdition(),
    getTranslations("Dashboard"),
  ]);

  const statCards = [
    { key: "sessions", value: stats.sessions, icon: Calendar },
    { key: "speakers", value: stats.speakers, icon: Mic2 },
    { key: "attendees", value: stats.attendees, icon: Users },
    { key: "checkedIn", value: stats.checkedIn, icon: ScanLine },
  ] as const;

  const steps = [
    { step: 1, key: "step1" as const, done: stats.speakers > 0 },
    { step: 2, key: "step2" as const, done: stats.sessions > 0 },
    { step: 3, key: "step3" as const, done: false },
    { step: 4, key: "step4" as const, done: stats.attendees > 0 },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {edition?.name || t("noEvent")} {edition?.venue ? `— ${edition.venue}` : ""}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 mb-6">
        {statCards.map((stat) => (
          <Card key={stat.key}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-md bg-yellow-500/10 p-2">
                <stat.icon className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold tabular-nums">
                  {stat.value}
                </p>
                <p className="text-xs text-muted-foreground">{t(stat.key)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Getting started guide */}
      <Card>
        <CardContent className="p-6">
          <h2 className="font-heading text-lg font-semibold mb-4">
            {t("getStarted")}
          </h2>
          <div className="space-y-3">
            {steps.map((item) => (
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
                  {t(item.key)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
