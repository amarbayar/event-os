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
import { Plus, X } from "lucide-react";

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
  const { source, stage, setSource, setStage, filter } = usePipelineFilters();
  const [partners, setPartners] = useState(initialPartners);
  const [showForm, setShowForm] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<MediaPartner | null>(null);
  const [drawerSaving, setDrawerSaving] = useState(false);
  const [drawerForm, setDrawerForm] = useState<Record<string, string | null>>({});

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
    });
  };

  const updateField = (field: string, value: string | null) => {
    setDrawerForm((prev) => ({ ...prev, [field]: value || "" }));
  };

  const handleDrawerSave = async () => {
    if (!selectedPartner) return;
    setDrawerSaving(true);
    await fetch(`/api/media-partners/${selectedPartner.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "If-Match": "999" },
      body: JSON.stringify(drawerForm),
    });
    setDrawerSaving(false);
    setSelectedPartner(null);
    refreshData();
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = Object.fromEntries(form);

    const res = await fetch("/api/media-partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      const json = await res.json();
      setPartners((prev) => [json.data, ...prev]);
      setShowForm(false);
    }
  };

  const drawerSections = selectedPartner
    ? [
        {
          label: "Partner",
          content: (
            <div className="space-y-3">
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
                    <SelectTrigger><SelectValue /></SelectTrigger>
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
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="intake">Intake</SelectItem>
                      <SelectItem value="outreach">Outreach</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Stage</Label>
                  <Select value={String(drawerForm.stage || "lead")} onValueChange={(v) => updateField("stage", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
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
                <Input value={(drawerForm.assignedTo as string) || ""} onChange={(e) => updateField("assignedTo", e.target.value)} />
              </div>
            </div>
          ),
        },
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
                  <Input name="companyName" placeholder="e.g., Eagle News" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact Name *</Label>
                  <Input name="contactName" placeholder="e.g., Oyunaa B." required />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact Email *</Label>
                  <Input name="contactEmail" type="email" placeholder="press@media.mn" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select name="type" defaultValue="online">
                    <SelectTrigger><SelectValue /></SelectTrigger>
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
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="intake">Intake</SelectItem>
                      <SelectItem value="outreach">Outreach</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Assigned To</Label>
                  <Input name="assignedTo" placeholder="Team member name" />
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
