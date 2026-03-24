"use client";

import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PipelineFilters, usePipelineFilters } from "@/components/pipeline-view";
import { PipelineTable } from "@/components/pipeline-table";
import { EntityDrawer } from "@/components/entity-drawer";
import {
  Users,
  Upload,
  Search,
  CheckCircle2,
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
  source: string;
  stage: string;
  assignedTo: string | null;
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
  const { source, stage, setSource, setStage, filter: pipelineFilter } = usePipelineFilters();
  const [attendees, setAttendees] = useState(initialAttendees);
  const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null);
  const [drawerSaving, setDrawerSaving] = useState(false);
  const [drawerForm, setDrawerForm] = useState<Record<string, string | null>>({});
  const [search, setSearch] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [checkInFilter, setCheckInFilter] = useState<"all" | "checked_in" | "not_checked_in">("all");

  const filtered = pipelineFilter(attendees)
    .filter((a) => {
      if (checkInFilter === "checked_in") return a.checkedIn;
      if (checkInFilter === "not_checked_in") return !a.checkedIn;
      return true;
    })
    .filter(
      (a) =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.email.toLowerCase().includes(search.toLowerCase())
    );

  const columns = [
    {
      key: "name",
      label: "Name",
      width: "160px",
      render: (a: Attendee) => (
        <p className="font-medium text-sm">{a.name}</p>
      ),
    },
    {
      key: "email",
      label: "Email",
      width: "200px",
      render: (a: Attendee) => (
        <span className="text-xs text-muted-foreground">{a.email || "—"}</span>
      ),
    },
    {
      key: "ticketType",
      label: "Ticket Type",
      width: "110px",
      render: (a: Attendee) => (
        <Badge variant="outline" className="text-[10px]">{a.ticketType}</Badge>
      ),
    },
    {
      key: "checkedIn",
      label: "Check-in Status",
      width: "130px",
      render: (a: Attendee) =>
        a.checkedIn ? (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            {a.checkedInAt
              ? new Date(a.checkedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "Checked in"}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">Not checked in</span>
        ),
    },
  ];

  // Refresh data without full page reload
  const refreshData = useCallback(async () => {
    const res = await fetch("/api/attendees?editionId=all");
    if (res.ok) {
      const json = await res.json();
      if (json.data) setAttendees(json.data);
    } else {
      window.location.reload();
    }
  }, []);

  const openDrawer = (attendee: Attendee) => {
    setSelectedAttendee(attendee);
    setDrawerForm({
      name: attendee.name || "",
      email: attendee.email || "",
      ticketType: attendee.ticketType || "general",
      qrHash: attendee.qrHash || "",
      source: attendee.source || "intake",
      stage: attendee.stage || "lead",
      assignedTo: attendee.assignedTo || "",
    });
  };

  const updateField = (field: string, value: string | null) => {
    setDrawerForm((prev) => ({ ...prev, [field]: value || "" }));
  };

  const handleDrawerSave = async () => {
    if (!selectedAttendee) return;
    setDrawerSaving(true);
    await fetch(`/api/attendees/${selectedAttendee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "If-Match": "999" },
      body: JSON.stringify(drawerForm),
    });
    setDrawerSaving(false);
    setSelectedAttendee(null);
    refreshData();
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
        setTimeout(() => refreshData(), 2000);
      }
    } catch {
      setImportResult("Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  const drawerSections = selectedAttendee
    ? [
        {
          label: "Attendee",
          content: (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input value={(drawerForm.name as string) || ""} onChange={(e) => updateField("name", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input value={(drawerForm.email as string) || ""} onChange={(e) => updateField("email", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Ticket Type</Label>
                  <Select value={String(drawerForm.ticketType || "general")} onValueChange={(v) => updateField("ticketType", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="vip">VIP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>QR Hash</Label>
                  <Input value={(drawerForm.qrHash as string) || ""} readOnly className="bg-muted" />
                </div>
              </div>
            </div>
          ),
        },
        {
          label: "Pipeline",
          content: (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Source</Label>
                  <Select value={String(drawerForm.source || "intake")} onValueChange={(v) => updateField("source", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="intake">Intake</SelectItem>
                      <SelectItem value="outreach">Outreach</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Stage</Label>
                  <Select value={String(drawerForm.stage || "lead")} onValueChange={(v) => updateField("stage", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="engaged">Engaged</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="declined">Declined</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Assigned To</Label>
                <Input value={(drawerForm.assignedTo as string) || ""} onChange={(e) => updateField("assignedTo", e.target.value)} />
              </div>
            </div>
          ),
        },
      ]
    : [];

  return (
    <div>
      <div className="mb-6 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Attendees
          </h1>
          <p className="text-sm text-muted-foreground">{attendees.length} total</p>
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

      {/* Pipeline filters */}
      <PipelineFilters
        items={attendees}
        sources={["all", "intake", "outreach", "sponsored"]}
        activeSource={source}
        activeStage={stage}
        onSourceChange={setSource}
        onStageChange={setStage}
      />

      {/* Check-in filters + Search */}
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
            variant={checkInFilter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setCheckInFilter(f)}
          >
            {f === "all" ? "All" : f === "checked_in" ? "Checked In" : "Not Checked In"}
          </Button>
        ))}
      </div>

      {/* Table view */}
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
        <PipelineTable
          items={filtered}
          columns={columns}
          entityName="attendee"
          apiEndpoint="/api/attendees"
          onUpdate={refreshData}
          onRowClick={(attendee) => openDrawer(attendee)}
        />
      )}

      {filtered.length === 0 && attendees.length > 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No attendees match your search.
        </p>
      )}

      <EntityDrawer
        key={selectedAttendee?.id || "closed"}
        isOpen={!!selectedAttendee}
        onClose={() => setSelectedAttendee(null)}
        title={selectedAttendee?.name || ""}
        subtitle={selectedAttendee?.email || ""}
        sections={drawerSections}
        onSave={handleDrawerSave}
        saving={drawerSaving}
      />
    </div>
  );
}
