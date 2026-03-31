import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Mic2, Users, ScanLine, Store, Ticket, ClipboardList, AlertTriangle, ArrowRight, Clock } from "lucide-react";
import { getDashboardData, getDashboardStats } from "@/lib/queries";
import Link from "next/link";

export const dynamic = "force-dynamic";

function PipelineBar({ label, stages, href }: {
  label: string;
  stages: { lead: number; engaged: number; confirmed: number; declined: number };
  href: string;
}) {
  const total = stages.lead + stages.engaged + stages.confirmed + stages.declined;
  if (total === 0) return null;
  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;

  return (
    <Link href={href} className="block group">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
          {stages.confirmed}/{total} confirmed <ArrowRight className="inline h-3 w-3" />
        </span>
      </div>
      <div className="flex h-2.5 rounded-full overflow-hidden bg-muted">
        {stages.confirmed > 0 && <div className="bg-emerald-500" style={{ width: `${pct(stages.confirmed)}%` }} />}
        {stages.engaged > 0 && <div className="bg-amber-400" style={{ width: `${pct(stages.engaged)}%` }} />}
        {stages.lead > 0 && <div className="bg-stone-300" style={{ width: `${pct(stages.lead)}%` }} />}
        {stages.declined > 0 && <div className="bg-red-300" style={{ width: `${pct(stages.declined)}%` }} />}
      </div>
      <div className="flex gap-3 mt-1">
        <span className="text-[10px] text-muted-foreground">{stages.lead} lead</span>
        <span className="text-[10px] text-muted-foreground">{stages.engaged} engaged</span>
        <span className="text-[10px] text-emerald-600 font-medium">{stages.confirmed} confirmed</span>
        {stages.declined > 0 && <span className="text-[10px] text-red-500">{stages.declined} declined</span>}
      </div>
    </Link>
  );
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const b = `/events/${slug}`; // base path for all links
  const data = await getDashboardData();

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No event selected. Create one in Settings.
      </div>
    );
  }

  const { edition, daysUntil, speakers, sponsors, venues, booths, attendees, sessions, tasks, pendingChecklist, recentActivity } = data;

  // Getting started steps
  const steps = [
    { done: speakers.total > 0, label: "Create your CFP link and share it with potential speakers" },
    { done: sessions.total > 0, label: "Import your schedule or add sessions manually" },
    { done: data.messagingConnected > 0, label: "Connect a messaging platform (Telegram or Discord)" },
    { done: attendees.total > 0, label: "Add attendees and generate QR tickets" },
  ];
  const allDone = steps.every((s) => s.done);

  return (
    <div className="space-y-6">
      {/* Header with countdown */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {edition?.name || "No event"} {edition?.venue ? `— ${edition.venue}` : ""}
          </p>
        </div>
        {daysUntil !== null && (
          <div className="text-right">
            <p className="text-3xl font-bold tabular-nums text-primary">{daysUntil}</p>
            <p className="text-xs text-muted-foreground">{daysUntil === 1 ? "day" : "days"} to go</p>
          </div>
        )}
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4">
        {[
          { label: "Speakers", value: `${speakers.stages.confirmed}/${speakers.total}`, detail: "confirmed", icon: Mic2, href: `${b}/speakers` },
          { label: "Sponsors", value: `${sponsors.stages.confirmed}/${sponsors.total}`, detail: "confirmed", icon: Store, href: `${b}/sponsors` },
          { label: "Sessions", value: String(sessions.total), detail: `${sessions.tracks} tracks`, icon: Calendar, href: `${b}/agenda` },
          { label: "Tickets Sold", value: String(attendees.total), detail: "registered", icon: Ticket, href: `${b}/attendees` },
          { label: "Tasks Done", value: `${tasks.done}/${tasks.total}`, detail: `${tasks.blocked} blocked`, icon: ClipboardList, href: `${b}/tasks` },
        ].map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="hover:border-primary/30 transition-colors cursor-pointer">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-md bg-yellow-500/10 p-2">
                  <stat.icon className="h-4 w-4 text-yellow-600" />
                </div>
                <div>
                  <p className="text-xl font-semibold tabular-nums">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-[10px] text-muted-foreground">{stat.detail}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Main content: two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left column: Pipelines + Agenda + Booths */}
        <div className="lg:col-span-2 space-y-6">

          {/* Pipeline Health */}
          <Card>
            <CardContent className="p-5 space-y-5">
              <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">Pipeline Health</h2>
              <PipelineBar label="Speakers" stages={speakers.stages} href={`${b}/speakers`} />
              <PipelineBar label="Sponsors" stages={sponsors.stages} href={`${b}/sponsors`} />
              {venues.stages.confirmed > 0 ? (
                <Link href={`${b}/venue`} className="block group">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium">Venue</span>
                    <span className="text-xs text-emerald-600 font-medium group-hover:text-primary transition-colors">
                      Confirmed <ArrowRight className="inline h-3 w-3" />
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden bg-muted">
                    <div className="bg-emerald-500 h-full w-full" />
                  </div>
                </Link>
              ) : (
                <PipelineBar label="Venue" stages={venues.stages} href={`${b}/venue`} />
              )}
              <PipelineBar label="Booths" stages={booths.stages} href={`${b}/booths`} />
            </CardContent>
          </Card>

          {/* Agenda snapshot + Ticket sales side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Agenda */}
            <Link href={`${b}/agenda`}>
              <Card className="hover:border-primary/30 transition-colors cursor-pointer h-full">
                <CardContent className="p-5">
                  <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Agenda</h2>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Sessions</span>
                      <span className="text-sm font-medium">{sessions.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Tracks</span>
                      <span className="text-sm font-medium">{sessions.tracks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Speakers confirmed</span>
                      <span className="text-sm font-medium text-emerald-600">{speakers.stages.confirmed}</span>
                    </div>
                  </div>
                  <p className="text-xs text-primary mt-3 flex items-center gap-1">
                    View full agenda <ArrowRight className="h-3 w-3" />
                  </p>
                </CardContent>
              </Card>
            </Link>

            {/* Ticket Sales */}
            <Link href={`${b}/attendees`}>
              <Card className="hover:border-primary/30 transition-colors cursor-pointer h-full">
                <CardContent className="p-5">
                  <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Ticket Sales</h2>
                  <p className="text-3xl font-bold tabular-nums">{attendees.total}</p>
                  <p className="text-xs text-muted-foreground mb-3">tickets sold</p>
                  <p className="text-xs text-primary mt-3 flex items-center gap-1">
                    Manage attendees <ArrowRight className="h-3 w-3" />
                  </p>
                </CardContent>
              </Card>
            </Link>
            {/* Check-in */}
            {(() => {
              const isEventDay = daysUntil !== null && daysUntil <= 0;
              return (
                <Link href={`${b}/check-in`}>
                  <Card className={`hover:border-primary/30 transition-colors cursor-pointer h-full ${!isEventDay ? "opacity-60" : ""}`}>
                    <CardContent className="p-5">
                      <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                        <ScanLine className="inline h-3.5 w-3.5 mr-1" />Check-in
                      </h2>
                      {isEventDay ? (
                        <>
                          <p className="text-3xl font-bold tabular-nums">{attendees.checkedIn}<span className="text-lg font-normal text-muted-foreground">/{attendees.total}</span></p>
                          <p className="text-xs text-muted-foreground mb-2">checked in</p>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${attendees.total > 0 ? (attendees.checkedIn / attendees.total) * 100 : 0}%` }} />
                          </div>
                          <p className="text-xs text-primary mt-3 flex items-center gap-1">
                            Open scanner <ArrowRight className="h-3 w-3" />
                          </p>
                        </>
                      ) : (
                        <div className="text-center py-2">
                          <Clock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">
                            {daysUntil !== null ? `Opens in ${daysUntil} day${daysUntil === 1 ? "" : "s"}` : "Event date not set"}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })()}
          </div>

          {/* Getting started — only if not all done */}
          {!allDone && (
            <Card>
              <CardContent className="p-5">
                <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Get Started</h2>
                <div className="space-y-2.5">
                  {steps.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                        item.done ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500"
                      }`}>
                        {item.done ? "✓" : i + 1}
                      </span>
                      <span className={item.done ? "text-muted-foreground line-through" : ""}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: Needs Attention + Recent Activity */}
        <div className="space-y-6">

          {/* Needs Attention */}
          {(tasks.overdue.length > 0 || pendingChecklist > 0 || tasks.blocked > 0) && (
            <Card className="border-amber-200">
              <CardContent className="p-5">
                <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-amber-600 mb-3 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> Needs Attention
                </h2>
                <div className="space-y-2.5">
                  {tasks.overdue.map((task: any) => (
                    <Link key={task.id} href={`${b}/tasks`} className="flex items-start gap-2 text-sm hover:text-primary transition-colors">
                      <Clock className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium">{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Due {task.dueDate ? new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "unknown"}
                          {task.assigneeName ? ` · ${task.assigneeName}` : ""}
                        </p>
                      </div>
                    </Link>
                  ))}
                  {pendingChecklist > 0 && (
                    <Link href={`${b}/speakers`} className="flex items-center gap-2 text-sm hover:text-primary transition-colors">
                      <ClipboardList className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <span>{pendingChecklist} checklist items awaiting submission</span>
                    </Link>
                  )}
                  {tasks.blocked > 0 && (
                    <Link href={`${b}/tasks`} className="flex items-center gap-2 text-sm hover:text-primary transition-colors">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                      <span>{tasks.blocked} tasks blocked</span>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          )}


          {/* Recent Activity (edition-scoped) */}
          <Card>
            <CardContent className="p-5">
              <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Recent Activity</h2>
              {recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent activity for this event.</p>
              ) : (
                <div className="space-y-3">
                  {recentActivity.map((n: any) => (
                    <div key={n.id} className="flex items-start gap-2">
                      <div className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${
                        n.type === "assignment" ? "bg-blue-400" :
                        n.type === "stage_change" ? "bg-emerald-400" :
                        n.type === "checklist" ? "bg-amber-400" :
                        "bg-stone-300"
                      }`} />
                      <div className="min-w-0">
                        <p className="text-sm truncate">{n.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(n.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Task Summary */}
          <Link href={`${b}/tasks`}>
            <Card className="hover:border-primary/30 transition-colors cursor-pointer">
              <CardContent className="p-5">
                <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Tasks</h2>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "To Do", value: tasks.todo, color: "text-stone-600" },
                    { label: "In Progress", value: tasks.in_progress, color: "text-blue-600" },
                    { label: "Blocked", value: tasks.blocked, color: "text-red-600" },
                    { label: "Done", value: tasks.done, color: "text-emerald-600" },
                  ].map((t) => (
                    <div key={t.label} className="text-center p-2 rounded-md bg-muted/50">
                      <p className={`text-lg font-semibold tabular-nums ${t.color}`}>{t.value}</p>
                      <p className="text-[10px] text-muted-foreground">{t.label}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-primary mt-3 flex items-center gap-1">
                  View task board <ArrowRight className="h-3 w-3" />
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
