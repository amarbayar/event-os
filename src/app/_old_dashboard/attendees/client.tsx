"use client";

import { useState, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { formatTime } from "@/lib/i18n/date";
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
  const t = useTranslations("Attendees");
  const tC = useTranslations("Common");
  const locale = useLocale();
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
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const filtered = attendees
    .filter((a) => sourceFilter === "all" || a.source === sourceFilter)
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

  const ticketCounts = {
    total: attendees.length,
    professional: attendees.filter((a) => a.ticketType === "professional").length,
    student: attendees.filter((a) => a.ticketType === "student").length,
    vip: attendees.filter((a) => a.ticketType === "vip").length,
  };

  const refreshData = useCallback(() => { window.location.reload(); }, []);

  const openDrawer = (attendee: Attendee) => {
    setSelectedAttendee(attendee);
    setDrawerForm({
      name: attendee.name || "",
      email: attendee.email || "",
      ticketType: attendee.ticketType || "general",
      qrHash: attendee.qrHash || "",
      source: attendee.source || "online",
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
    refreshData();
  };

  const handleImport = async () => {
    if (!csvText.trim()) return;
    setImporting(true);
    setImportResult(null);

    const lines = csvText.trim().split("\n");
    const header = lines[0].toLowerCase();
    const hasHeader = header.includes("name") || header.includes("email");
    const dataLines = hasHeader ? lines.slice(1) : lines;
    const separator = lines[0].includes("\t") ? "\t" : ",";

    const attendeeList = dataLines
      .filter((l) => l.trim())
      .map((line) => {
        const parts = line.split(separator).map((p) => p.trim());
        return { name: parts[0] || "", email: parts[1] || "", ticketType: parts[2] || "general" };
      });

    try {
      const res = await fetch("/api/attendees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editionId: "placeholder", organizationId: "placeholder", attendeeList }),
      });
      const data = await res.json();
      setImportResult(data.message);
      if (res.ok) setTimeout(() => refreshData(), 2000);
    } catch {
      setImportResult(t("importFailed"));
    } finally {
      setImporting(false);
    }
  };

  // Simple table — no pipeline stage/assignedTo columns
  const tableRows = filtered;

  const drawerSections = selectedAttendee
    ? [
        {
          label: t("detailsTab"),
          content: (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t("nameHeader")}</Label>
                  <Input value={(drawerForm.name as string) || ""} onChange={(e) => updateField("name", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("emailHeader")}</Label>
                  <Input value={(drawerForm.email as string) || ""} onChange={(e) => updateField("email", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t("ticketTypeLabel")}</Label>
                  <Select value={String(drawerForm.ticketType || "general")} onValueChange={(v) => updateField("ticketType", v)}>
                    <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">{t("ticketGeneral")}</SelectItem>
                      <SelectItem value="professional">{t("ticketProfessional")}</SelectItem>
                      <SelectItem value="student">{t("ticketStudent")}</SelectItem>
                      <SelectItem value="vip">{t("ticketVip")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("sourceLabel")}</Label>
                  <Select value={String(drawerForm.source || "online")} onValueChange={(v) => updateField("source", v)}>
                    <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="online">{t("sourceOnline")}</SelectItem>
                      <SelectItem value="offline">{t("offlineDayOf")}</SelectItem>
                      <SelectItem value="internal">{t("internalGuest")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t("qrHashLabel")}</Label>
                <Input value={(drawerForm.qrHash as string) || ""} readOnly className="bg-muted font-mono text-xs" />
              </div>
              {selectedAttendee.checkedIn && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-sm text-emerald-700 font-medium">
                    {selectedAttendee.checkedInAt
                      ? t("checkedInAt", { time: formatTime(selectedAttendee.checkedInAt, locale) })
                      : t("checkedInNoTime")}
                  </p>
                </div>
              )}
            </div>
          ),
        },
      ]
    : [];

  return (
    <div>
      <div className="mb-6 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("registered", { count: attendees.length })}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowImport(!showImport)}>
          <Upload className="mr-2 h-3 w-3" /> {t("importCsvButton")}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 mb-4">
        <Card><CardContent className="p-4"><p className="text-2xl font-semibold tabular-nums">{ticketCounts.total}</p><p className="text-xs text-muted-foreground">{t("total")}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-semibold tabular-nums text-emerald-600">{stats.checkedIn}</p><p className="text-xs text-muted-foreground">{t("checkedIn")}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-semibold tabular-nums">{ticketCounts.professional}</p><p className="text-xs text-muted-foreground">{t("professional")}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-semibold tabular-nums">{ticketCounts.student}</p><p className="text-xs text-muted-foreground">{t("student")}</p></CardContent></Card>
      </div>

      {/* CSV Import */}
      {showImport && (
        <Card className="mb-4">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">{t("importCsv")}</h3>
              <button onClick={() => setShowImport(false)} className="text-stone-400 hover:text-stone-600"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-xs text-muted-foreground">{t("csvInstructions")}</p>
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
              {importing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("importing")}</> : t("import")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("searchPlaceholder")} className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {(["all", "online", "offline", "internal"] as const).map((s) => (
          <Button key={s} variant={sourceFilter === s ? "default" : "outline"} size="sm" onClick={() => setSourceFilter(s)} className="capitalize">
            {s === "all" ? t("allSources") : s === "internal" ? t("guest") : s === "online" ? t("sourceOnline") : t("sourceOffline")}
          </Button>
        ))}
        <div className="h-4 w-px bg-border" />
        {(["all", "checked_in", "not_checked_in"] as const).map((f) => (
          <Button key={f} variant={checkInFilter === f ? "secondary" : "ghost"} size="sm" onClick={() => setCheckInFilter(f)}>
            {f === "all" ? t("allStatus") : f === "checked_in" ? t("checkedIn") : t("notCheckedIn")}
          </Button>
        ))}
      </div>

      {/* Attendee table — simple, no pipeline columns */}
      {attendees.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-1">{t("noAttendees")}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t("noAttendeesDescription")}</p>
            <Button onClick={() => setShowImport(true)}><Upload className="mr-2 h-4 w-4" /> {t("importCsvButton")}</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-stone-50">
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-stone-500">{t("nameHeader")}</th>
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-stone-500">{t("emailHeader")}</th>
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-stone-500 w-[100px]">{t("ticketHeader")}</th>
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-stone-500 w-[80px]">{t("sourceHeader")}</th>
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-stone-500 w-[130px]">{t("checkInHeader")}</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => openDrawer(a)}
                  className="border-b last:border-0 hover:bg-yellow-50/30 transition-colors cursor-pointer"
                >
                  <td className="px-3 py-2 font-medium">{a.name}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{a.email}</td>
                  <td className="px-3 py-2"><Badge variant="outline" className="text-[10px] capitalize">{a.ticketType}</Badge></td>
                  <td className="px-3 py-2"><span className="text-xs capitalize text-muted-foreground">{a.source || "online"}</span></td>
                  <td className="px-3 py-2">
                    {a.checkedIn ? (
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        {a.checkedInAt ? formatTime(a.checkedInAt, locale) : t("yes")}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length === 0 && attendees.length > 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">{t("noMatch")}</p>
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
