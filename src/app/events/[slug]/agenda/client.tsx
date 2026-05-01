/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
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
import {
  agendaTimeLabel,
  agendaTimestamp,
  formatHHMM,
  minutesSinceMidnight,
  parseHHMM,
  toAgendaDate,
} from "@/lib/agenda-time";
import {
  HOST_SESSION_TYPES,
  PANEL_SESSION_TYPES,
  SESSION_TYPES,
  SPEAKER_SESSION_TYPES,
  type SessionType,
} from "@/lib/session-types";

// ─── Types ──────────────────────────────────────────────

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

const TIME_COL_WIDTH = 96; // px
const MIN_AGENDA_WIDTH = 760; // px

const typeColors: Record<SessionType, string> = {
  keynote: "border-amber-200 bg-gradient-to-br from-amber-50 via-white to-yellow-50",
  talk: "border-sky-200 bg-gradient-to-br from-sky-50 via-white to-cyan-50",
  workshop: "border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50",
  panel: "border-violet-200 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50",
  lightning: "border-rose-200 bg-gradient-to-br from-rose-50 via-white to-orange-50",
  fireside: "border-orange-200 bg-gradient-to-br from-orange-50 via-white to-amber-50",
  opening: "border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-sky-50",
  closing: "border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-sky-50",
  break: "border-stone-200 bg-gradient-to-br from-stone-50 via-white to-slate-50 border-dashed",
  coffee: "border-stone-200 bg-gradient-to-br from-stone-50 via-white to-slate-50 border-dashed",
  lunch: "border-stone-200 bg-gradient-to-br from-stone-50 via-white to-slate-50 border-dashed",
  networking: "border-stone-200 bg-gradient-to-br from-stone-50 via-white to-slate-50 border-dashed",
};

const typeBadgeColors: Record<SessionType, string> = {
  keynote: "bg-amber-500 text-white shadow-sm shadow-amber-500/20",
  talk: "bg-sky-600 text-white shadow-sm shadow-sky-600/20",
  workshop: "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20",
  panel: "bg-violet-600 text-white shadow-sm shadow-violet-600/20",
  lightning: "bg-rose-500 text-white shadow-sm shadow-rose-500/20",
  fireside: "bg-orange-500 text-white shadow-sm shadow-orange-500/20",
  opening: "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20",
  closing: "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20",
  break: "bg-stone-100 text-stone-600",
  coffee: "bg-stone-100 text-stone-600",
  lunch: "bg-stone-100 text-stone-600",
  networking: "bg-stone-100 text-stone-600",
};

const typeAccentColors: Record<SessionType, string> = {
  keynote: "#f59e0b",
  talk: "#0284c7",
  workshop: "#059669",
  panel: "#7c3aed",
  lightning: "#f43f5e",
  fireside: "#f97316",
  opening: "#4f46e5",
  closing: "#4f46e5",
  break: "#78716c",
  coffee: "#78716c",
  lunch: "#78716c",
  networking: "#78716c",
};

const typeIcons: Partial<Record<SessionType, React.ReactNode>> = {
  panel: <Users className="h-3 w-3" />,
  keynote: <Mic className="h-3 w-3" />,
  coffee: <Coffee className="h-3 w-3" />,
  lunch: <Utensils className="h-3 w-3" />,
};

// ─── Component Props ────────────────────────────────────

