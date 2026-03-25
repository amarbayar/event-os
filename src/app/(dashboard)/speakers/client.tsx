"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { FileUpload } from "@/components/file-upload";
import { ChecklistPanel } from "@/components/checklist-panel";
import { AssignedToSelect } from "@/components/assigned-to-select";
import { Mic2, Copy, Check, ExternalLink, Plus, X, Calendar, Clock, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { validateRequired, validateEmail, getApiError } from "@/lib/validation";

type Speaker = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  talkTitle: string;
  talkAbstract: string | null;
  talkType: string | null;
  company: string | null;
  title: string | null;
  bio: string | null;
  headshotUrl: string | null;
  linkedin: string | null;
  website: string | null;
  slideUrl: string | null;
  requirements: string[] | null;
  requirementsNotes: string | null;
  status: string;
  reviewScore: number | null;
  reviewNotes: string | null;
  source: string;
  stage: string;
  assignedTo: string | null;
  trackPreference: string | null;
  createdAt: Date;
};

type Track = { id: string; name: string };
type SessionSlot = {
  id: string;
  title: string;
  speakerId: string | null;
  day: number;
  startTime: string | null;
  endTime: string | null;
  trackName: string | null;
};

const REQUIREMENT_OPTIONS = [
  "Podium", "Projector", "Demo setup", "Wireless mic", "Lapel mic",
  "Hand-held mic", "USB-C adapter", "HDMI adapter", "Whiteboard",
  "Internet access", "Clicker/pointer", "Audio playback",
];

// ─── Portal Invite Section (on Profile tab) ─────────────

