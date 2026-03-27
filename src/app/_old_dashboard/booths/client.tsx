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
import { validateRequired, getApiError } from "@/lib/validation";
import { PortalInviteSection } from "@/components/portal-invite-section";
import { useTranslations } from "next-intl";

type Booth = {
  id: string;
  name: string;
  companyName: string | null;
  contactName: string | null;
  contactEmail: string | null;
  location: string | null;
  size: string | null;
  price: number | null;
  status: string;
  equipment: string | null;
  notes: string | null;
  sponsorId: string | null;
  source: string;
  stage: string;
  companyLogoUrl: string | null;
  assignedTo: string | null;
};

export function BoothsClient({ initialBooths }: { initialBooths: Booth[] }) {
  const { source, stage, setSource, setStage, filter } = usePipelineFilters();
  const [booths, setBooths] = useState(initialBooths);
  const [showForm, setShowForm] = useState(false);
  const [selectedBooth, setSelectedBooth] = useState<Booth | null>(null);
  const [drawerSaving, setDrawerSaving] = useState(false);
  const [drawerForm, setDrawerForm] = useState<Record<string, string | null>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const t = useTranslations("Booths");
  const tP = useTranslations("Pipeline");
  const tE = useTranslations("Entity");
  const tC = useTranslations("Common");

  const filtered = filter(booths);

  const columns = [
    {
      key: "name",
      label: tE("name"),
      width: "140px",
      render: (b: Booth) => (
        <p className="font-medium text-sm">{b.name}</p>
      ),
    },
    {
      key: "location",
      label: t("location"),
      width: "140px",
      render: (b: Booth) => (
        <span className="text-xs text-muted-foreground">{b.location || "—"}</span>
      ),
    },
    {
      key: "size",
      label: t("size"),
      width: "90px",
      render: (b: Booth) => (
        <span className="text-xs capitalize">{b.size || "—"}</span>
      ),
    },
    {
      key: "equipment",
      label: t("equipment"),
      render: (b: Booth) => (
        <span className="text-xs text-muted-foreground">{b.equipment || "—"}</span>
      ),
    },
    {
      key: "status",
      label: t("status"),
      width: "90px",
      render: (b: Booth) => (
        <span className="text-xs">{b.status}</span>
      ),
    },
  ];

  // Refresh data without full page reload
  const refreshData = useCallback(async () => {
    const res = await fetch("/api/booths");
    if (res.ok) {
      const json = await res.json();
      if (json.data) setBooths(json.data);
    } else {
      window.location.reload();
    }
  }, []);

  const openDrawer = (booth: Booth) => {
    setSelectedBooth(booth);
    setDrawerForm({
      name: booth.name || "",
      companyName: booth.companyName || "",
      contactName: booth.contactName || "",
      contactEmail: booth.contactEmail || "",
      companyLogoUrl: booth.companyLogoUrl || "",
      location: booth.location || "",
      size: booth.size || "standard",
      equipment: booth.equipment || "",
      notes: booth.notes || "",
      source: booth.source || "intake",
      stage: booth.stage || "lead",
      assignedTo: booth.assignedTo || "",
    });
  };

  const updateField = (field: string, value: string | null) => {
    setDrawerForm((prev) => ({ ...prev, [field]: value || "" }));
  };

  const handleDrawerSave = async () => {
    if (!selectedBooth) return;
    setDrawerSaving(true);
    const res = await fetch(`/api/booths/${selectedBooth.id}`, {
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
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});

    const res = await fetch("/api/booths", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      toast.error(await getApiError(res, tC("failedTo", { action: t("addBooth").toLowerCase() })));
      return;
    }

    const json = await res.json();
    setBooths((prev) => [json.data, ...prev]);
    setShowForm(false);
  };

  const drawerSections = selectedBooth
    ? [
        {
          label: t("booth"),
          content: (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>{t("boothName")}</Label>
                <Input value={(drawerForm.name as string) || ""} onChange={(e) => updateField("name", e.target.value)} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{tE("company")}</Label>
                  <Input value={(drawerForm.companyName as string) || ""} onChange={(e) => updateField("companyName", e.target.value)} placeholder={t("companyPlaceholder")} />
                </div>
                <div className="space-y-1.5">
                  <Label>{tE("contactName")}</Label>
                  <Input value={(drawerForm.contactName as string) || ""} onChange={(e) => updateField("contactName", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{tE("contactEmail")}</Label>
                <Input type="email" value={(drawerForm.contactEmail as string) || ""} onChange={(e) => updateField("contactEmail", e.target.value)} placeholder={t("portalPlaceholder")} />
              </div>
              <FileUpload
                value={(drawerForm.companyLogoUrl as string) || ""}
                onChange={(url) => updateField("companyLogoUrl", url)}
                folder="booth-logos"
                label={tE("logo")}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t("location")}</Label>
                  <Input value={(drawerForm.location as string) || ""} onChange={(e) => updateField("location", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t("size")}</Label>
                <Select value={String(drawerForm.size || "standard")} onValueChange={(v) => updateField("size", v)}>
                  <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">{t("sizeSmall")}</SelectItem>
                    <SelectItem value="standard">{t("sizeStandard")}</SelectItem>
                    <SelectItem value="premium">{t("sizePremium")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("equipment")}</Label>
                <Textarea rows={4} placeholder={t("equipmentPlaceholder")} value={(drawerForm.equipment as string) || ""} onChange={(e) => updateField("equipment", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{tE("notes")}</Label>
                <Textarea rows={4} placeholder={t("notesPlaceholder")} value={(drawerForm.notes as string) || ""} onChange={(e) => updateField("notes", e.target.value)} />
              </div>

              {/* Portal Invite — only for confirmed booths with email */}
              {selectedBooth?.stage === "confirmed" && selectedBooth?.contactEmail && (
                <PortalInviteSection entityType="booth" entityId={selectedBooth.id} entityEmail={selectedBooth.contactEmail} />
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
        // Checklist tab (only for confirmed booths)
        ...(selectedBooth?.stage === "confirmed"
          ? [
              {
                label: tE("tabChecklist"),
                content: (
                  <ChecklistPanel entityType="booth" entityId={selectedBooth.id} />
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
          <p className="text-sm text-muted-foreground">{tC("total", { count: booths.length })}</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? <><X className="mr-2 h-3 w-3" /> {tC("cancel")}</> : <><Plus className="mr-2 h-3 w-3" /> {t("addBooth")}</>}
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t("nameLabel")}</Label>
                  <Input name="name" placeholder="e.g., Booth A1" aria-invalid={!!errors.name} onChange={() => setErrors((prev) => { const { name: _, ...rest } = prev; return rest; })} />
                  {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>{t("location")}</Label>
                  <Input name="location" placeholder="e.g., Hall B, Row 3" />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("size")}</Label>
                  <Select name="size" defaultValue="standard">
                    <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">{t("sizeSmall")}</SelectItem>
                      <SelectItem value="standard">{t("sizeStandard")}</SelectItem>
                      <SelectItem value="premium">{t("sizePremium")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("equipment")}</Label>
                  <Input name="equipment" placeholder="e.g., Table, chairs, power strip" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>{tP("source")}</Label>
                  <Select name="source" defaultValue="outreach">
                    <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="intake">{tP("sourceIntake")}</SelectItem>
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
              <div className="space-y-1.5">
                <Label>{tE("notes")}</Label>
                <Textarea name="notes" placeholder="Any additional notes about this booth..." rows={2} />
              </div>
              <Button type="submit" className="w-full sm:w-auto">{t("addBooth")}</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Pipeline filters */}
      <PipelineFilters
        items={booths}
        sources={["all", "intake", "outreach", "sponsored"]}
        activeSource={source}
        activeStage={stage}
        onSourceChange={setSource}
        onStageChange={setStage}
      />

      {/* Table view */}
      <PipelineTable
        items={filtered}
        columns={columns}
        entityName="booth"
        apiEndpoint="/api/booths"
        onUpdate={refreshData}
        onRowClick={(booth) => openDrawer(booth)}
      />

      {filtered.length === 0 && booths.length > 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">{tC("noMatch", { entity: t("title").toLowerCase() })}</p>
      )}

      <EntityDrawer
        key={selectedBooth?.id || "closed"}
        isOpen={!!selectedBooth}
        onClose={() => setSelectedBooth(null)}
        title={selectedBooth?.name || ""}
        subtitle={selectedBooth?.location || ""}
        sections={drawerSections}
        onSave={handleDrawerSave}
        saving={drawerSaving}
      />
    </div>
  );
}
