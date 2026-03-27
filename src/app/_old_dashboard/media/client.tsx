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
import { FileUpload } from "@/components/file-upload";
import { ChecklistPanel } from "@/components/checklist-panel";
import { AssignedToSelect } from "@/components/assigned-to-select";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { validateRequired, validateEmail, getApiError } from "@/lib/validation";
import { PortalInviteSection } from "@/components/portal-invite-section";
import { useTranslations } from "next-intl";

type MediaPartner = {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  type: string | null;
  reach: string | null;
  proposal: string | null;
  deliverables: string | null;
  logoUrl: string | null;
  notes: string | null;
  status: string;
  source: string;
  stage: string;
  assignedTo: string | null;
};

export function MediaClient({ initialPartners }: { initialPartners: MediaPartner[] }) {
  const t = useTranslations("Media");
  const tP = useTranslations("Pipeline");
  const tE = useTranslations("Entity");
  const tC = useTranslations("Common");
  const { source, stage, setSource, setStage, filter } = usePipelineFilters();
  const [partners, setPartners] = useState(initialPartners);
  const [showForm, setShowForm] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<MediaPartner | null>(null);
  const [drawerSaving, setDrawerSaving] = useState(false);
  const [drawerForm, setDrawerForm] = useState<Record<string, string | null>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filtered = filter(partners);

  const columns = [
    {
      key: "companyName",
      label: tE("company"),
      width: "160px",
      render: (p: MediaPartner) => (
        <p className="font-medium text-sm">{p.companyName}</p>
      ),
    },
    {
      key: "contactName",
      label: tC("contact"),
      width: "140px",
      render: (p: MediaPartner) => (
        <span className="text-xs text-muted-foreground">{p.contactName || "—"}</span>
      ),
    },
    {
      key: "contactEmail",
      label: tE("email"),
      width: "180px",
      render: (p: MediaPartner) => (
        <span className="text-xs text-muted-foreground">{p.contactEmail || "—"}</span>
      ),
    },
    {
      key: "type",
      label: tC("type"),
      width: "80px",
      render: (p: MediaPartner) => (
        <span className="text-xs capitalize">{p.type || "—"}</span>
      ),
    },
    {
      key: "reach",
      label: t("reach"),
      width: "140px",
      render: (p: MediaPartner) => (
        <span className="text-xs text-muted-foreground">{p.reach || "—"}</span>
      ),
    },
  ];

  // Refresh data without full page reload
  const refreshData = useCallback(async () => {
    const res = await fetch("/api/media-partners");
    if (res.ok) {
      const json = await res.json();
      if (json.data) setPartners(json.data);
    } else {
      window.location.reload();
    }
  }, []);

  const openDrawer = (partner: MediaPartner) => {
    setSelectedPartner(partner);
    setDrawerForm({
      companyName: partner.companyName || "",
      contactName: partner.contactName || "",
      contactEmail: partner.contactEmail || "",
      type: partner.type || "online",
      reach: partner.reach || "",
      proposal: partner.proposal || "",
      deliverables: partner.deliverables || "",
      notes: partner.notes || "",
      source: partner.source || "intake",
      stage: partner.stage || "lead",
      assignedTo: partner.assignedTo || "",
      logoUrl: partner.logoUrl || "",
    });
  };

  const updateField = (field: string, value: string | null) => {
    setDrawerForm((prev) => ({ ...prev, [field]: value || "" }));
  };

  const handleDrawerSave = async () => {
    if (!selectedPartner) return;
    setDrawerSaving(true);
    const res = await fetch(`/api/media-partners/${selectedPartner.id}`, {
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

    const newErrors = validateRequired(data, ["companyName", "contactName", "contactEmail"]);
    if (!newErrors.contactEmail) {
      const emailErr = validateEmail(data.contactEmail, "Contact email");
      if (emailErr) newErrors.contactEmail = emailErr;
    }
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});

    const res = await fetch("/api/media-partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      toast.error(await getApiError(res, tC("failedTo", { action: t("addMediaPartner").toLowerCase() })));
      return;
    }

    const json = await res.json();
    setPartners((prev) => [json.data, ...prev]);
    setShowForm(false);
  };

  const drawerSections = selectedPartner
    ? [
        {
          label: t("partner"),
          content: (
            <div className="space-y-3">
              <FileUpload
                value={(drawerForm.logoUrl as string) || ""}
                onChange={(url) => updateField("logoUrl", url)}
                folder="media-logos"
                label={tE("logo")}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{tE("company")}</Label>
                  <Input value={(drawerForm.companyName as string) || ""} onChange={(e) => updateField("companyName", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{tE("contactName")}</Label>
                  <Input value={(drawerForm.contactName as string) || ""} onChange={(e) => updateField("contactName", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{tE("contactEmail")}</Label>
                  <Input value={(drawerForm.contactEmail as string) || ""} onChange={(e) => updateField("contactEmail", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{tC("type")}</Label>
                  <Select value={String(drawerForm.type || "online")} onValueChange={(v) => updateField("type", v)}>
                    <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tv">{t("typeTv")}</SelectItem>
                      <SelectItem value="online">{t("typeOnline")}</SelectItem>
                      <SelectItem value="print">{t("typePrint")}</SelectItem>
                      <SelectItem value="podcast">{t("typePodcast")}</SelectItem>
                      <SelectItem value="blog">{t("typeBlog")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t("reach")}</Label>
                <Input value={(drawerForm.reach as string) || ""} onChange={(e) => updateField("reach", e.target.value)} />
              </div>

              {/* Portal Invite — only for confirmed media partners with email */}
              {selectedPartner?.stage === "confirmed" && selectedPartner?.contactEmail && (
                <PortalInviteSection entityType="media" entityId={selectedPartner.id} entityEmail={selectedPartner.contactEmail} />
              )}
            </div>
          ),
        },
        {
          label: tC("deliverables"),
          content: (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>{tC("proposal")}</Label>
                <Textarea rows={4} placeholder={t("proposalPlaceholder")} value={(drawerForm.proposal as string) || ""} onChange={(e) => updateField("proposal", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{tC("deliverables")}</Label>
                <Textarea rows={4} placeholder={t("deliverablesPlaceholder")} value={(drawerForm.deliverables as string) || ""} onChange={(e) => updateField("deliverables", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{tE("notes")}</Label>
                <Textarea rows={4} placeholder={t("notesPlaceholder")} value={(drawerForm.notes as string) || ""} onChange={(e) => updateField("notes", e.target.value)} />
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
            </div>
          ),
        },
        // Checklist tab (only for confirmed media partners)
        ...(selectedPartner?.stage === "confirmed"
          ? [
              {
                label: tE("tabChecklist"),
                content: (
                  <ChecklistPanel entityType="media" entityId={selectedPartner.id} />
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
          <p className="text-sm text-muted-foreground">{tC("total", { count: partners.length })}</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? <><X className="mr-2 h-3 w-3" /> {tC("cancel")}</> : <><Plus className="mr-2 h-3 w-3" /> {t("addPartner")}</>}
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{tE("company")} *</Label>
                  <Input name="companyName" placeholder="e.g., Eagle News" aria-invalid={!!errors.companyName} onChange={() => setErrors((prev) => { const { companyName: _, ...rest } = prev; return rest; })} />
                  {errors.companyName && <p className="text-xs text-destructive">{errors.companyName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>{tE("contactName")} *</Label>
                  <Input name="contactName" placeholder="e.g., Oyunaa B." aria-invalid={!!errors.contactName} onChange={() => setErrors((prev) => { const { contactName: _, ...rest } = prev; return rest; })} />
                  {errors.contactName && <p className="text-xs text-destructive">{errors.contactName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>{tE("contactEmail")} *</Label>
                  <Input name="contactEmail" type="email" placeholder="press@media.mn" aria-invalid={!!errors.contactEmail} onChange={() => setErrors((prev) => { const { contactEmail: _, ...rest } = prev; return rest; })} />
                  {errors.contactEmail && <p className="text-xs text-destructive">{errors.contactEmail}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>{tC("type")}</Label>
                  <Select name="type" defaultValue="online">
                    <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tv">{t("typeTv")}</SelectItem>
                      <SelectItem value="online">{t("typeOnline")}</SelectItem>
                      <SelectItem value="print">{t("typePrint")}</SelectItem>
                      <SelectItem value="podcast">{t("typePodcast")}</SelectItem>
                      <SelectItem value="blog">{t("typeBlog")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("reach")}</Label>
                  <Input name="reach" placeholder="e.g., 50K monthly readers" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{tP("source")}</Label>
                  <Select name="source" defaultValue="outreach">
                    <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="intake">{tP("sourceIntake")}</SelectItem>
                      <SelectItem value="outreach">{tP("sourceOutreach")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{tP("assignedTo")}</Label>
                  <AssignedToSelect name="assignedTo" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{tC("proposal")}</Label>
                <Textarea name="proposal" placeholder={t("proposalPlaceholder")} rows={2} />
              </div>
              <Button type="submit" className="w-full sm:w-auto">{t("addMediaPartner")}</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Pipeline filters */}
      <PipelineFilters
        items={partners}
        sources={["all", "intake", "outreach"]}
        activeSource={source}
        activeStage={stage}
        onSourceChange={setSource}
        onStageChange={setStage}
      />

      {/* Table view */}
      <PipelineTable
        items={filtered}
        columns={columns}
        entityName="media partner"
        apiEndpoint="/api/media-partners"
        onUpdate={refreshData}
        onRowClick={(partner) => openDrawer(partner)}
      />

      {filtered.length === 0 && partners.length > 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">{tC("noMatch", { entity: t("title").toLowerCase() })}</p>
      )}

      <EntityDrawer
        key={selectedPartner?.id || "closed"}
        isOpen={!!selectedPartner}
        onClose={() => setSelectedPartner(null)}
        title={selectedPartner?.companyName || ""}
        subtitle={selectedPartner?.contactName || ""}
        sections={drawerSections}
        onSave={handleDrawerSave}
        saving={drawerSaving}
      />
    </div>
  );
}
