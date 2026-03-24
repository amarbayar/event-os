"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Users,
  Upload,
  Search,
  CheckCircle2,
  QrCode,
  X,
  Loader2,
} from "lucide-react";

type Attendee = {
  id: string;
  name: string;
  email: string;
  ticketType: string;
  qrHash: string;
  checkedIn: boolean;
  checkedInAt: Date | null;
};

type Stats = {
  total: number;
  checkedIn: number;
  remaining: number;
  percentage: number;
};

export function AttendeesClient({
  initialAttendees,
  stats,
}: {
  initialAttendees: Attendee[];
  stats: Stats;
}) {
  const [search, setSearch] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "checked_in" | "not_checked_in">("all");

  const attendees = initialAttendees;

  const filtered = attendees
    .filter((a) => {
      if (filter === "checked_in") return a.checkedIn;
      if (filter === "not_checked_in") return !a.checkedIn;
      return true;
    })
    .filter(
      (a) =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.email.toLowerCase().includes(search.toLowerCase())
    );

  const ticketCounts = {
    total: attendees.length,
    professional: attendees.filter((a) => a.ticketType === "professional").length,
    student: attendees.filter((a) => a.ticketType === "student").length,
    vip: attendees.filter((a) => a.ticketType === "vip").length,
  };

  const handleImport = async () => {
    if (!csvText.trim()) return;
    setImporting(true);
    setImportResult(null);

    // Parse CSV
    const lines = csvText.trim().split("\n");
    const header = lines[0].toLowerCase();
    const hasHeader = header.includes("name") || header.includes("email");
    const dataLines = hasHeader ? lines.slice(1) : lines;

    const separator = lines[0].includes("\t") ? "\t" : ",";

    const attendeeList = dataLines
      .filter((l) => l.trim())
      .map((line) => {
        const parts = line.split(separator).map((p) => p.trim());
        return {
          name: parts[0] || "",
          email: parts[1] || "",
          ticketType: parts[2] || "general",
        };
      });

    try {
      const res = await fetch("/api/attendees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editionId: "placeholder", // TODO: wire to real edition
          organizationId: "placeholder",
          attendeeList,
        }),
      });

      const data = await res.json();
      setImportResult(data.message);

      if (res.ok) {
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch {
      setImportResult("Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <div className="mb-6 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Attendees
          </h1>
          <p className="text-sm text-muted-foreground">{stats.total} registered</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImport(!showImport)}
          >
            <Upload className="mr-2 h-3 w-3" /> Import CSV
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-semibold tabular-nums">{ticketCounts.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-semibold tabular-nums">{ticketCounts.professional}</p>
            <p className="text-xs text-muted-foreground">Professional</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-semibold tabular-nums">{ticketCounts.student}</p>
            <p className="text-xs text-muted-foreground">Student</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-semibold tabular-nums text-emerald-600">{stats.checkedIn}</p>
            <p className="text-xs text-muted-foreground">Checked In</p>
          </CardContent>
        </Card>
      </div>

      {/* CSV Import */}
      {showImport && (
        <Card className="mb-6">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Import Attendees from CSV</h3>
              <button onClick={() => setShowImport(false)} className="text-stone-400 hover:text-stone-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste CSV data: Name, Email, Ticket Type (one per line). Tab or comma separated. Header row optional.
            </p>
            <Textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={"Name,Email,Ticket Type\nBatbold T.,batbold@example.com,professional\nSarnai B.,sarnai@example.com,student"}
              rows={6}
              className="font-mono text-xs"
            />
            {importResult && (
              <div className={`rounded-md px-3 py-2 text-sm ${importResult.includes("failed") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                {importResult}
              </div>
            )}
            <Button onClick={handleImport} disabled={!csvText.trim() || importing} className="w-full">
              {importing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing...</> : `Import ${csvText.trim().split("\n").length - 1} attendees`}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filters + Search */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {(["all", "checked_in", "not_checked_in"] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : f === "checked_in" ? "Checked In" : "Not Checked In"}
          </Button>
        ))}
      </div>

      {/* Attendee list */}
      {attendees.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-1">No attendees yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Import attendees from CSV or paste them into the agent chat.
            </p>
            <Button onClick={() => setShowImport(true)}>
              <Upload className="mr-2 h-4 w-4" /> Import CSV
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1">
          {filtered.map((attendee) => (
            <div
              key={attendee.id}
              className="flex items-center justify-between rounded-md border px-4 py-3 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-sm font-medium truncate">{attendee.name}</span>
                <span className="text-xs text-muted-foreground truncate hidden sm:inline">{attendee.email}</span>
                <Badge variant="outline" className="text-[10px] shrink-0">{attendee.ticketType}</Badge>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button className="text-stone-400 hover:text-stone-600" title="Show QR code">
                  <QrCode className="h-4 w-4" />
                </button>
                {attendee.checkedIn ? (
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    {attendee.checkedInAt
                      ? new Date(attendee.checkedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "Checked in"}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">Not checked in</span>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No attendees match your search.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
