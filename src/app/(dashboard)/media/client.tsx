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
import { Plus, X, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { validateRequired, validateEmail, getApiError } from "@/lib/validation";

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

export function MediaClient({ initialPartners }: { initialPartners: MediaPartner[] }) {
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
      label: "Company",
      width: "160px",
      render: (p: MediaPartner) => (
        <p className="font-medium text-sm">{p.companyName}</p>
      ),
    },
    {
      key: "contactName",
      label: "Contact",
      width: "140px",
      render: (p: MediaPartner) => (
        <span className="text-xs text-muted-foreground">{p.contactName || "—"}</span>
      ),
    },
    {
      key: "contactEmail",
      label: "Email",
      width: "180px",
      render: (p: MediaPartner) => (
        <span className="text-xs text-muted-foreground">{p.contactEmail || "—"}</span>
      ),
    },
    {
      key: "type",
      label: "Type",
      width: "80px",
      render: (p: MediaPartner) => (
        <span className="text-xs capitalize">{p.type || "—"}</span>
      ),
    },
    {
      key: "reach",
      label: "Reach",
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
      toast.error(await getApiError(res, "Failed to create media partner"));
      return;
    }

    const json = await res.json();
    setPartners((prev) => [json.data, ...prev]);
    setShowForm(false);
  };

  const drawerSections = selectedPartner
    ? [
        {
          label: "Partner",
          content: (
            <div className="space-y-3">
              <FileUpload
                value={(drawerForm.logoUrl as string) || ""}
                onChange={(url) => updateField("logoUrl", url)}
                folder="media-logos"
                label="Company Logo"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Company Name</Label>
                  <Input value={(drawerForm.companyName as string) || ""} onChange={(e) => updateField("companyName", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact Name</Label>
                  <Input value={(drawerForm.contactName as string) || ""} onChange={(e) => updateField("contactName", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Contact Email</Label>
                  <Input value={(drawerForm.contactEmail as string) || ""} onChange={(e) => updateField("contactEmail", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={String(drawerForm.type || "online")} onValueChange={(v) => updateField("type", v)}>
                    <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tv">TV</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="print">Print</SelectItem>
                      <SelectItem value="podcast">Podcast</SelectItem>
                      <SelectItem value="blog">Blog</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Reach</Label>
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
          label: "Deliverables",
          content: (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Proposal</Label>
                <Textarea rows={4} placeholder="Coverage plan or partnership proposal..." value={(drawerForm.proposal as string) || ""} onChange={(e) => updateField("proposal", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Deliverables</Label>
                <Textarea rows={4} placeholder="What we provide to them..." value={(drawerForm.deliverables as string) || ""} onChange={(e) => updateField("deliverables", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea rows={4} placeholder="Additional notes..." value={(drawerForm.notes as string) || ""} onChange={(e) => updateField("notes", e.target.value)} />
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
        // Checklist tab (only for confirmed media partners)
        ...(selectedPartner?.stage === "confirmed"
          ? [
              {
                label: "Checklist",
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
          <h1 className="font-heading text-2xl font-bold tracking-tight">Media Partners</h1>
          <p className="text-sm text-muted-foreground">{partners.length} total</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? <><X className="mr-2 h-3 w-3" /> Cancel</> : <><Plus className="mr-2 h-3 w-3" /> Add Partner</>}
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Company Name *</Label>
                  <Input name="companyName" placeholder="e.g., Eagle News" aria-invalid={!!errors.companyName} onChange={() => setErrors((prev) => { const { companyName: _, ...rest } = prev; return rest; })} />
                  {errors.companyName && <p className="text-xs text-destructive">{errors.companyName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Contact Name *</Label>
                  <Input name="contactName" placeholder="e.g., Oyunaa B." aria-invalid={!!errors.contactName} onChange={() => setErrors((prev) => { const { contactName: _, ...rest } = prev; return rest; })} />
                  {errors.contactName && <p className="text-xs text-destructive">{errors.contactName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Contact Email *</Label>
                  <Input name="contactEmail" type="email" placeholder="press@media.mn" aria-invalid={!!errors.contactEmail} onChange={() => setErrors((prev) => { const { contactEmail: _, ...rest } = prev; return rest; })} />
                  {errors.contactEmail && <p className="text-xs text-destructive">{errors.contactEmail}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select name="type" defaultValue="online">
                    <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tv">TV</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="print">Print</SelectItem>
                      <SelectItem value="podcast">Podcast</SelectItem>
                      <SelectItem value="blog">Blog</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Reach</Label>
                  <Input name="reach" placeholder="e.g., 50K monthly readers" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Source</Label>
                  <Select name="source" defaultValue="outreach">
                    <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="intake">Intake</SelectItem>
                      <SelectItem value="outreach">Outreach</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Assigned To</Label>
                  <AssignedToSelect name="assignedTo" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Proposal</Label>
                <Textarea name="proposal" placeholder="Coverage plan or partnership proposal..." rows={2} />
              </div>
              <Button type="submit" className="w-full sm:w-auto">Create Media Partner</Button>
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
        <p className="text-center text-sm text-muted-foreground py-8">No media partners match the current filters.</p>
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