function PortalInviteSection({ entityType, entityId, entityEmail }: { entityType: string; entityId: string; entityEmail: string }) {
  const [status, setStatus] = useState<"checking" | "idle" | "loading" | "invited" | "already" | "error">("checking");
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState("");
  const [inviteInfo, setInviteInfo] = useState<{ email: string; password: string } | null>(null);

  // Check if already invited on mount
  useEffect(() => {
    fetch(`/api/portal/status?entityType=${entityType}&entityId=${entityId}`)
      .then((r) => r.json())
      .then((d) => { setStatus(d.data?.invited ? "already" : "idle"); })
      .catch(() => setStatus("idle"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInvite = async () => {
    setStatus("loading");
    const res = await fetch("/api/portal/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType, entityId }),
    });
    const data = await res.json();
    if (res.ok) {
      if (data.data.alreadyInvited) {
        setStatus("already");
      } else {
        setInviteInfo({ email: entityEmail, password: data.data.tempPassword || password });
        setStatus("invited");
      }
    } else {
      setStatus("error");
    }
    setShowConfirm(false);
  };

  return (
    <div className="pt-4 border-t space-y-2">
      <Label className="text-xs text-muted-foreground uppercase tracking-wider">Stakeholder Portal</Label>

      {status === "already" && (
        <div className="rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-700">
          Already invited — {entityEmail} has portal access.
          <Button size="sm" variant="outline" className="h-6 text-[10px] ml-2" onClick={() => { setStatus("idle"); setShowConfirm(true); }}>
            Resend invite
          </Button>
        </div>
      )}

      {status === "invited" && inviteInfo && (
        <div className="rounded-md bg-emerald-50 px-3 py-2 space-y-1">
          <p className="text-xs font-medium text-emerald-800">Portal invite created!</p>
          <p className="text-xs text-emerald-700">Email: {inviteInfo.email}</p>
          <p className="text-xs text-emerald-700">Password: {inviteInfo.password}</p>
          <p className="text-xs text-emerald-600">Share these credentials with the speaker.</p>
        </div>
      )}

      {status === "error" && (
        <p className="text-xs text-red-600">Failed to create invite. The email may already be in use.</p>
      )}

      {showConfirm && (
        <div className="rounded-md border p-3 space-y-2">
          <p className="text-xs text-stone-600">
            This will create a portal login for <strong>{entityEmail}</strong> where they can self-service their checklist items and update their profile.
          </p>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={handleInvite} disabled={status === "loading"}>
              {status === "loading" ? "Inviting..." : "Confirm Invite"}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowConfirm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {status === "idle" && !showConfirm && (
        <Button size="sm" className="w-full" onClick={() => setShowConfirm(true)}>
          <UserPlus className="mr-2 h-3 w-3" /> Invite to Portal
        </Button>
      )}
    </div>
  );
}

export function SpeakersClient({
  initialSpeakers,
  tracks,
  sessions,
}: {
  initialSpeakers: Speaker[];
  tracks: Track[];
  sessions: SessionSlot[];
}) {
  const { source, stage, setSource, setStage, filter } = usePipelineFilters();
  const [speakers, setSpeakers] = useState(initialSpeakers);
  const [copied, setCopied] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedSpeaker, setSelectedSpeaker] = useState<Speaker | null>(null);
  const [drawerSaving, setDrawerSaving] = useState(false);
  const [drawerForm, setDrawerForm] = useState<Record<string, string | string[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filtered = filter(speakers);

  const handleCopyCfp = () => {
    navigator.clipboard.writeText(`${window.location.origin}/apply/dev-summit-2026`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const refreshData = useCallback(() => {
    window.location.reload();
  }, []);

  // Drawer
  const openDrawer = (speaker: Speaker) => {
    setSelectedSpeaker(speaker);
    setDrawerForm({
      name: speaker.name || "",
      email: speaker.email || "",
      phone: speaker.phone || "",
      company: speaker.company || "",
      title: speaker.title || "",
      bio: speaker.bio || "",
      headshotUrl: speaker.headshotUrl || "",
      linkedin: speaker.linkedin || "",
      website: speaker.website || "",
      talkTitle: speaker.talkTitle || "",
      talkAbstract: speaker.talkAbstract || "",
      talkType: speaker.talkType || "talk",
      trackPreference: speaker.trackPreference || "",
      slideUrl: speaker.slideUrl || "",
      requirements: speaker.requirements || [],
      requirementsNotes: speaker.requirementsNotes || "",
      source: speaker.source || "intake",
      stage: speaker.stage || "lead",
      assignedTo: speaker.assignedTo || "",
      reviewNotes: speaker.reviewNotes || "",
    });
  };

  const updateField = (field: string, value: string | string[] | null) => {
    setDrawerForm((prev) => ({ ...prev, [field]: value || "" }));
  };

  const toggleRequirement = (req: string) => {
    const current = (drawerForm.requirements as string[]) || [];
    const updated = current.includes(req)
      ? current.filter((r) => r !== req)
      : [...current, req];
    updateField("requirements", updated);
  };

  const handleDrawerSave = async () => {
    if (!selectedSpeaker) return;
    setDrawerSaving(true);
    const res = await fetch(`/api/speakers/${selectedSpeaker.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "If-Match": "999" },
      body: JSON.stringify(drawerForm),
    });
    if (!res.ok) {
      toast.error(await getApiError(res, "Failed to save changes"));
      setDrawerSaving(false);
      return;
    }
    setDrawerSaving(false);
    refreshData();
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = Object.fromEntries(form);

    const newErrors = validateRequired(data, ["name"]);
    const emailErr = validateEmail(data.email, "Email");
    if (emailErr) newErrors.email = emailErr;
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});

    const res = await fetch("/api/speakers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      toast.error(await getApiError(res, "Failed to add speaker"));
      return;
    }

    setShowForm(false);
    refreshData();
  };

  // Find assigned session for a speaker
  const getAssignedSession = (speakerId: string) =>
    sessions.find((s) => s.speakerId === speakerId);

  const columns = [
    {
      key: "name",
      label: "Speaker",
      width: "200px",
      render: (s: Speaker) => (
        <div>
          <p className="font-medium text-sm">{s.name}</p>
          <p className="text-xs text-muted-foreground">{s.email || "No email"}</p>
        </div>
      ),
    },
    {
      key: "company",
      label: "Company",
      width: "140px",
      render: (s: Speaker) => (
        <span className="text-xs text-muted-foreground">{s.company || "—"}</span>
      ),
    },
    {
      key: "talk",
      label: "Talk",
      render: (s: Speaker) => (
        <div>
          <p className="text-xs">{s.talkTitle || "TBD"}</p>
          {s.trackPreference && (
            <p className="text-[10px] text-muted-foreground">{s.trackPreference}</p>
          )}
        </div>
      ),
    },
    {
      key: "score",
      label: "Score",
      width: "60px",
      render: (s: Speaker) => (
        <span className="text-xs tabular-nums font-medium">
          {s.reviewScore ? (s.reviewScore / 10).toFixed(1) : "—"}
        </span>
      ),
    },
  ];

  // Drawer sections
  const speakerSession = selectedSpeaker ? getAssignedSession(selectedSpeaker.id) : null;

  const drawerSections = selectedSpeaker
    ? [
        {
          label: "Profile",
          content: (
            <div className="space-y-4">
              {/* Photo + Name header — profile card style */}
              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  <FileUpload
                    value={(drawerForm.headshotUrl as string) || ""}
                    onChange={(url) => updateField("headshotUrl", url)}
                    folder="headshots"
                    label="Photo"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="space-y-1">
                    <Input value={(drawerForm.name as string) || ""} onChange={(e) => updateField("name", e.target.value)} className="text-lg font-medium h-9" placeholder="Full name" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={(drawerForm.title as string) || ""} onChange={(e) => updateField("title", e.target.value)} placeholder="Job title" className="text-xs h-8" />
                    <Input value={(drawerForm.company as string) || ""} onChange={(e) => updateField("company", e.target.value)} placeholder="Company" className="text-xs h-8" />
                  </div>
                </div>
              </div>

              {/* Contact info */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Contact</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Input value={(drawerForm.email as string) || ""} onChange={(e) => updateField("email", e.target.value)} placeholder="Email" />
                  <Input value={(drawerForm.phone as string) || ""} onChange={(e) => updateField("phone", e.target.value)} placeholder="Phone" />
                  <Input value={(drawerForm.linkedin as string) || ""} onChange={(e) => updateField("linkedin", e.target.value)} placeholder="LinkedIn URL" />
                  <Input value={(drawerForm.website as string) || ""} onChange={(e) => updateField("website", e.target.value)} placeholder="Website URL" />
                </div>
              </div>

              {/* Bio */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Bio</Label>
                <Textarea rows={4} placeholder="Speaker bio for the event website..." value={(drawerForm.bio as string) || ""} onChange={(e) => updateField("bio", e.target.value)} />
              </div>

              {/* Portal Invite — only for confirmed speakers with email */}
              {selectedSpeaker?.stage === "confirmed" && selectedSpeaker?.email && (
                <PortalInviteSection entityType="speaker" entityId={selectedSpeaker.id} entityEmail={selectedSpeaker.email} />
              )}
            </div>
          ),
        },
        {
          label: "Talk",
          content: (
            <div className="space-y-3">
              {/* Track + Type first */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Track</Label>
                  <Select value={String(drawerForm.trackPreference || "")} onValueChange={(v) => updateField("trackPreference", v)}>
                    <SelectTrigger><SelectValue className="capitalize" placeholder="Select track" /></SelectTrigger>
                    <SelectContent>
                      {tracks.map((t) => (
                        <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={String(drawerForm.talkType || "talk")} onValueChange={(v) => updateField("talkType", v)}>
                    <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="talk">Talk</SelectItem>
                      <SelectItem value="keynote">Keynote</SelectItem>
                      <SelectItem value="workshop">Workshop</SelectItem>
                      <SelectItem value="panel">Panel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Topic */}
              <div className="space-y-1.5">
                <Label>Topic / Title</Label>
                <Input value={(drawerForm.talkTitle as string) || ""} onChange={(e) => updateField("talkTitle", e.target.value)} />
              </div>
              {/* Abstract */}
              <div className="space-y-1.5">
                <Label>Abstract</Label>
                <Textarea rows={5} placeholder="Talk abstract..." value={(drawerForm.talkAbstract as string) || ""} onChange={(e) => updateField("talkAbstract", e.target.value)} />
              </div>
              {/* Slides */}
              <div className="space-y-1.5">
                <Label>Slide Link</Label>
                <Input value={(drawerForm.slideUrl as string) || ""} onChange={(e) => updateField("slideUrl", e.target.value)} placeholder="https://docs.google.com/presentation/..." />
              </div>

              {/* Assigned session */}
              {speakerSession ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-xs font-medium text-emerald-700 mb-1">Assigned Session</p>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Day {speakerSession.day}</span>
                    {speakerSession.startTime && (
                      <>
                        <Clock className="h-3.5 w-3.5 text-emerald-600" />
                        <span>
                          {new Date(speakerSession.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
                          {speakerSession.endTime && ` — ${new Date(speakerSession.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}`}
                        </span>
                      </>
                    )}
                    {speakerSession.trackName && (
                      <Badge variant="outline" className="text-[10px]">{speakerSession.trackName}</Badge>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No session assigned yet. Assign in the Agenda page.</p>
              )}
            </div>
          ),
        },
        {
          label: "Requirements",
          content: (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">AV and logistics requirements for this speaker.</p>
              <div className="grid grid-cols-2 gap-2">
                {REQUIREMENT_OPTIONS.map((req) => (
                  <label key={req} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-stone-50 rounded px-2 py-1">
                    <input
                      type="checkbox"
                      className="rounded border-stone-300"
                      checked={((drawerForm.requirements as string[]) || []).includes(req)}
                      onChange={() => toggleRequirement(req)}
                    />
                    <span>{req}</span>
                  </label>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label>Other Requirements</Label>
                <Textarea rows={3} placeholder="Anything not covered above — special setup, dietary needs, accessibility requirements..." value={(drawerForm.requirementsNotes as string) || ""} onChange={(e) => updateField("requirementsNotes", e.target.value)} />
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
                    <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="intake">Intake</SelectItem>
                      <SelectItem value="outreach">Outreach</SelectItem>
                      <SelectItem value="sponsored">Sponsored</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Stage</Label>
                  <Select value={String(drawerForm.stage || "lead")} onValueChange={(v) => updateField("stage", v)}>
                    <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
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
                <AssignedToSelect value={(drawerForm.assignedTo as string) || ""} onChange={(val) => updateField("assignedTo", val)} />
              </div>
              <div className="space-y-1.5">
                <Label>Review Notes</Label>
                <Textarea rows={4} placeholder="Internal notes..." value={(drawerForm.reviewNotes as string) || ""} onChange={(e) => updateField("reviewNotes", e.target.value)} />
              </div>
            </div>
          ),
        },
        // Checklist tab (only for confirmed speakers)
        ...(selectedSpeaker?.stage === "confirmed"
          ? [
              {
                label: "Checklist",
                content: (
                  <ChecklistPanel entityType="speaker" entityId={selectedSpeaker.id} />
                ),
              },
            ]
          : []),
      ]
    : [];

  return (
    <div>
      <div className="mb-6 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Speakers</h1>
          <p className="text-sm text-muted-foreground">{speakers.length} total</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyCfp}>
            {copied ? <><Check className="mr-2 h-3 w-3" /> Copied</> : <><ExternalLink className="mr-2 h-3 w-3" /> CFP Link</>}
          </Button>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? <><X className="mr-2 h-3 w-3" /> Cancel</> : <><Plus className="mr-2 h-3 w-3" /> Add Speaker</>}
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input name="name" placeholder="e.g., Batbold T." aria-invalid={!!errors.name} onChange={() => setErrors((prev) => { const { name: _, ...rest } = prev; return rest; })} />
                  {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input name="email" type="email" placeholder="batbold@example.com" aria-invalid={!!errors.email} onChange={() => setErrors((prev) => { const { email: _, ...rest } = prev; return rest; })} />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Company</Label>
                  <Input name="company" placeholder="DataMN" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Talk Title</Label>
                  <Input name="talkTitle" placeholder="TBD" />
                </div>
                <div className="space-y-1.5">
                  <Label>Source</Label>
                  <Select name="source" defaultValue="outreach">
                    <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="intake">Intake (CFP)</SelectItem>
                      <SelectItem value="outreach">Outreach</SelectItem>
                      <SelectItem value="sponsored">Sponsored</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Assigned To</Label>
                  <AssignedToSelect name="assignedTo" />
                </div>
              </div>
              <Button type="submit" className="w-full sm:w-auto">Add Speaker</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <PipelineFilters
        items={speakers}
        sources={["all", "intake", "outreach", "sponsored"]}
        activeSource={source}
        activeStage={stage}
        onSourceChange={setSource}
        onStageChange={setStage}
      />

      {speakers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Mic2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-1">No speakers yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Share your CFP link or add speakers via the agent chat.</p>
            <Button onClick={handleCopyCfp}><Copy className="mr-2 h-4 w-4" /> Copy CFP Link</Button>
          </CardContent>
        </Card>
      ) : (
        <PipelineTable
          items={filtered}
          columns={columns}
          entityName="speaker"
          apiEndpoint="/api/speakers"
          onUpdate={refreshData}
          onRowClick={(speaker) => openDrawer(speaker)}
        />
      )}

      {filtered.length === 0 && speakers.length > 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">No speakers match the current filters.</p>
      )}

      <EntityDrawer
        key={selectedSpeaker?.id || "closed"}
        isOpen={!!selectedSpeaker}
        onClose={() => setSelectedSpeaker(null)}
        title={selectedSpeaker?.name || ""}
        subtitle={selectedSpeaker?.company || selectedSpeaker?.email || ""}
        sections={drawerSections}
        onSave={handleDrawerSave}
        saving={drawerSaving}
      />
    </div>
  );
}
