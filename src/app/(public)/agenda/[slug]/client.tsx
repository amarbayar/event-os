"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Clock } from "lucide-react";

type Session = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  startTime: string | null;
  endTime: string | null;
  day: number;
  room: string | null;
  track: { name: string; color: string | null } | null;
  speaker: { name: string; company: string | null; bio: string | null } | null;
};

type Edition = {
  name: string;
  startDate: string | null;
  endDate: string | null;
  venue: string | null;
  agendaStatus: string;
};

function formatTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function PublicAgendaClient({
  edition,
  sessions,
}: {
  edition: Edition;
  sessions: Session[];
}) {
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedTrack, setSelectedTrack] = useState<string | "all">("all");

  const days = [...new Set(sessions.map((s) => s.day))].sort();
  const tracks = [
    ...new Set(sessions.map((s) => s.track?.name).filter(Boolean)),
  ] as string[];

  const filtered = sessions
    .filter((s) => s.day === selectedDay)
    .filter((s) => selectedTrack === "all" || s.track?.name === selectedTrack || !s.track)
    .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));

  const startDate = edition.startDate ? new Date(edition.startDate) : null;
  const endDate = edition.endDate ? new Date(edition.endDate) : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-stone-900 text-white">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <h1 className="font-heading text-3xl font-bold tracking-tight mb-2">
            {edition.name}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-stone-300">
            {startDate && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {startDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })}
                {endDate && ` — ${endDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`}
              </span>
            )}
            {edition.venue && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {edition.venue}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="border-b sticky top-0 bg-background z-10">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-3 overflow-x-auto">
          <div className="flex gap-1.5">
            {days.map((day) => (
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
          <div className="h-4 w-px bg-border" />
          <div className="flex gap-1.5">
            <Button
              variant={selectedTrack === "all" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setSelectedTrack("all")}
            >
              All
            </Button>
            {tracks.map((track) => (
              <Button
                key={track}
                variant={selectedTrack === track ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setSelectedTrack(track)}
              >
                {track}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Sessions */}
      <div className="mx-auto max-w-3xl px-4 py-6">
        {edition.agendaStatus !== "published" && sessions.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-lg font-medium mb-1">Agenda coming soon</p>
            <p className="text-sm text-muted-foreground">
              Check back closer to the event.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((session) => (
              <div
                key={session.id}
                className={`rounded-lg border p-4 ${
                  session.type === "break" || session.type === "networking"
                    ? "border-dashed bg-stone-50 text-center"
                    : "bg-white"
                }`}
              >
                {session.type === "break" || session.type === "networking" ? (
                  <p className="text-sm text-muted-foreground">
                    {formatTime(session.startTime)} — {session.title}
                  </p>
                ) : (
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-medium">{session.title}</h3>
                        {session.speaker && (
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {session.speaker.name}
                            {session.speaker.company && ` — ${session.speaker.company}`}
                          </p>
                        )}
                      </div>
                      {session.track && (
                        <Badge
                          variant="outline"
                          className="text-[10px] shrink-0"
                          style={{
                            borderColor: session.track.color || undefined,
                            color: session.track.color || undefined,
                          }}
                        >
                          {session.track.name}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      {session.startTime && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(session.startTime)}
                          {session.endTime && ` — ${formatTime(session.endTime)}`}
                        </span>
                      )}
                      <Badge variant="secondary" className="text-[10px]">
                        {session.type}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">
                No sessions scheduled for this day/track yet.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t mt-8">
        <div className="mx-auto max-w-3xl px-4 py-6 text-center text-xs text-muted-foreground">
          Powered by Event OS
        </div>
      </div>
    </div>
  );
}
