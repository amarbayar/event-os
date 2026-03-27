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
import { Building2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { validateRequired, validateEmail, getApiError } from "@/lib/validation";
import { PortalInviteSection } from "@/components/portal-invite-section";

type Sponsor = {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  packagePreference: string | null;
  message: string | null;
  status: string;
  source: string;
  stage: string;
  assignedTo: string | null;
  logoUrl: string | null;
  createdAt: Date;
};

export function SponsorsClient({ initialSponsors }: { initialSponsors: Sponsor[] }) {
  const t = useTranslations("Sponsors");
  const tP = useTranslations("Pipeline");
  const tE = useTranslations("Entity");
  const tC = useTranslations("Common");
  const { source, stage, setSource, setStage, filter } = usePipelineFilters();
  const [sponsors, setSponsors] = useState(initialSponsors);
  const [showForm, setShowForm] = useState(false);
  const [selectedSponsor, setSelectedSponsor] = useState<Sponsor | null>(null);
  const [drawerSaving, setDrawerSaving] = useState(false);
  const [drawerForm, setDrawerForm] = useState<Record<string, string | null>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filtered = filter(sponsors);

  const refreshData = useCallback(() => { window.location.reload(); }, []);

  const openDrawer = (sponsor: Sponsor) => {
    setSelectedSponsor(sponsor);
    setDrawerForm({
      companyName: sponsor.companyName || "",
      contactName: sponsor.contactName || "",
      contactEmail: sponsor.contactEmail || "",
      packagePreference: sponsor.packagePreference || "gold",
      message: sponsor.message || "",
      source: sponsor.source || "intake",
      stage: sponsor.stage || "lead",
      assignedTo: sponsor.assignedTo || "",
      logoUrl: sponsor.logoUrl || "",
    });
  };

  const updateField = (field: string, value: string | null) => {
    setDrawerForm((prev) => ({ ...prev, [field]: value || "" }));
  };

  const handleDrawerSave = async () => {
    if (!selectedSponsor) return;
    setDrawerSaving(true);
    const res = await fetch(`/api/sponsors/${selectedSponsor.id}`, {
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

    const newErrors = validateRequired(data, ["companyName"]);
    const emailErr = validateEmail(data.contactEmail, "Contact email");
    if (emailErr) newErrors.contactEmail = emailErr;
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});

    const res = await fetch("/api/sponsors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      toast.error(await getApiError(res, tC("failedTo", { action: t("addSponsor").toLowerCase() })));
      return;
    }

    setShowForm(false);
    refreshData();
  };

  const columns = [
    {
      key: "companyName",
      label: tE("company"),
      width: "180px",
      render: (s: Sponsor) => <p className="font-medium text-sm">{s.companyName}</p>,
    },
    {
      key: "contact",
      label: tC("contact"),
      width: "140px",
      render: (s: Sponsor) => (
        <div>
          <p className="text-xs">{s.contactName || "—"}</p>
          <p className="text-[10px] text-muted-foreground">{s.contactEmail || ""}</p>
        </div>
      ),
    },
    {
      key: "package",
      label: t("package"),
      width: "90px",
      render: (s: Sponsor) => <span className="text-xs capitalize">{s.packagePreference || "—"}</span>,
    },
  ];

  const drawerSections = selectedSponsor
    ? [
        {
          label: tE("company"),
          content: (
            <div className="space-y-3">
              <FileUpload
                value={(drawerForm.logoUrl as string) || ""}
                onChange={(url) => updateField("logoUrl", url)}
                folder="sponsor-logos"
                label={tE("logo")}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{tE("company")}</Label>
                  <Input value={(drawerForm.companyName as string) || ""} onChange={(e) => updateField("companyName", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("package")}</Label>
                  <Select value={String(drawerForm.packagePreference || "gold")} onValueChange={(v) => updateField("packagePreference", v)}>
                    <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="platinum">{t("platinum")}</SelectItem>
                      <SelectItem value="gold">{t("gold")}</SelectItem>
                      <SelectItem value="silver">{t("silver")}</SelectItem>
                      <SelectItem value="bronze">{t("bronze")}</SelectItem>
                      <SelectItem value="community">{t("community")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{tE("contactName")}</Label>
                  <Input value={(drawerForm.contactName as string) || ""} onChange={(e) => updateField("contactName", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{tE("contactEmail")}</Label>
                  <Input value={(drawerForm.contactEmail as string) || ""} onChange={(e) => updateField("contactEmail", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{tE("notes")}</Label>
                <Textarea rows={4} placeholder={t("notesPlaceholder")} value={(drawerForm.message as string) || ""} onChange={(e) => updateField("message", e.target.value)} />
              </div>

              {/* Portal Invite — only for confirmed sponsors with email */}
              {selectedSponsor?.stage === "confirmed" && selectedSponsor?.contactEmail && (
                <PortalInviteSection entityType="sponsor" entityId={selectedSponsor.id} entityEmail={selectedSponsor.contactEmail} />
              )}
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
        // Checklist tab (only for confirmed sponsors)
        ...(selectedSponsor?.stage === "confirmed"
          ? [
              {
                label: tE("tabChecklist"),
                content: (
                  <ChecklistPanel entityType="sponsor" entityId={selectedSponsor.id} />
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
          <p className="text-sm text-muted-foreground">{tC("total", { count: sponsors.length })}</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? <><X className="mr-2 h-3 w-3" /> {tC("cancel")}</> : <><Plus className="mr-2 h-3 w-3" /> {t("addSponsor")}</>}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t("companyNameLabel")}</Label>
                  <Input name="companyName" placeholder="e.g., Khan Bank" aria-invalid={!!errors.companyName} onChange={() => setErrors((prev) => { const { companyName: _, ...rest } = prev; return rest; })} />
                  {errors.companyName && <p className="text-xs text-destructive">{errors.companyName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>{tE("contactName")}</Label>
                  <Input name="contactName" placeholder="e.g., Bat-Erdene D." />
                </div>
                <div className="space-y-1.5">
                  <Label>{tE("contactEmail")}</Label>
                  <Input name="contactEmail" type="email" placeholder="events@company.mn" aria-invalid={!!errors.contactEmail} onChange={() => setErrors((prev) => { const { contactEmail: _, ...rest } = prev; return rest; })} />
                  {errors.contactEmail && <p className="text-xs text-destructive">{errors.contactEmail}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>{t("package")}</Label>
                  <Select name="packagePreference" defaultValue="gold">
                    <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="platinum">{t("platinum")}</SelectItem>
                      <SelectItem value="gold">{t("gold")}</SelectItem>
                      <SelectItem value="silver">{t("silver")}</SelectItem>
                      <SelectItem value="bronze">{t("bronze")}</SelectItem>
                      <SelectItem value="community">{t("community")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="w-full sm:w-auto">{t("addSponsor")}</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <PipelineFilters
        items={sponsors}
        sources={["all", "intake", "outreach"]}
        activeSource={source}
        activeStage={stage}
        onSourceChange={setSource}
        onStageChange={setStage}
      />

      {sponsors.length === 0 && !showForm ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Building2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-1">{tC("noYet", { entity: t("title").toLowerCase() })}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t("emptyDescription")}</p>
            <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> {t("addSponsor")}</Button>
          </CardContent>
        </Card>
      ) : (
        <PipelineTable
          items={filtered}
          columns={columns}
          entityName="sponsor"
          apiEndpoint="/api/sponsors"
          onUpdate={refreshData}
          onRowClick={(sponsor) => openDrawer(sponsor)}
        />
      )}

      {filtered.length === 0 && sponsors.length > 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">{tC("noMatch", { entity: t("title").toLowerCase() })}</p>
      )}

      <EntityDrawer
        key={selectedSponsor?.id || "closed"}
        isOpen={!!selectedSponsor}
        onClose={() => setSelectedSponsor(null)}
        title={selectedSponsor?.companyName || ""}
        subtitle={selectedSponsor?.contactName || ""}
        sections={drawerSections}
        onSave={handleDrawerSave}
        saving={drawerSaving}
      />
    </div>
  );
}
