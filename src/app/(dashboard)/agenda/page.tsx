"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Plus,
  AlertTriangle,
  Clock,
  Eye,
  Pencil,
} from "lucide-react";

type SessionType = "talk" | "workshop" | "keynote" | "break" | "panel" | "networking";
type MockSessionType = "talk" | "workshop" | "keynote" | "break";

const typeColors: Record<SessionType, string> = {
  keynote: "bg-yellow-50 border-yellow-200",
  talk: "bg-sky-50 border-sky-200",
  workshop: "bg-emerald-50 border-emerald-200",
  panel: "bg-violet-50 border-violet-200",
  break: "bg-stone-50 border-stone-300 border-dashed",
  networking: "bg-stone-50 border-stone-300 border-dashed",
};

const typeBadgeColors: Record<SessionType, string> = {
  keynote: "bg-yellow-100 text-yellow-800",
  talk: "bg-sky-100 text-sky-800",
  workshop: "bg-emerald-100 text-emerald-800",
  panel: "bg-violet-100 text-violet-800",
  break: "bg-stone-100 text-stone-600",
  networking: "bg-stone-100 text-stone-600",
};

// Mock data
const mockSessions = [
  {
    id: "1",
    title: "Opening Keynote",
    type: "keynote" as const,
    startTime: "09:00",
    endTime: "09:45",
    day: 1,
    track: "Main Stage",
    speaker: "Batbold T.",
    conflict: null,
  },
  {
    id: "2",
    title: "Open Source in Central Asia",
    type: "talk" as const,
    startTime: "10:00",
    endTime: "10:30",
    day: 1,
    track: "Main Stage",
    speaker: "Sarah K.",
    conflict: null,
  },
  {
    id: "3",
    title: "Hands-on: ML Setup",
    type: "workshop" as const,
    startTime: "09:00",
    endTime: "12:00",
    day: 1,
    track: "Workshop Room",
    speaker: "Enkhbat D.",
    conflict: null,
  },
  {
    id: "4",
    title: "Coffee Break + Networking",
    type: "break" as const,
    startTime: "10:30",
    endTime: "11:00",
    day: 1,
    track: "All",
    speaker: null,
    conflict: null,
  },
  {
    id: "5",
    title: "DevOps for Small Teams",
    type: "talk" as const,
    startTime: "11:00",
    endTime: "11:45",
    day: 1,
    track: "Main Stage",
    speaker: "James L.",
    conflict: "Speaker also assigned to Panel B at 11:30",
  },
  {
    id: "6",
    title: "API Design Workshop",
    type: "workshop" as const,
    startTime: "13:00",
    endTime: "15:00",
    day: 1,
    track: "Workshop Room",
    speaker: null,
    conflict: null,
  },
];

export default function AgendaPage() {
  const [selectedDay, setSelectedDay] = useState(1);
  const [agendaStatus, setAgendaStatus] = useState<"draft" | "published">(
    "draft"
  );

  const sessions = mockSessions;
  const daySessions = sessions.filter((s) => s.day === selectedDay);
  const conflicts = sessions.filter((s) => s.conflict);
  const orphans = sessions.filter(
    (s) => !s.speaker && (s.type as string) !== "break" && (s.type as string) !== "networking"
  );

  if (sessions.length === 0) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Agenda
          </h1>
          <p className="text-sm text-muted-foreground">
            Build your event schedule
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Calendar className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-1">No sessions yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add your first session or import from CSV.
            </p>
            <div className="flex gap-2">
              <Button variant="outline">Import CSV</Button>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Add Session
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Agenda
          </h1>
          <p className="text-sm text-muted-foreground">
            Dev Summit 2026 — Day {selectedDay}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Badge
            variant={agendaStatus === "draft" ? "secondary" : "default"}
            className={
              agendaStatus === "draft"
                ? "border-yellow-300 bg-yellow-50 text-yellow-700"
                : "border-emerald-300 bg-emerald-50 text-emerald-700"
            }
          >
            {agendaStatus === "draft" ? "DRAFT" : "PUBLISHED"}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setAgendaStatus(
                agendaStatus === "draft" ? "published" : "draft"
              )
            }
          >
            <Eye className="mr-2 h-3 w-3" />
            {agendaStatus === "draft" ? "Publish" : "Unpublish"}
          </Button>
          <Button size="sm">
            <Plus className="mr-2 h-3 w-3" /> Add Session
          </Button>
        </div>
      </div>

      {/* Day tabs */}
      <div className="flex gap-2 mb-4">
        {[1, 2].map((day) => (
          <Button
            key={day}
            variant={selectedDay === day ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedDay(day)}
          >
            Day {day}
          </Button>
        ))}
      </div>

      {/* Conflict warnings */}
      {(conflicts.length > 0 || orphans.length > 0) && (
        <div className="mb-4 space-y-2">
          {conflicts.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                <strong>{s.title}:</strong> {s.conflict}
              </span>
            </div>
          ))}
          {orphans.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-2 rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-700"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                <strong>{s.title}:</strong> No speaker assigned
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Session list */}
      <div className="space-y-2">
        {daySessions.map((session) => (
          <div
            key={session.id}
            className={`flex items-stretch rounded-md border ${
              session.conflict
                ? "border-red-300 bg-red-50"
                : typeColors[session.type]
            } overflow-hidden`}
          >
            {/* Time column */}
            <div className="flex w-20 shrink-0 flex-col items-center justify-center border-r border-inherit bg-white/50 px-3 py-3">
              <span className="text-sm font-medium tabular-nums">
                {session.startTime}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {session.endTime}
              </span>
            </div>

            {/* Content */}
            <div className="flex flex-1 items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">
                    {session.title}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      typeBadgeColors[session.type]
                    }`}
                  >
                    {session.type}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                  {session.speaker && <span>{session.speaker}</span>}
                  {session.speaker && session.track && <span>&middot;</span>}
                  <span>{session.track}</span>
                  <span>&middot;</span>
                  <Clock className="h-3 w-3" />
                  <span>
                    {(() => {
                      const [sh, sm] = session.startTime.split(":").map(Number);
                      const [eh, em] = session.endTime.split(":").map(Number);
                      return (eh * 60 + em) - (sh * 60 + sm);
                    })()}
                    min
                  </span>
                </div>
                {session.conflict && (
                  <p className="text-xs text-red-600 font-medium mt-1">
                    {session.conflict}
                  </p>
                )}
              </div>
              <Button variant="ghost" size="sm" className="shrink-0 ml-2">
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
