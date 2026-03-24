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
import { Copy, Check, Plus, X } from "lucide-react";

type Volunteer = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string | null;
  availability: string | null;
  experience: string | null;
  tshirtSize: string | null;
  assignedShift: string | null;
  notes: string | null;
  status: string;
  source: string;
  stage: string;
  headshotUrl: string | null;
  assignedTo: string | null;
};

export function VolunteersClient({ initialVolunteers }: { initialVolunteers: Volunteer[] }) {
  const { source, stage, setSource, setStage, filter } = usePipelineFilters();
  const [volunteers, setVolunteers] = useState(initialVolunteers);
  const [copied, setCopied] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedVolunteer, setSelectedVolunteer] = useState<Volunteer | null>(null);
  const [drawerSaving, setDrawerSaving] = useState(false);
  const [drawerForm, setDrawerForm] = useState<Record<string, string | null>>({});

  const filtered = filter(volunteers);

  const columns = [
    {
      key: "name",
      label: "Name",
      width: "160px",
      render: (v: Volunteer) => (
        <p className="font-medium text-sm">{v.name}</p>
      ),
    },
    {
      key: "email",
      label: "Email",
      width: "180px",
      render: (v: Volunteer) => (
        <span className="text-xs text-muted-foreground">{v.email || "—"}</span>
      ),
    },
    {
      key: "role",
      label: "Role",
      width: "140px",
      render: (v: Volunteer) => (
        <span className="text-xs">{v.role || "—"}</span>
      ),
    },
    {
      key: "availability",
      label: "Availability",
      width: "140px",
      render: (v: Volunteer) => (
        <span className="text-xs text-muted-foreground">{v.availability || "—"}</span>
      ),
    },
    {
      key: "tshirtSize",
      label: "T-Shirt",
      width: "70px",
      render: (v: Volunteer) => (
        <span className="text-xs font-medium">{v.tshirtSize || "—"}</span>
      ),
    },
  ];

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/volunteer/dev-summit-2026`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Refresh data without full page reload
  const refreshData = useCallback(async () => {
    const res = await fetch("/api/volunteers");
    if (res.ok) {
      const json = await res.json();
      if (json.data) setVolunteers(json.data);
    } else {
      window.location.reload();
    }
  }, []);

  const openDrawer = (volunteer: Volunteer) => {
    setSelectedVolunteer(volunteer);
    setDrawerForm({
      name: volunteer.name || "",
      email: volunteer.email || "",
      phone: volunteer.phone || "",
      role: volunteer.role || "General",
      availability: volunteer.availability || "",
      tshirtSize: volunteer.tshirtSize || "L",
      assignedShift: volunteer.assignedShift || "",
      experience: volunteer.experience || "",
      notes: volunteer.notes || "",
      source: volunteer.source || "intake",
      stage: volunteer.stage || "lead",
      assignedTo: volunteer.assignedTo || "",
      headshotUrl: volunteer.headshotUrl || "",
    });
  };

  const updateField = (field: string, value: string | null) => {
    setDrawerForm((prev) => ({ ...prev, [field]: value || "" }));
  };

  const handleDrawerSave = async () => {
    if (!selectedVolunteer) return;
    setDrawerSaving(true);
    await fetch(`/api/volunteers/${selectedVolunteer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "If-Match": "999" },
      body: JSON.stringify(drawerForm),
    });
    setDrawerSaving(false);
    setSelectedVolunteer(null);
    refreshData();
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = Object.fromEntries(form);

    const res = await fetch("/api/volunteers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      const json = await res.json();
      setVolunteers((prev) => [json.data, ...prev]);
      setShowForm(false);
    }
  };

  const drawerSections = selectedVolunteer
    ? [
        {
          label: "Profile",
          content: (
            <div className="space-y-3">
              <FileUpload
                value={(drawerForm.headshotUrl as string) || ""}
                onChange={(url) => updateField("headshotUrl", url)}
                folder="volunteer-photos"
                label="Photo"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input value={(drawerForm.name as string) || ""} onChange={(e) => updateField("name", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input value={(drawerForm.email as string) || ""} onChange={(e) => updateField("email", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={(drawerForm.phone as string) || ""} onChange={(e) => updateField("phone", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select value={String(drawerForm.role || "General")} onValueChange={(v) => updateField("role", v)}>
                    <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Registration">Registration</SelectItem>
                      <SelectItem value="Stage">Stage</SelectItem>
                      <SelectItem value="Logistics">Logistics</SelectItem>
                      <SelectItem value="Tech Support">Tech Support</SelectItem>
                      <SelectItem value="General">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Availability</Label>
                  <Input value={(drawerForm.availability as string) || ""} onChange={(e) => updateField("availability", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>T-Shirt Size</Label>
                  <Select value={String(drawerForm.tshirtSize || "L")} onValueChange={(v) => updateField("tshirtSize", v)}>
                    <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="XS">XS</SelectItem>
                      <SelectItem value="S">S</SelectItem>
                      <SelectItem value="M">M</SelectItem>
                      <SelectItem value="L">L</SelectItem>
                      <SelectItem value="XL">XL</SelectItem>
                      <SelectItem value="XXL">XXL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ),
        },
        {
          label: "Assignment",
          content: (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Assigned Shift</Label>
                <Input value={(drawerForm.assignedShift as string) || ""} onChange={(e) => updateField("assignedShift", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Experience</Label>
                <Textarea rows={4} placeholder="Previous volunteer experience..." value={(drawerForm.experience as string) || ""} onChange={(e) => updateField("experience", e.target.value)} />
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
          <h1 className="font-heading text-2xl font-bold tracking-tight">Volunteers</h1>
          <p className="text-sm text-muted-foreground">{volunteers.length} total</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyLink}>
            {copied ? <><Check className="mr-2 h-3 w-3" /> Copied</> : <><Copy className="mr-2 h-3 w-3" /> Signup Link</>}
          </Button>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? <><X className="mr-2 h-3 w-3" /> Cancel</> : <><Plus className="mr-2 h-3 w-3" /> Add Volunteer</>}
          </Button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input name="name" placeholder="e.g., Temuulen B." required />
                </div>
                <div className="space-y-1.5">
                  <Label>Email *</Label>
                  <Input name="email" type="email" placeholder="volunteer@email.mn" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input name="phone" placeholder="+976 ..." />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Input name="role" placeholder="e.g., Registration Desk" />
                </div>
                <div className="space-y-1.5">
                  <Label>Availability</Label>
                  <Input name="availability" placeholder="e.g., Both days, mornings only" />
                </div>
                <div className="space-y-1.5">
                  <Label>T-Shirt Size</Label>
                  <Select name="tshirtSize" defaultValue="L">
                    <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="XS">XS</SelectItem>
                      <SelectItem value="S">S</SelectItem>
                      <SelectItem value="M">M</SelectItem>
                      <SelectItem value="L">L</SelectItem>
                      <SelectItem value="XL">XL</SelectItem>
                      <SelectItem value="XXL">XXL</SelectItem>
                    </SelectContent>
                  </Select>
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
                  <Input name="assignedTo" placeholder="Team member name" />
                </div>
              </div>
              <Button type="submit" className="w-full sm:w-auto">Create Volunteer</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Pipeline filters */}
      <PipelineFilters
        items={volunteers}
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
        entityName="volunteer"
        apiEndpoint="/api/volunteers"
        onUpdate={refreshData}
        onRowClick={(volunteer) => openDrawer(volunteer)}
      />

      {filtered.length === 0 && volunteers.length > 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">No volunteers match the current filters.</p>
      )}

      <EntityDrawer
        key={selectedVolunteer?.id || "closed"}
        isOpen={!!selectedVolunteer}
        onClose={() => setSelectedVolunteer(null)}
        title={selectedVolunteer?.name || ""}
        subtitle={selectedVolunteer?.email || ""}
        sections={drawerSections}
        onSave={handleDrawerSave}
        saving={drawerSaving}
      />
    </div>
  );
}
