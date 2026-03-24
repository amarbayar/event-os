"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Clock } from "lucide-react";

// Mock data for the public agenda
const mockEdition = {
  name: "Dev Summit 2026",
  startDate: "2026-03-28",
  endDate: "2026-03-29",
  venue: "Chinggis Khaan Hotel, Ulaanbaatar",
};

const mockSessions = [
  {
    id: "1",
    title: "Opening Keynote",
    type: "keynote",
    startTime: "09:00",
    endTime: "09:45",
    day: 1,
    track: { name: "Main Stage", color: "#eab308" },
    speaker: { name: "Batbold T.", company: "DataMN", bio: "CEO of DataMN, building ML infrastructure in Mongolia." },
  },
  {
    id: "2",
    title: "Open Source in Central Asia",
    type: "talk",
    startTime: "10:00",
    endTime: "10:30",
    day: 1,
    track: { name: "Main Stage", color: "#eab308" },
    speaker: { name: "Sarah K.", company: "OSS Foundation", bio: "Open source advocate and community builder." },
  },
  {
    id: "3",
    title: "Coffee Break + Networking",
    type: "break",
    startTime: "10:30",
    endTime: "11:00",
    day: 1,
    track: null,
    speaker: null,
  },
  {
    id: "4",
    title: "DevOps for Small Teams",
    type: "talk",
    startTime: "11:00",
    endTime: "11:45",
    day: 1,
    track: { name: "Main Stage", color: "#eab308" },
    speaker: { name: "James L.", company: "Freelance", bio: "15 years of DevOps experience across startups." },
  },
  {
    id: "5",
    title: "Hands-on: ML Setup Workshop",
    type: "workshop",
    startTime: "09:00",
    endTime: "12:00",
    day: 1,
    track: { name: "Workshop Room", color: "#047857" },
    speaker: { name: "Enkhbat D.", company: "NUM University", bio: "Professor of Computer Science at NUM." },
  },
];

export default function PublicAgendaPage() {
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedTrack, setSelectedTrack] = useState<string | "all">("all");

  const daySessions = mockSessions
    .filter((s) => s.day === selectedDay)
    .filter((s) => selectedTrack === "all" || s.track?.name === selectedTrack || !s.track)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const tracks = [...new Set(mockSessions.map((s) => s.track?.name).filter(Boolean))] as string[];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-stone-900 text-white">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <h1 className="font-heading text-3xl font-bold tracking-tight mb-2">
            {mockEdition.name}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-stone-300">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              March 28-29, 2026
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {mockEdition.venue}
            </span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="border-b sticky top-0 bg-background z-10">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-3 overflow-x-auto">
          <div className="flex gap-1.5">
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
        <div className="space-y-3">
          {daySessions.map((session) => (
            <div
              key={session.id}
              className={`rounded-lg border p-4 ${
                session.type === "break"
                  ? "border-dashed bg-stone-50 text-center"
                  : "bg-white"
              }`}
            >
              {session.type === "break" ? (
                <p className="text-sm text-muted-foreground">
                  {session.startTime} — {session.title}
                </p>
              ) : (
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-medium">{session.title}</h3>
                      {session.speaker && (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {session.speaker.name}
                          {session.speaker.company &&
                            ` — ${session.speaker.company}`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {session.track && (
                        <Badge
                          variant="outline"
                          className="text-[10px]"
                          style={{
                            borderColor: session.track.color,
                            color: session.track.color,
                          }}
                        >
                          {session.track.name}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {session.startTime} — {session.endTime}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {session.type}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
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