type AgendaClientProps = {
  initialSessions: Session[];
  tracks: Track[];
  eventSlug: string;
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
  eventSlug,
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
  const [dragSessionId, setDragSessionId] = useState<string | null>(null);
  const [dropTargetSessionId, setDropTargetSessionId] = useState<string | null>(null);
  const [swapping, setSwapping] = useState(false);

  const { confirm } = useConfirm();
  const gridRef = useRef<HTMLDivElement>(null);

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

  const trackMap = useMemo(
    () => new Map(tracks.map((track) => [track.id, track])),
    [tracks]
  );

  const selectedSpeakerLabel = useMemo(() => {
    if (!formSpeakerId) return "None";
    const speaker = speakers.find((s) => s.id === formSpeakerId);
    return speaker ? `${speaker.name}${speaker.company ? ` (${speaker.company})` : ""}` : "Select speaker...";
  }, [formSpeakerId, speakers]);

  const selectedHostLabel = useMemo(() => {
    if (!formHostId) return "None";
    return teamMembers.find((m) => m.id === formHostId)?.name ?? "Select host...";
  }, [formHostId, teamMembers]);

  const selectedTrackLabel = useMemo(() => {
    if (!formTrackId) return "No track";
    return tracks.find((track) => track.id === formTrackId)?.name ?? "Select track...";
  }, [formTrackId, tracks]);

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

  // ── Sort scheduled sessions chronologically ──
  const scheduledSessions = useMemo(() => {
    return daySessions
      .filter((session) => session.startTime)
      .sort((a, b) => {
        const aStart = toAgendaDate(a.startTime);
        const bStart = toAgendaDate(b.startTime);
        const aMinutes = aStart ? minutesSinceMidnight(aStart) : Number.MAX_SAFE_INTEGER;
        const bMinutes = bStart ? minutesSinceMidnight(bStart) : Number.MAX_SAFE_INTEGER;
        return aMinutes - bMinutes || a.title.localeCompare(b.title);
      });
  }, [daySessions]);

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
    setFormStartTime(agendaTimeLabel(session.startTime) ?? "09:00");
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

  const updateDuration = useCallback((value: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    setFormDuration(Math.min(60, Math.max(1, Math.round(parsed))));
  }, []);

  // ── Save session (create or update) ──
  const handleSave = useCallback(async () => {
    const errors = validateRequired({ title: formTitle }, ["title"]);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    setSaving(true);

    const startISO = agendaTimestamp(formStartTime);
    const endISO = agendaTimestamp(computedEndTime);

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

  // ── Drag-to-swap sessions ──
  const handleSessionDragStart = useCallback((e: React.DragEvent, sessionId: string) => {
    setDragSessionId(sessionId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", sessionId);
  }, []);

  const handleSessionDragEnd = useCallback(() => {
    setDragSessionId(null);
    setDropTargetSessionId(null);
  }, []);

  const handleSessionDragOver = useCallback(
    (e: React.DragEvent, targetId: string) => {
      if (!dragSessionId || dragSessionId === targetId || swapping) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropTargetSessionId(targetId);
    },
    [dragSessionId, swapping]
  );

  const handleSessionDrop = useCallback(
    async (e: React.DragEvent, target: Session) => {
      e.preventDefault();
      const sourceId = e.dataTransfer.getData("text/plain") || dragSessionId;
      setDropTargetSessionId(null);

      if (!sourceId || sourceId === target.id || swapping) return;
      const source = sessions.find((session) => session.id === sourceId);
      if (!source) return;

      setSwapping(true);
      try {
        const res = await fetch("/api/sessions/swap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceId,
            targetId: target.id,
            sourceVersion: source.version,
            targetVersion: target.version,
          }),
        });

        if (!res.ok) {
          toast.error(await getApiError(res, "Failed to swap sessions"));
          return;
        }

        const json = await res.json();
        if (json.issues) setIssues(json.issues);

        toast.success(`Swapped ${source.type} with ${target.type}`);
        await fetchSessions();
        await fetchValidation();
      } catch {
        toast.error("Network error — could not swap sessions");
      } finally {
        setSwapping(false);
        setDragSessionId(null);
        setDropTargetSessionId(null);
      }
    },
    [dragSessionId, fetchSessions, fetchValidation, sessions, swapping]
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
            <SelectTrigger className="w-full">
              <span className="min-w-0 flex-1 truncate text-left">
                {selectedSpeakerLabel}
              </span>
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
            <SelectTrigger className="w-full">
              <span className="min-w-0 flex-1 truncate text-left">
                {selectedHostLabel}
              </span>
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
          <SelectTrigger className="w-full">
            <span className="min-w-0 flex-1 truncate text-left">
              {selectedTrackLabel}
            </span>
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
            step={60}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Duration</Label>
          <Input
            type="number"
            min={1}
            max={60}
            step={1}
            value={formDuration}
            onChange={(e) => updateDuration(e.target.value)}
          />
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
        className="overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50/80 shadow-sm"
        ref={gridRef}
      >
        {tracks.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b border-slate-200/80 bg-white/80 px-3 py-2 backdrop-blur">
            {tracks.map((track) => (
              <span
                key={track.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm"
              >
                {track.color && (
                  <span
                    className="h-2.5 w-2.5 rounded-full shadow-sm"
                    style={{ backgroundColor: track.color }}
                  />
                )}
                {track.name}
              </span>
            ))}
          </div>
        )}

        {/* Schedule header */}
        <div
          className="sticky top-0 z-10 flex border-b border-slate-200/80 bg-white/90 backdrop-blur"
          style={{ minWidth: MIN_AGENDA_WIDTH }}
        >
          <div
            className="shrink-0 border-r border-slate-200 px-2 py-2.5 text-xs font-medium text-muted-foreground"
            style={{ width: TIME_COL_WIDTH }}
          >
            Time
          </div>
          <div className="flex-1 px-3 py-2.5 text-xs font-medium text-muted-foreground">
            Schedule
          </div>
        </div>

        {/* Schedule body */}
        <div className="divide-y divide-slate-100 overflow-x-auto" style={{ minWidth: MIN_AGENDA_WIDTH }}>
          {scheduledSessions.map((session) => {
            const sessionIssues = sessionIssueMap.get(session.id) || [];
            const hasError = sessionIssues.some((i) => i.severity === "error");
            const isUnconfirmed = session.speaker && session.speaker.stage !== "confirmed";
            const track = session.trackId ? trackMap.get(session.trackId) : null;
            const typeAccent = typeAccentColors[session.type] || "#64748b";
            const trackAccent = track?.color || typeAccent;
            const isDragging = dragSessionId === session.id;
            const isDropTarget = dropTargetSessionId === session.id && dragSessionId !== session.id;
            const startStr = agendaTimeLabel(session.startTime) ?? "--:--";
            const endStr = agendaTimeLabel(session.endTime) ?? "--:--";

            return (
              <div key={session.id} className="flex bg-white/70">
                <div
                  className="shrink-0 border-r border-slate-200 px-2 py-3 text-right"
                  style={{ width: TIME_COL_WIDTH }}
                >
                  <div className="font-mono text-xs font-semibold text-slate-800">{startStr}</div>
                  <div className="font-mono text-xs text-slate-500">{endStr}</div>
                  <div className="mt-1 text-[10px] text-slate-400">{session.durationMinutes} min</div>
                </div>
                <div className="flex-1 p-2">
                  <div
                    className={cn(
                      "group relative min-h-[92px] overflow-hidden rounded-lg border px-3 py-2.5 shadow-sm transition-all duration-200",
                      "cursor-grab hover:-translate-y-0.5 hover:shadow-lg active:cursor-grabbing",
                      typeColors[session.type] || "border-stone-200",
                      hasError && "!border-red-400 ring-1 ring-red-300",
                      !hasError && isUnconfirmed && "!border-amber-400 ring-1 ring-amber-300",
                      isDragging && "scale-[0.99] opacity-45",
                      isDropTarget && "ring-2 ring-sky-400 ring-offset-2 ring-offset-slate-50"
                    )}
                    style={{
                      background: `linear-gradient(135deg, color-mix(in srgb, ${trackAccent} 12%, white), white 46%, color-mix(in srgb, ${typeAccent} 12%, white))`,
                      borderLeftColor: trackAccent,
                      borderLeftWidth: 5,
                    }}
                    draggable
                    onDragStart={(e) => handleSessionDragStart(e, session.id)}
                    onDragEnd={handleSessionDragEnd}
                    onDragOver={(e) => handleSessionDragOver(e, session.id)}
                    onDragLeave={() => setDropTargetSessionId(null)}
                    onDrop={(e) => handleSessionDrop(e, session)}
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditDrawer(session);
                    }}
                    role="button"
                    aria-label={`${session.title}, ${startStr} to ${endStr}`}
                    tabIndex={0}
                  >
                    <div
                      className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full opacity-20 blur-2xl transition-opacity duration-300 group-hover:opacity-35"
                      style={{ backgroundColor: typeAccent }}
                    />
                    {isDropTarget && (
                      <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-white/60 backdrop-blur-[1px]">
                        <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white shadow-lg">
                          Drop to swap
                        </span>
                      </div>
                    )}
                    <div className="absolute right-2 top-2 rounded-full border border-slate-200/70 bg-white/80 p-1 text-slate-400 opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                      <GripVertical className="h-3.5 w-3.5" />
                    </div>
                    <div className="relative min-h-[76px] pr-8 md:pr-52">
                      <div className="session-card-main min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {track && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 ring-1 ring-slate-200/80">
                              {track.color && (
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: track.color }}
                                />
                              )}
                              {track.name}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-base font-semibold leading-snug text-slate-950">
                          {session.title}
                        </div>

                        {session.speaker && (
                          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                            {session.speaker.headshotUrl && (
                              <img
                                src={session.speaker.headshotUrl}
                                alt=""
                                className="h-5 w-5 rounded-full object-cover shrink-0"
                              />
                            )}
                            <Link
                              href={`/events/${eventSlug}/speakers?speakerId=${session.speaker.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-sm font-semibold text-sky-800 hover:underline"
                            >
                              {session.speaker.name}
                            </Link>
                            {session.speaker.company && (
                              <span className="text-xs text-stone-500">
                                {session.speaker.company}
                              </span>
                            )}
                          </div>
                        )}

                        {session.description && (
                          <p className="mt-1 line-clamp-2 text-xs leading-snug text-slate-600">
                            {session.description}
                          </p>
                        )}
                      </div>

                      <div className="session-card-meta mt-3 flex flex-wrap items-center gap-2 rounded-md border border-white/70 bg-white/70 p-2 text-left shadow-sm backdrop-blur md:absolute md:right-0 md:top-0 md:mt-0 md:w-44 md:flex-col md:items-end md:text-right">
                        <div className="flex md:justify-end">
                          <span
                            className={cn(
                              "inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide",
                              typeBadgeColors[session.type] || "bg-stone-100 text-stone-600"
                            )}
                          >
                            {typeIcons[session.type]}
                            {session.type}
                          </span>
                        </div>
                        <div className="md:order-2">
                          <div className="font-mono text-sm font-semibold text-slate-900">
                            {startStr}–{endStr}
                          </div>
                          <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                            {session.durationMinutes} min
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 md:order-3 md:justify-end">
                          {session.room && (
                            <span className="rounded bg-white/80 px-1.5 py-0.5 text-[10px] text-stone-600 ring-1 ring-stone-200">
                              {session.room}
                            </span>
                          )}
                          {isUnconfirmed && (
                            <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-medium bg-amber-200 text-amber-800">
                              <AlertTriangle className="h-2.5 w-2.5" />
                              NOT CONFIRMED
                            </span>
                          )}
                          {hasError && (
                            <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-medium bg-red-200 text-red-800">
                              <AlertCircle className="h-2.5 w-2.5" />
                              OVERLAP
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
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
                  onClick={() => openEditDrawer(session)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Unscheduled: ${session.title}`}
                >
                  <div className="flex items-center gap-2">
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
