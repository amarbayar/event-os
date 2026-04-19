/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
import {
  Calendar,
  Plus,
  AlertTriangle,
  AlertCircle,
  Clock,
  Trash2,
  X,
  Lock,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Users,
  Mic,
  Coffee,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-dialog";
import { EntityDrawer } from "@/components/entity-drawer";
import { cn } from "@/lib/utils";
import { validateRequired, getApiError } from "@/lib/validation";

// ─── Types ──────────────────────────────────────────────

type SessionType =
  | "talk"
  | "workshop"
  | "panel"
  | "keynote"
  | "break"
  | "networking"
  | "opening"
  | "closing"
  | "coffee"
  | "lunch"
  | "fireside"
  | "lightning";

type Session = {
  id: string;
  title: string;
  type: SessionType;
  startTime: string | Date | null;
  endTime: string | Date | null;
  day: number;
  room: string | null;
  durationMinutes: number;
  trackId: string | null;
  speakerId: string | null;
  panelSpeakerIds: string[] | null;
  hostId: string | null;
  description: string | null;
  version?: number;
  speaker: {
    id: string;
    name: string;
    company: string | null;
    stage: string;
    headshotUrl?: string | null;
  } | null;
  track: { id: string; name: string; color: string | null } | null;
};

type Track = {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number;
};

type Speaker = {
  id: string;
  name: string;
  company: string | null;
  stage: string;
  talkTitle: string;
};

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type AgendaIssue = {
  type: string;
  severity: "error" | "warning";
  sessionIds: string[];
  message: string;
};

// ─── Constants ──────────────────────────────────────────

const SLOT_HEIGHT = 48; // px per 15-min slot
const TIME_COL_WIDTH = 60; // px
const MIN_TRACK_WIDTH = 180; // px

const SESSION_TYPES: { value: SessionType; label: string }[] = [
  { value: "talk", label: "Talk" },
  { value: "keynote", label: "Keynote" },
  { value: "panel", label: "Panel" },
  { value: "workshop", label: "Workshop" },
  { value: "lightning", label: "Lightning" },
  { value: "fireside", label: "Fireside" },
  { value: "opening", label: "Opening" },
  { value: "closing", label: "Closing" },
  { value: "break", label: "Break" },
  { value: "coffee", label: "Coffee" },
  { value: "lunch", label: "Lunch" },
  { value: "networking", label: "Networking" },
];

const SPEAKER_SESSION_TYPES: SessionType[] = ["talk", "keynote", "lightning", "fireside"];
const PANEL_SESSION_TYPES: SessionType[] = ["panel"];
const HOST_SESSION_TYPES: SessionType[] = ["opening", "closing"];

const typeColors: Record<SessionType, string> = {
  keynote: "bg-yellow-50 border-yellow-300",
  talk: "bg-sky-50 border-sky-200",
  workshop: "bg-emerald-50 border-emerald-200",
  panel: "bg-violet-50 border-violet-200",
  lightning: "bg-orange-50 border-orange-200",
  fireside: "bg-amber-50 border-amber-200",
  opening: "bg-indigo-50 border-indigo-200",
  closing: "bg-indigo-50 border-indigo-200",
  break: "bg-stone-50 border-stone-300 border-dashed",
  coffee: "bg-stone-50 border-stone-300 border-dashed",
  lunch: "bg-stone-50 border-stone-300 border-dashed",
  networking: "bg-stone-50 border-stone-300 border-dashed",
};

const typeBadgeColors: Record<SessionType, string> = {
  keynote: "bg-yellow-100 text-yellow-800",
  talk: "bg-sky-100 text-sky-800",
  workshop: "bg-emerald-100 text-emerald-800",
  panel: "bg-violet-100 text-violet-800",
  lightning: "bg-orange-100 text-orange-800",
  fireside: "bg-amber-100 text-amber-800",
  opening: "bg-indigo-100 text-indigo-800",
  closing: "bg-indigo-100 text-indigo-800",
  break: "bg-stone-100 text-stone-600",
  coffee: "bg-stone-100 text-stone-600",
  lunch: "bg-stone-100 text-stone-600",
  networking: "bg-stone-100 text-stone-600",
};

const typeIcons: Partial<Record<SessionType, React.ReactNode>> = {
  panel: <Users className="h-3 w-3" />,
  keynote: <Mic className="h-3 w-3" />,
  coffee: <Coffee className="h-3 w-3" />,
  lunch: <Utensils className="h-3 w-3" />,
};

// ─── Helpers ────────────────────────────────────────────

function parseHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

function formatHHMM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function toDate(value: string | Date | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function generateTimeSlots(startTime: string, endTime: string): string[] {
  const start = parseHHMM(startTime);
  const end = parseHHMM(endTime);
  const slots: string[] = [];
  for (let m = start; m < end; m += 15) {
    slots.push(formatHHMM(m));
  }
  return slots;
}

// ─── Component Props ────────────────────────────────────

type AgendaClientProps = {
  initialSessions: Session[];
  tracks: Track[];
  editionId: string;
  editionName: string;
  totalDays: number;
  agendaStartTime: string;
  agendaEndTime: string;
  agendaGapMinutes: number;
  agendaStatus: "draft" | "published";
};

// ─── Main Component ─────────────────────────────────────

export function AgendaClient({
  initialSessions,
  tracks,
  editionId,
  editionName,
  totalDays,
  agendaStartTime,
  agendaEndTime,
  agendaGapMinutes: initialGapMinutes,
  agendaStatus: initialAgendaStatus,
}: AgendaClientProps) {
  // ── State ──
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [selectedDay, setSelectedDay] = useState(1);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [issues, setIssues] = useState<AgendaIssue[]>([]);
  const [showConflicts, setShowConflicts] = useState(false);
  const [gapMinutes, setGapMinutes] = useState(initialGapMinutes);
  const [gapLocked, setGapLocked] = useState(true);
  const agendaStatus = initialAgendaStatus;

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType] = useState<SessionType>("talk");
  const [formTrackId, setFormTrackId] = useState<string>("");
  const [formSpeakerId, setFormSpeakerId] = useState<string>("");
  const [formPanelSpeakerIds, setFormPanelSpeakerIds] = useState<string[]>([]);
  const [formHostId, setFormHostId] = useState<string>("");
  const [formDay, setFormDay] = useState(1);
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formDuration, setFormDuration] = useState(30);
  const [formRoom, setFormRoom] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Drag state
  const [dragSessionId, setDragSessionId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ trackId: string; slotIndex: number } | null>(null);

  const { confirm } = useConfirm();
  const gridRef = useRef<HTMLDivElement>(null);

  // ── Time grid slots ──
  const timeSlots = useMemo(
    () => generateTimeSlots(agendaStartTime, agendaEndTime),
    [agendaStartTime, agendaEndTime]
  );
  const gridStartMinutes = parseHHMM(agendaStartTime);

  // ── Fetch speakers + team members + validation on mount ──
  useEffect(() => {
    Promise.all([
      fetch("/api/speakers").then((r) => r.json()),
      fetch("/api/users").then((r) => r.json()),
    ]).then(([speakerRes, usersRes]) => {
      if (speakerRes.data) {
        setSpeakers(
          speakerRes.data.map((s: Record<string, unknown>) => ({
            id: s.id as string,
            name: s.name as string,
            company: (s.company as string) || null,
            stage: s.stage as string,
            talkTitle: (s.talkTitle as string) || "TBD",
          }))
        );
      }
      if (usersRes.data) {
        setTeamMembers(
          usersRes.data.map((u: Record<string, unknown>) => ({
            id: u.id as string,
            name: u.name as string,
            email: u.email as string,
            role: u.role as string,
          }))
        );
      }
    });

    if (editionId) {
      fetchValidation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editionId]);

  // ── Data fetching helpers ──
  const fetchSessions = useCallback(async () => {
    const res = await fetch("/api/sessions");
    if (res.ok) {
      const json = await res.json();
      if (json.data) setSessions(json.data);
    }
  }, []);

  const fetchValidation = useCallback(async () => {
    if (!editionId) return;
    const res = await fetch(`/api/editions/${editionId}/agenda/validate`);
    if (res.ok) {
      const json = await res.json();
      if (json.data) setIssues(json.data);
    }
  }, [editionId]);

  // ── Filter sessions for current day ──
  const daySessions = useMemo(
    () => sessions.filter((s) => s.day === selectedDay),
    [sessions, selectedDay]
  );

  // ── Issue counts ──
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const totalIssues = issues.length;

  // ── Build a set of session IDs with issues ──
  const sessionIssueMap = useMemo(() => {
    const map = new Map<string, AgendaIssue[]>();
    for (const issue of issues) {
      for (const sid of issue.sessionIds) {
        const existing = map.get(sid) || [];
        existing.push(issue);
        map.set(sid, existing);
      }
    }
    return map;
  }, [issues]);

  // ── Get the position and height for a session in the grid ──
  const getSessionPosition = useCallback(
    (session: Session) => {
      const start = toDate(session.startTime);
      if (!start) return null;
      const startMin = minutesSinceMidnight(start);
      const topOffset = ((startMin - gridStartMinutes) / 15) * SLOT_HEIGHT;
      const heightPx = (session.durationMinutes / 15) * SLOT_HEIGHT;
      return { top: topOffset, height: Math.max(heightPx, SLOT_HEIGHT) };
    },
    [gridStartMinutes]
  );

  // ── Drawer helpers ──
  const resetForm = useCallback(() => {
    setFormTitle("");
    setFormType("talk");
    setFormTrackId("");
    setFormSpeakerId("");
    setFormPanelSpeakerIds([]);
    setFormHostId("");
    setFormDay(selectedDay);
    setFormStartTime("09:00");
    setFormDuration(30);
    setFormRoom("");
    setFormDescription("");
    setFormErrors({});
  }, [selectedDay]);

  const openAddDrawer = useCallback(
    (trackId?: string, slotTime?: string) => {
      resetForm();
      setEditingSession(null);
      if (trackId) setFormTrackId(trackId);
      if (slotTime) setFormStartTime(slotTime);
      setFormDay(selectedDay);
      setDrawerOpen(true);
    },
    [resetForm, selectedDay]
  );

  const openEditDrawer = useCallback((session: Session) => {
    setEditingSession(session);
    setFormTitle(session.title);
    setFormType(session.type);
    setFormTrackId(session.trackId || "");
    setFormSpeakerId(session.speakerId || "");
    setFormPanelSpeakerIds(session.panelSpeakerIds || []);
    setFormHostId(session.hostId || "");
    setFormDay(session.day);
    const start = toDate(session.startTime);
    setFormStartTime(start ? formatHHMM(minutesSinceMidnight(start)) : "09:00");
    setFormDuration(session.durationMinutes);
    setFormRoom(session.room || "");
    setFormDescription(session.description || "");
    setFormErrors({});
    setDrawerOpen(true);
  }, []);

  // ── Compute end time from start + duration ──
  const computedEndTime = useMemo(() => {
    const startMin = parseHHMM(formStartTime);
    return formatHHMM(startMin + formDuration);
  }, [formStartTime, formDuration]);

  // ── Save session (create or update) ──
  const handleSave = useCallback(async () => {
    const errors = validateRequired({ title: formTitle }, ["title"]);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    setSaving(true);

    // Build ISO timestamps: use a reference date for the time
    const refDate = "2026-01-01";
    const startISO = `${refDate}T${formStartTime}:00`;
    const endISO = `${refDate}T${computedEndTime}:00`;

    const payload: Record<string, unknown> = {
      title: formTitle,
      type: formType,
      trackId: formTrackId || null,
      day: formDay,
      startTime: startISO,
      endTime: endISO,
      durationMinutes: formDuration,
      room: formRoom || null,
      description: formDescription || null,
    };

    // Assign speaker/panel/host based on type
    if (SPEAKER_SESSION_TYPES.includes(formType)) {
      payload.speakerId = formSpeakerId || null;
      payload.panelSpeakerIds = null;
      payload.hostId = null;
    } else if (PANEL_SESSION_TYPES.includes(formType)) {
      payload.speakerId = null;
      payload.panelSpeakerIds = formPanelSpeakerIds.length > 0 ? formPanelSpeakerIds : null;
      payload.hostId = null;
    } else if (HOST_SESSION_TYPES.includes(formType)) {
      payload.speakerId = null;
      payload.panelSpeakerIds = null;
      payload.hostId = formHostId || null;
    } else {
      payload.speakerId = null;
      payload.panelSpeakerIds = null;
      payload.hostId = null;
    }

    try {
      let res: Response;
      if (editingSession) {
        res = await fetch(`/api/sessions/${editingSession.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(editingSession.version != null
              ? { "If-Match": String(editingSession.version) }
              : {}),
          },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/editions/${editionId}/agenda`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        toast.error(await getApiError(res, "Failed to save session"));
        setSaving(false);
        return;
      }

      const json = await res.json();
      if (json.issues) setIssues(json.issues);

      toast.success(editingSession ? "Session updated" : "Session created");
      await fetchSessions();
      await fetchValidation();

      if (!editingSession) {
        resetForm();
      }
    } catch {
      toast.error("Network error — could not save session");
    } finally {
      setSaving(false);
    }
  }, [
    formTitle,
    formType,
    formTrackId,
    formSpeakerId,
    formPanelSpeakerIds,
    formHostId,
    formDay,
    formStartTime,
    formDuration,
    formRoom,
    formDescription,
    computedEndTime,
    editingSession,
    editionId,
    fetchSessions,
    fetchValidation,
    resetForm,
  ]);

  // ── Delete session ──
  const handleDelete = useCallback(
    async (session: Session) => {
      const confirmed = await confirm({
        title: "Delete session",
        message: `Delete "${session.title}"? This cannot be undone.`,
        confirmLabel: "Delete",
        variant: "danger",
      });
      if (!confirmed) return;

      const res = await fetch(`/api/sessions/${session.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error(await getApiError(res, "Failed to delete session"));
        return;
      }

      toast.success("Session deleted");
      await fetchSessions();
      await fetchValidation();
      setDrawerOpen(false);
    },
    [confirm, fetchSessions, fetchValidation]
  );

  // ── Drag & Drop ──
  const handleDragStart = useCallback(
    (e: React.DragEvent, sessionId: string) => {
      setDragSessionId(sessionId);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", sessionId);
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, trackId: string, slotIndex: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropTarget({ trackId, slotIndex });
    },
    []
  );

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, trackId: string, slotIndex: number) => {
      e.preventDefault();
      setDropTarget(null);

      const sessionId = e.dataTransfer.getData("text/plain");
      if (!sessionId) return;

      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return;

      const newStartMinutes = gridStartMinutes + slotIndex * 15;
      const newEndMinutes = newStartMinutes + session.durationMinutes;
      const refDate = "2026-01-01";
      const newStartISO = `${refDate}T${formatHHMM(newStartMinutes)}:00`;
      const newEndISO = `${refDate}T${formatHHMM(newEndMinutes)}:00`;

      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(session.version != null
            ? { "If-Match": String(session.version) }
            : {}),
        },
        body: JSON.stringify({
          trackId: trackId || null,
          startTime: newStartISO,
          endTime: newEndISO,
          day: selectedDay,
        }),
      });

      if (!res.ok) {
        toast.error(await getApiError(res, "Failed to move session"));
        return;
      }

      const json = await res.json();
      if (json.issues) setIssues(json.issues);

      toast.success("Session moved");
      await fetchSessions();
      await fetchValidation();
      setDragSessionId(null);
    },
    [sessions, gridStartMinutes, selectedDay, fetchSessions, fetchValidation]
  );

  // ── Gap lock/save ──
  const handleGapSave = useCallback(async () => {
    const confirmed = await confirm({
      title: "Update gap setting",
      message: `Set the minimum gap between sessions to ${gapMinutes} minutes?`,
      confirmLabel: "Save",
    });
    if (!confirmed) return;
    setGapLocked(true);
    toast.success(`Gap set to ${gapMinutes} min`);
  }, [confirm, gapMinutes]);

  // ── Drawer form content ──
  const drawerContent = (
    <div className="space-y-4">
      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="session-title">Title *</Label>
        <Input
          id="session-title"
          value={formTitle}
          onChange={(e) => {
            setFormTitle(e.target.value);
            setFormErrors((prev) => {
              const next = { ...prev };
              delete next.title;
              return next;
            });
          }}
          placeholder="e.g., Opening Keynote"
          aria-invalid={!!formErrors.title}
        />
        {formErrors.title && (
          <p className="text-xs text-destructive">{formErrors.title}</p>
        )}
      </div>

      {/* Type */}
      <div className="space-y-1.5">
        <Label>Type</Label>
        <Select value={formType} onValueChange={(v) => setFormType(v as SessionType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SESSION_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Speaker (for talk/keynote/lightning/fireside) */}
      {SPEAKER_SESSION_TYPES.includes(formType) && (
        <div className="space-y-1.5">
          <Label>Speaker</Label>
          <Select value={formSpeakerId} onValueChange={(v) => setFormSpeakerId(v ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder="Select speaker..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {speakers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <span className="flex items-center gap-2">
                    <span>{s.name}</span>
                    {s.company && (
                      <span className="text-muted-foreground text-xs">
                        ({s.company})
                      </span>
                    )}
                    {s.stage === "confirmed" ? (
                      <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0">
                        confirmed
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0">
                        {s.stage}
                      </Badge>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Panel speakers (multi-select) */}
      {PANEL_SESSION_TYPES.includes(formType) && (
        <div className="space-y-1.5">
          <Label>Panelists</Label>
          <div className="space-y-1 rounded-md border border-stone-200 p-2 max-h-40 overflow-y-auto">
            {speakers.length === 0 && (
              <p className="text-xs text-muted-foreground py-1">No speakers available</p>
            )}
            {speakers.map((s) => (
              <label key={s.id} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-stone-50 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={formPanelSpeakerIds.includes(s.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFormPanelSpeakerIds((prev) => [...prev, s.id]);
                    } else {
                      setFormPanelSpeakerIds((prev) => prev.filter((id) => id !== s.id));
                    }
                  }}
                  className="rounded border-stone-300"
                />
                <span>{s.name}</span>
                {s.company && (
                  <span className="text-xs text-muted-foreground">({s.company})</span>
                )}
                {s.stage !== "confirmed" && (
                  <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0">
                    {s.stage}
                  </Badge>
                )}
              </label>
            ))}
          </div>
          {formPanelSpeakerIds.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {formPanelSpeakerIds.length} panelist{formPanelSpeakerIds.length !== 1 ? "s" : ""} selected
            </p>
          )}
        </div>
      )}

      {/* Host (for opening/closing) */}
      {HOST_SESSION_TYPES.includes(formType) && (
        <div className="space-y-1.5">
          <Label>Host</Label>
          <Select value={formHostId} onValueChange={(v) => setFormHostId(v ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder="Select host..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {teamMembers.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Track */}
      <div className="space-y-1.5">
        <Label>Track</Label>
        <Select value={formTrackId} onValueChange={(v) => setFormTrackId(v ?? "")}>
          <SelectTrigger>
            <SelectValue placeholder="Select track..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">No track</SelectItem>
            {tracks.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                <span className="flex items-center gap-2">
                  {t.color && (
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: t.color }}
                    />
                  )}
                  {t.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Day, Start Time, Duration */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Day</Label>
          <Select value={String(formDay)} onValueChange={(v) => setFormDay(Number(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => (
                <SelectItem key={d} value={String(d)}>
                  Day {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Start</Label>
          <Input
            type="time"
            value={formStartTime}
            onChange={(e) => setFormStartTime(e.target.value)}
            step={900}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Duration</Label>
          <Select value={String(formDuration)} onValueChange={(v) => setFormDuration(Number(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[15, 20, 25, 30, 45, 60, 90, 120, 180].map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d} min
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Computed end time */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span>
          {formStartTime} — {computedEndTime} ({formDuration} min)
        </span>
      </div>

      {/* Room */}
      <div className="space-y-1.5">
        <Label>Room (optional)</Label>
        <Input
          value={formRoom}
          onChange={(e) => setFormRoom(e.target.value)}
          placeholder="e.g., Main Stage"
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label>Description (optional)</Label>
        <Textarea
          value={formDescription}
          onChange={(e) => setFormDescription(e.target.value)}
          placeholder="Session description..."
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-stone-200">
        {editingSession ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => handleDelete(editingSession)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Delete
          </Button>
        ) : (
          <div />
        )}
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? "Saving..." : editingSession ? "Update Session" : "Add Session"}
        </Button>
      </div>
    </div>
  );

  // ── Empty state ──
  if (sessions.length === 0 && tracks.length === 0) {
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
              Add tracks in Settings, then create your first session.
            </p>
            <Button onClick={() => openAddDrawer()}>
              <Plus className="mr-2 h-4 w-4" /> Add Session
            </Button>
          </CardContent>
        </Card>

        <EntityDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title="Add Session"
          sections={[{ label: "Details", content: drawerContent }]}
        />
      </div>
    );
  }

  // ── Determine display tracks ──
  // If no tracks exist, create a virtual "All Sessions" column
  const displayTracks: Track[] =
    tracks.length > 0
      ? tracks
      : [{ id: "__all__", name: "All Sessions", color: null, sortOrder: 0 }];

  // ── Assign sessions to track columns ──
  const getSessionsForTrack = (trackId: string) => {
    return daySessions.filter((s) => {
      if (trackId === "__all__") return true;
      return s.trackId === trackId;
    });
  };

  return (
    <div>
      {/* ── Header ── */}
      <div className="mb-4 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Agenda
          </h1>
          <p className="text-sm text-muted-foreground">
            {editionName} — Day {selectedDay}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Gap config */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Gap:</span>
            {gapLocked ? (
              <>
                <Badge variant="secondary" className="font-mono text-xs">
                  {gapMinutes} min
                </Badge>
                <button
                  onClick={() => setGapLocked(false)}
                  className="p-1 rounded text-stone-400 hover:text-stone-600 hover:bg-stone-100"
                  aria-label="Unlock gap setting"
                >
                  <Lock className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <>
                <Input
                  type="number"
                  min={0}
                  max={60}
                  value={gapMinutes}
                  onChange={(e) => setGapMinutes(Number(e.target.value))}
                  className="h-7 w-16 text-xs"
                />
                <span className="text-muted-foreground">min</span>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleGapSave}>
                  Save
                </Button>
                <button
                  onClick={() => {
                    setGapMinutes(initialGapMinutes);
                    setGapLocked(true);
                  }}
                  className="p-1 rounded text-stone-400 hover:text-stone-600 hover:bg-stone-100"
                  aria-label="Cancel gap edit"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>

          {/* Event hours */}
          <Badge variant="secondary" className="font-mono text-xs">
            {agendaStartTime} — {agendaEndTime}
          </Badge>

          {/* Conflict badge */}
          {totalIssues > 0 && (
            <button
              onClick={() => setShowConflicts(!showConflicts)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                errorCount > 0
                  ? "bg-red-100 text-red-700 hover:bg-red-200"
                  : "bg-amber-100 text-amber-700 hover:bg-amber-200"
              )}
            >
              <AlertTriangle className="h-3 w-3" />
              {totalIssues} issue{totalIssues !== 1 ? "s" : ""}
              {showConflicts ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
          )}

          {/* Agenda status */}
          <Badge
            variant="secondary"
            className={cn(
              "text-xs",
              agendaStatus === "draft"
                ? "bg-yellow-50 text-yellow-700 border-yellow-300"
                : "bg-emerald-50 text-emerald-700 border-emerald-300"
            )}
          >
            {agendaStatus === "draft" ? "DRAFT" : "PUBLISHED"}
          </Badge>

          {/* Add session button */}
          <Button size="sm" onClick={() => openAddDrawer()}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Session
          </Button>
        </div>
      </div>

      {/* ── Conflict panel ── */}
      {showConflicts && issues.length > 0 && (
        <Card className="mb-4 border-amber-200 bg-amber-50/50">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Agenda Issues ({errorCount} error{errorCount !== 1 ? "s" : ""}, {warningCount} warning{warningCount !== 1 ? "s" : ""})
              </h3>
              <button
                onClick={() => setShowConflicts(false)}
                className="p-1 rounded text-stone-400 hover:text-stone-600 hover:bg-stone-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {issues.map((issue, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-2 rounded px-2.5 py-1.5 text-xs",
                    issue.severity === "error"
                      ? "bg-red-100/80 text-red-800"
                      : "bg-amber-100/80 text-amber-800"
                  )}
                >
                  {issue.severity === "error" ? (
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  )}
                  <span>{issue.message}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Day tabs ── */}
      <div className="flex gap-2 mb-4" role="tablist" aria-label="Event days">
        {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => (
          <Button
            key={day}
            variant={selectedDay === day ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedDay(day)}
            role="tab"
            aria-selected={selectedDay === day}
            aria-controls={`day-${day}-panel`}
          >
            Day {day}
          </Button>
        ))}
      </div>

      {/* ── Time Grid ── */}
      <div
        id={`day-${selectedDay}-panel`}
        role="tabpanel"
        aria-label={`Day ${selectedDay} schedule`}
        className="rounded-lg border border-stone-200 bg-white overflow-x-auto"
        ref={gridRef}
      >
        {/* Track headers */}
        <div
          className="flex border-b border-stone-200 sticky top-0 z-10 bg-white"
          style={{ minWidth: `${TIME_COL_WIDTH + displayTracks.length * MIN_TRACK_WIDTH}px` }}
        >
          {/* Time column header */}
          <div
            className="shrink-0 border-r border-stone-200 px-2 py-2.5 text-xs font-medium text-muted-foreground"
            style={{ width: TIME_COL_WIDTH }}
          >
            Time
          </div>
          {/* Track column headers */}
          {displayTracks.map((track) => (
            <div
              key={track.id}
              className="flex-1 border-r border-stone-100 last:border-r-0 px-3 py-2.5 text-xs font-medium truncate"
              style={{ minWidth: MIN_TRACK_WIDTH }}
            >
              <span className="flex items-center gap-1.5">
                {track.color && (
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: track.color }}
                  />
                )}
                {track.name}
              </span>
            </div>
          ))}
        </div>

        {/* Grid body */}
        <div
          className="flex relative"
          style={{ minWidth: `${TIME_COL_WIDTH + displayTracks.length * MIN_TRACK_WIDTH}px` }}
        >
          {/* Time labels column */}
          <div className="shrink-0 border-r border-stone-200" style={{ width: TIME_COL_WIDTH }}>
            {timeSlots.map((slot, i) => (
              <div
                key={slot}
                className={cn(
                  "flex items-start justify-end pr-2 text-[11px] font-mono text-muted-foreground select-none",
                  i % 4 === 0 ? "font-medium text-stone-600" : ""
                )}
                style={{ height: SLOT_HEIGHT }}
              >
                <span className="-mt-1.5">{slot}</span>
              </div>
            ))}
          </div>

          {/* Track columns */}
          {displayTracks.map((track) => {
            const trackSessions = getSessionsForTrack(track.id);

            return (
              <div
                key={track.id}
                className="flex-1 relative border-r border-stone-100 last:border-r-0"
                style={{
                  minWidth: MIN_TRACK_WIDTH,
                  height: timeSlots.length * SLOT_HEIGHT,
                }}
              >
                {/* Grid lines (slot backgrounds) */}
                {timeSlots.map((slot, slotIndex) => (
                  <div
                    key={slot}
                    className={cn(
                      "absolute left-0 right-0 border-b",
                      slotIndex % 4 === 3
                        ? "border-stone-200"
                        : "border-stone-100 border-dashed",
                      dropTarget?.trackId === track.id &&
                        dropTarget?.slotIndex === slotIndex &&
                        "bg-sky-50 border-sky-300 border-dashed border-2"
                    )}
                    style={{
                      top: slotIndex * SLOT_HEIGHT,
                      height: SLOT_HEIGHT,
                    }}
                    onDragOver={(e) => handleDragOver(e, track.id, slotIndex)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, track.id, slotIndex)}
                    onClick={() => openAddDrawer(track.id, slot)}
                    role="button"
                    aria-label={`Add session at ${slot} in ${track.name}`}
                    tabIndex={0}
                  />
                ))}

                {/* Session cards */}
                {trackSessions.map((session) => {
                  const pos = getSessionPosition(session);
                  if (!pos) return null;

                  const sessionIssues = sessionIssueMap.get(session.id) || [];
                  const hasError = sessionIssues.some((i) => i.severity === "error");
                  const isUnconfirmed =
                    session.speaker && session.speaker.stage !== "confirmed";
                  const isDragging = dragSessionId === session.id;

                  const startDate = toDate(session.startTime);
                  const endDate = toDate(session.endTime);
                  const startStr = startDate
                    ? formatHHMM(minutesSinceMidnight(startDate))
                    : "--:--";
                  const endStr = endDate
                    ? formatHHMM(minutesSinceMidnight(endDate))
                    : "--:--";

                  return (
                    <div
                      key={session.id}
                      className={cn(
                        "absolute left-1 right-1 rounded-md border px-2 py-1.5 cursor-pointer transition-shadow",
                        "hover:shadow-md hover:z-20 overflow-hidden group",
                        typeColors[session.type] || "bg-white border-stone-200",
                        hasError && "!border-red-400 ring-1 ring-red-300",
                        !hasError && isUnconfirmed && "!border-amber-400 ring-1 ring-amber-300",
                        isDragging && "opacity-40"
                      )}
                      style={{
                        top: pos.top + 1,
                        height: pos.height - 2,
                        zIndex: 10,
                      }}
                      draggable
                      onDragStart={(e) => handleDragStart(e, session.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditDrawer(session);
                      }}
                      role="button"
                      aria-label={`${session.title}, ${startStr} to ${endStr}`}
                      tabIndex={0}
                    >
                      {/* Drag handle */}
                      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-60 transition-opacity">
                        <GripVertical className="h-3 w-3 text-stone-400" />
                      </div>

                      {/* Content */}
                      <div className="flex flex-col h-full min-h-0">
                        {/* Title + type badge */}
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="font-medium text-xs truncate leading-tight">
                            {session.title}
                          </span>
                        </div>

                        {/* Speaker */}
                        {session.speaker && (
                          <div className="flex items-center gap-1 mt-0.5 min-w-0">
                            {session.speaker.headshotUrl && (
                              <img
                                src={session.speaker.headshotUrl}
                                alt=""
                                className="h-3.5 w-3.5 rounded-full object-cover shrink-0"
                              />
                            )}
                            <span className="text-[10px] text-stone-600 truncate">
                              {session.speaker.name}
                            </span>
                          </div>
                        )}

                        {/* Meta row (only if enough height) */}
                        {pos.height >= SLOT_HEIGHT * 1.5 && (
                          <div className="flex items-center gap-1 mt-auto pt-0.5">
                            <span
                              className={cn(
                                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0 text-[9px] font-medium",
                                typeBadgeColors[session.type] || "bg-stone-100 text-stone-600"
                              )}
                            >
                              {typeIcons[session.type]}
                              {session.type}
                            </span>
                            <span className="text-[10px] text-stone-400 font-mono">
                              {startStr}–{endStr}
                            </span>
                          </div>
                        )}

                        {/* Warning badges */}
                        {isUnconfirmed && pos.height >= SLOT_HEIGHT && (
                          <div className="mt-0.5">
                            <span className="inline-flex items-center gap-0.5 rounded px-1 py-0 text-[9px] font-medium bg-amber-200 text-amber-800">
                              <AlertTriangle className="h-2.5 w-2.5" />
                              NOT CONFIRMED
                            </span>
                          </div>
                        )}

                        {hasError && pos.height >= SLOT_HEIGHT && (
                          <div className="mt-0.5">
                            <span className="inline-flex items-center gap-0.5 rounded px-1 py-0 text-[9px] font-medium bg-red-200 text-red-800">
                              <AlertCircle className="h-2.5 w-2.5" />
                              OVERLAP
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Unscheduled sessions ── */}
      {(() => {
        const unscheduled = daySessions.filter((s) => !s.startTime);
        if (unscheduled.length === 0) return null;
        return (
          <div className="mt-4">
            <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
              Unscheduled ({unscheduled.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {unscheduled.map((session) => (
                <div
                  key={session.id}
                  className={cn(
                    "rounded-md border px-3 py-2 cursor-pointer hover:shadow-sm transition-shadow",
                    typeColors[session.type] || "bg-white border-stone-200"
                  )}
                  draggable
                  onDragStart={(e) => handleDragStart(e, session.id)}
                  onClick={() => openEditDrawer(session)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Unscheduled: ${session.title}`}
                >
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-3 w-3 text-stone-400" />
                    <span className="text-xs font-medium">{session.title}</span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium",
                        typeBadgeColors[session.type]
                      )}
                    >
                      {session.type}
                    </span>
                  </div>
                  {session.speaker && (
                    <p className="text-[10px] text-stone-500 mt-0.5 ml-5">
                      {session.speaker.name}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Session drawer ── */}
      <EntityDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingSession ? "Edit Session" : "Add Session"}
        subtitle={
          editingSession
            ? `${editingSession.title} — ${editingSession.type}`
            : "Create a new session"
        }
        sections={[{ label: "Details", content: drawerContent }]}
      />
    </div>
  );
}
