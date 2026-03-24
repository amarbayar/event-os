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
import { Plus, X } from "lucide-react";

type Booth = {
  id: string;
  name: string;
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

  const filtered = filter(booths);

  const columns = [
    {
      key: "name",
      label: "Name",
      width: "140px",
      render: (b: Booth) => (
        <p className="font-medium text-sm">{b.name}</p>
      ),
    },
    {
      key: "location",
      label: "Location",
      width: "140px",
      render: (b: Booth) => (
        <span className="text-xs text-muted-foreground">{b.location || "—"}</span>
      ),
    },
    {
      key: "size",
      label: "Size",
      width: "90px",
      render: (b: Booth) => (
        <span className="text-xs capitalize">{b.size || "—"}</span>
      ),
    },
    {
      key: "equipment",
      label: "Equipment",
      render: (b: Booth) => (
        <span className="text-xs text-muted-foreground">{b.equipment || "—"}</span>
      ),
    },
    {
      key: "status",
      label: "Status",
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
    await fetch(`/api/booths/${selectedBooth.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "If-Match": "999" },
      body: JSON.stringify(drawerForm),
    });
    setDrawerSaving(false);
    setSelectedBooth(null);
    refreshData();
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = Object.fromEntries(form);

    const res = await fetch("/api/booths", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      const json = await res.json();
      setBooths((prev) => [json.data, ...prev]);
      setShowForm(false);
    }
  };

  const drawerSections = selectedBooth
    ? [
        {
          label: "Booth",
          content: (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={(drawerForm.name as string) || ""} onChange={(e) => updateField("name", e.target.value)} />
              </div>
              <FileUpload
                value={(drawerForm.companyLogoUrl as string) || ""}
                onChange={(url) => updateField("companyLogoUrl", url)}
                folder="booth-logos"
                label="Company Logo"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Location</Label>
                  <Input value={(drawerForm.location as string) || ""} onChange={(e) => updateField("location", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Size</Label>
                <Select value={String(drawerForm.size || "standard")} onValueChange={(v) => updateField("size", v)}>
                  <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Equipment</Label>
                <Textarea rows={4} placeholder="Power, wifi, table, chairs, etc." value={(drawerForm.equipment as string) || ""} onChange={(e) => updateField("equipment", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea rows={4} placeholder="Additional notes about this booth..." value={(drawerForm.notes as string) || ""} onChange={(e) => updateField("notes", e.target.value)} />
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
          <h1 className="font-heading text-2xl font-bold tracking-tight">Booths</h1>
          <p className="text-sm text-muted-foreground">{booths.length} total</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? <><X className="mr-2 h-3 w-3" /> Cancel</> : <><Plus className="mr-2 h-3 w-3" /> Add Booth</>}
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input name="name" placeholder="e.g., Booth A1" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Location</Label>
                  <Input name="location" placeholder="e.g., Hall B, Row 3" />
                </div>
                <div className="space-y-1.5">
                  <Label>Size</Label>
                  <Select name="size" defaultValue="standard">
                    <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Equipment</Label>
                  <Input name="equipment" placeholder="e.g., Table, chairs, power strip" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Source</Label>
                  <Select name="source" defaultValue="outreach">
                    <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="intake">Intake</SelectItem>
                      <SelectItem value="outreach">Outreach</SelectItem>
                      <SelectItem value="sponsored">Sponsored</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Assigned To</Label>
                  <Input name="assignedTo" placeholder="Team member name" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea name="notes" placeholder="Any additional notes about this booth..." rows={2} />
              </div>
              <Button type="submit" className="w-full sm:w-auto">Create Booth</Button>
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
        <p className="text-center text-sm text-muted-foreground py-8">No booths match the current filters.</p>
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
