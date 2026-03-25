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
import { FileUpload } from "@/components/file-upload";
import { ChecklistPanel } from "@/components/checklist-panel";
import { AssignedToSelect } from "@/components/assigned-to-select";
import { Building2, Plus, X, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { validateRequired, validateEmail, getApiError } from "@/lib/validation";

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

// ─── Portal Invite Section (on Profile tab) ─────────────

function PortalInviteSection({ entityType, entityId, entityEmail }: { entityType: string; entityId: string; entityEmail: string }) {
  const [status, setStatus] = useState<"checking" | "idle" | "loading" | "invited" | "already" | "error">("checking");
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState("");
  const [inviteInfo, setInviteInfo] = useState<{ email: string; password: string } | null>(null);

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
      if (data.data.alreadyInvited) setStatus("already");
      else { setInviteInfo({ email: entityEmail, password: data.data.tempPassword || password }); setStatus("invited"); }
    } else setStatus("error");
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
          <p className="text-xs text-emerald-600">Share these credentials with them.</p>
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

export function SponsorsClient({ initialSponsors }: { initialSponsors: Sponsor[] }) {
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
      toast.error(await getApiError(res, "Failed to create sponsor"));
      return;
    }

    setShowForm(false);
    refreshData();
  };

  const columns = [
    {
      key: "companyName",
      label: "Company",
      width: "180px",
      render: (s: Sponsor) => <p className="font-medium text-sm">{s.companyName}</p>,
    },
    {
      key: "contact",
      label: "Contact",
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
      label: "Package",
      width: "90px",
      render: (s: Sponsor) => <span className="text-xs capitalize">{s.packagePreference || "—"}</span>,
    },
  ];

  const drawerSections = selectedSponsor
    ? [
        {
          label: "Company",
          content: (
            <div className="space-y-3">
              <FileUpload
                value={(drawerForm.logoUrl as string) || ""}
                onChange={(url) => updateField("logoUrl", url)}
                folder="sponsor-logos"
                label="Company Logo"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Company Name</Label>
                  <Input value={(drawerForm.companyName as string) || ""} onChange={(e) => updateField("companyName", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Package</Label>
                  <Select value={String(drawerForm.packagePreference || "gold")} onValueChange={(v) => updateField("packagePreference", v)}>
                    <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="platinum">Platinum</SelectItem>
                      <SelectItem value="gold">Gold</SelectItem>
                      <SelectItem value="silver">Silver</SelectItem>
                      <SelectItem value="bronze">Bronze</SelectItem>
                      <SelectItem value="community">Community</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Contact Name</Label>
                  <Input value={(drawerForm.contactName as string) || ""} onChange={(e) => updateField("contactName", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact Email</Label>
                  <Input value={(drawerForm.contactEmail as string) || ""} onChange={(e) => updateField("contactEmail", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea rows={4} placeholder="Sponsorship notes, negotiations, deliverables..." value={(drawerForm.message as string) || ""} onChange={(e) => updateField("message", e.target.value)} />
              </div>

              {/* Portal Invite — only for confirmed sponsors with email */}
              {selectedSponsor?.stage === "confirmed" && selectedSponsor?.contactEmail && (
                <PortalInviteSection entityType="sponsor" entityId={selectedSponsor.id} entityEmail={selectedSponsor.contactEmail} />
              )}
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
            </div>
          ),
        },
        // Checklist tab (only for confirmed sponsors)
        ...(selectedSponsor?.stage === "confirmed"
          ? [
              {
                label: "Checklist",
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
          <h1 className="font-heading text-2xl font-bold tracking-tight">Sponsors</h1>
          <p className="text-sm text-muted-foreground">{sponsors.length} total</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? <><X className="mr-2 h-3 w-3" /> Cancel</> : <><Plus className="mr-2 h-3 w-3" /> Add Sponsor</>}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Company Name *</Label>
                  <Input name="companyName" placeholder="e.g., Khan Bank" aria-invalid={!!errors.companyName} onChange={() => setErrors((prev) => { const { companyName: _, ...rest } = prev; return rest; })} />
                  {errors.companyName && <p className="text-xs text-destructive">{errors.companyName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Contact Name</Label>
                  <Input name="contactName" placeholder="e.g., Bat-Erdene D." />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact Email</Label>
                  <Input name="contactEmail" type="email" placeholder="events@company.mn" aria-invalid={!!errors.contactEmail} onChange={() => setErrors((prev) => { const { contactEmail: _, ...rest } = prev; return rest; })} />
                  {errors.contactEmail && <p className="text-xs text-destructive">{errors.contactEmail}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Package</Label>
                  <Select name="packagePreference" defaultValue="gold">
                    <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="platinum">Platinum</SelectItem>
                      <SelectItem value="gold">Gold</SelectItem>
                      <SelectItem value="silver">Silver</SelectItem>
                      <SelectItem value="bronze">Bronze</SelectItem>
                      <SelectItem value="community">Community</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="w-full sm:w-auto">Create Sponsor</Button>
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
            <h3 className="text-lg font-medium mb-1">No sponsors yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Add sponsors or paste info into agent chat.</p>
            <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> Add Sponsor</Button>
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
        <p className="text-center text-sm text-muted-foreground py-8">No sponsors match filters.</p>
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
