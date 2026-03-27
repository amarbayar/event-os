"use client";

import { useState, useCallback } from "react";
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
import { PortalInviteSection } from "@/components/portal-invite-section";
import { Mic2, Copy, Check, ExternalLink, Plus, X, Calendar, Clock } from "lucide-react";
import { useTranslations } from "next-intl";
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

const REQUIREMENT_KEYS = [
  "reqPodium", "reqProjector", "reqDemoSetup", "reqWirelessMic", "reqLapelMic",
  "reqHandheldMic", "reqUsbcAdapter", "reqHdmiAdapter", "reqWhiteboard",
  "reqInternet", "reqClicker", "reqAudioPlayback",
];

export function SpeakersClient({
  initialSpeakers,
  tracks,
  sessions,
}: {
  initialSpeakers: Speaker[];
  tracks: Track[];
  sessions: SessionSlot[];
}) {
  const t = useTranslations("Speakers");
  const tP = useTranslations("Pipeline");
  const tE = useTranslations("Entity");
  const tC = useTranslations("Common");
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
    setTimeout(() => setCopied(false), 3000);
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
      toast.error(await getApiError(res, tC("failedTo", { action: tC("save").toLowerCase() })));
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
      toast.error(await getApiError(res, tC("failedTo", { action: t("addSpeaker").toLowerCase() })));
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
      label: t("speaker"),
      width: "200px",
      render: (s: Speaker) => (
        <div>
          <p className="font-medium text-sm">{s.name}</p>
          <p className="text-xs text-muted-foreground">{s.email || t("noEmail")}</p>
        </div>
      ),
    },
    {
      key: "company",
      label: tE("company"),
      width: "140px",
      render: (s: Speaker) => (
        <span className="text-xs text-muted-foreground">{s.company || "—"}</span>
      ),
    },
    {
      key: "talk",
      label: t("talk"),
      render: (s: Speaker) => (
        <div>
          <p className="text-xs">{s.talkTitle || t("tbd")}</p>
          {s.trackPreference && (
            <p className="text-[10px] text-muted-foreground">{s.trackPreference}</p>
          )}
        </div>
      ),
    },
    {
      key: "score",
      label: t("score"),
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
          label: tE("tabProfile"),
          content: (
            <div className="space-y-4">
              {/* Photo + Name header — profile card style */}
              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  <FileUpload
                    value={(drawerForm.headshotUrl as string) || ""}
                    onChange={(url) => updateField("headshotUrl", url)}
                    folder="headshots"
                    label={tE("photo")}
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="space-y-1">
                    <Input value={(drawerForm.name as string) || ""} onChange={(e) => updateField("name", e.target.value)} className="text-lg font-medium h-9" placeholder={t("fullName")} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={(drawerForm.title as string) || ""} onChange={(e) => updateField("title", e.target.value)} placeholder={t("jobTitle")} className="text-xs h-8" />
                    <Input value={(drawerForm.company as string) || ""} onChange={(e) => updateField("company", e.target.value)} placeholder={tE("company")} className="text-xs h-8" />
                  </div>
                </div>
              </div>

              {/* Contact info */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">{tC("contact")}</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Input value={(drawerForm.email as string) || ""} onChange={(e) => updateField("email", e.target.value)} placeholder={tE("email")} />
                  <Input value={(drawerForm.phone as string) || ""} onChange={(e) => updateField("phone", e.target.value)} placeholder={tE("phone")} />
                  <Input value={(drawerForm.linkedin as string) || ""} onChange={(e) => updateField("linkedin", e.target.value)} placeholder={tE("linkedinUrl")} />
                  <Input value={(drawerForm.website as string) || ""} onChange={(e) => updateField("website", e.target.value)} placeholder={tE("website")} />
                </div>
              </div>

              {/* Bio */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">{tE("bio")}</Label>
                <Textarea rows={4} placeholder={t("bioPlaceholder")} value={(drawerForm.bio as string) || ""} onChange={(e) => updateField("bio", e.target.value)} />
              </div>

              {/* Portal Invite — only for confirmed speakers with email */}
              {selectedSpeaker?.stage === "confirmed" && selectedSpeaker?.email && (
                <PortalInviteSection entityType="speaker" entityId={selectedSpeaker.id} entityEmail={selectedSpeaker.email} />
              )}
            </div>
          ),
        },
        {
          label: t("talk"),
          content: (
            <div className="space-y-3">
              {/* Track + Type first */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("track")}</Label>
                  <Select value={String(drawerForm.trackPreference || "")} onValueChange={(v) => updateField("trackPreference", v)}>
                    <SelectTrigger><SelectValue className="capitalize" placeholder={t("selectTrack")} /></SelectTrigger>
                    <SelectContent>
                      {tracks.map((tr) => (
                        <SelectItem key={tr.id} value={tr.name}>{tr.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("talkType")}</Label>
                  <Select value={String(drawerForm.talkType || "talk")} onValueChange={(v) => updateField("talkType", v)}>
                    <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="talk">{t("typeTalk")}</SelectItem>
                      <SelectItem value="keynote">{t("typeKeynote")}</SelectItem>
                      <SelectItem value="workshop">{t("typeWorkshop")}</SelectItem>
                      <SelectItem value="panel">{t("typePanel")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Topic */}
              <div className="space-y-1.5">
                <Label>{t("talkTitle")}</Label>
                <Input value={(drawerForm.talkTitle as string) || ""} onChange={(e) => updateField("talkTitle", e.target.value)} />
              </div>
              {/* Abstract */}
              <div className="space-y-1.5">
                <Label>{t("abstract")}</Label>
                <Textarea rows={5} placeholder={t("talkAbstract")} value={(drawerForm.talkAbstract as string) || ""} onChange={(e) => updateField("talkAbstract", e.target.value)} />
              </div>
              {/* Slides */}
              <div className="space-y-1.5">
                <Label>{t("slideLink")}</Label>
                <Input value={(drawerForm.slideUrl as string) || ""} onChange={(e) => updateField("slideUrl", e.target.value)} placeholder="https://docs.google.com/presentation/..." />
              </div>

              {/* Assigned session */}
              {speakerSession ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-xs font-medium text-emerald-700 mb-1">{t("assignedSession")}</p>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{t("day", { day: speakerSession.day })}</span>
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
                <p className="text-xs text-muted-foreground italic">{t("noSessionAssigned")}</p>
              )}
            </div>
          ),
        },
        {
          label: tE("tabRequirements"),
          content: (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t("requirementsDescription")}</p>
              <div className="grid grid-cols-2 gap-2">
                {REQUIREMENT_KEYS.map((reqKey) => (
                  <label key={reqKey} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-stone-50 rounded px-2 py-1">
                    <input
                      type="checkbox"
                      className="rounded border-stone-300"
                      checked={((drawerForm.requirements as string[]) || []).includes(reqKey)}
                      onChange={() => toggleRequirement(reqKey)}
                    />
                    <span>{t(reqKey)}</span>
                  </label>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label>{t("otherRequirements")}</Label>
                <Textarea rows={3} placeholder={t("otherRequirementsPlaceholder")} value={(drawerForm.requirementsNotes as string) || ""} onChange={(e) => updateField("requirementsNotes", e.target.value)} />
              </div>
            </div>
          ),
        },
        {
          label: tE("tabPipeline"),
          content: (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{tP("source")}</Label>
                  <Select value={String(drawerForm.source || "intake")} onValueChange={(v) => updateField("source", v)}>
                    <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="intake">{tP("sourceIntake")}</SelectItem>
                      <SelectItem value="outreach">{tP("sourceOutreach")}</SelectItem>
                      <SelectItem value="sponsored">{tP("sourceSponsored")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{tP("stage")}</Label>
                  <Select value={String(drawerForm.stage || "lead")} onValueChange={(v) => updateField("stage", v)}>
                    <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead">{tP("stageLead")}</SelectItem>
                      <SelectItem value="engaged">{tP("stageEngaged")}</SelectItem>
                      <SelectItem value="confirmed">{tP("stageConfirmed")}</SelectItem>
                      <SelectItem value="declined">{tP("stageDeclined")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{tP("assignedTo")}</Label>
                <AssignedToSelect value={(drawerForm.assignedTo as string) || ""} onChange={(val) => updateField("assignedTo", val)} />
              </div>
              <div className="space-y-1.5">
                <Label>{tC("reviewNotes")}</Label>
                <Textarea rows={4} placeholder={tC("internalNotes")} value={(drawerForm.reviewNotes as string) || ""} onChange={(e) => updateField("reviewNotes", e.target.value)} />
              </div>
            </div>
          ),
        },
        // Checklist tab (only for confirmed speakers)
        ...(selectedSpeaker?.stage === "confirmed"
          ? [
              {
                label: tE("tabChecklist"),
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
          <h1 className="font-heading text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{tC("total", { count: speakers.length })}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyCfp}>
            {copied ? <><Check className="mr-2 h-3 w-3" /> {tC("copied")}</> : <><ExternalLink className="mr-2 h-3 w-3" /> {t("cfpLink")}</>}
          </Button>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? <><X className="mr-2 h-3 w-3" /> {tC("cancel")}</> : <><Plus className="mr-2 h-3 w-3" /> {t("addSpeaker")}</>}
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>{t("nameLabel")}</Label>
                  <Input name="name" placeholder="e.g., Batbold T." aria-invalid={!!errors.name} onChange={() => setErrors((prev) => { const { name: _, ...rest } = prev; return rest; })} />
                  {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>{tE("email")}</Label>
                  <Input name="email" type="email" placeholder="batbold@example.com" aria-invalid={!!errors.email} onChange={() => setErrors((prev) => { const { email: _, ...rest } = prev; return rest; })} />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>{tE("company")}</Label>
                  <Input name="company" placeholder="DataMN" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>{t("talkTitleLabel")}</Label>
                  <Input name="talkTitle" placeholder="TBD" />
                </div>
                <div className="space-y-1.5">
                  <Label>{tP("source")}</Label>
                  <Select name="source" defaultValue="outreach">
                    <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="intake">{t("intakeCfp")}</SelectItem>
                      <SelectItem value="outreach">{tP("sourceOutreach")}</SelectItem>
                      <SelectItem value="sponsored">{tP("sourceSponsored")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{tP("assignedTo")}</Label>
                  <AssignedToSelect name="assignedTo" />
                </div>
              </div>
              <Button type="submit" className="w-full sm:w-auto">{t("addSpeaker")}</Button>
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
            <h3 className="text-lg font-medium mb-1">{tC("noYet", { entity: t("title").toLowerCase() })}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t("emptyDescription")}</p>
            <Button onClick={handleCopyCfp}><Copy className="mr-2 h-4 w-4" /> {t("copyCfpLink")}</Button>
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
        <p className="text-center text-sm text-muted-foreground py-8">{tC("noMatch", { entity: t("title").toLowerCase() })}</p>
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
