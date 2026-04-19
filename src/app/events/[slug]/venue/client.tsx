"use client";

import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { ImageGalleryUpload } from "@/components/image-gallery-upload";
import { ChecklistPanel } from "@/components/checklist-panel";
import { AssignedToSelect } from "@/components/assigned-to-select";
import { Plus, Check, X } from "lucide-react";
import { toast } from "sonner";
import { validateRequired, validateEmail, getApiError } from "@/lib/validation";
import { PortalInviteSection } from "@/components/portal-invite-section";

type Venue = {
  id: string;
  name: string;
  address: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  capacity: number | null;
  priceQuote: string | null;
  status: string;
  assignedTo: string | null;
  pros: string | null;
  cons: string | null;
  notes: string | null;
  mainImageUrl: string | null;
  interiorPhotos: string[] | null;
  exteriorPhotos: string[] | null;
  floorPlanUrl: string | null;
  source: string;
  stage: string;
};

export function VenueClient({ initialVenues }: { initialVenues: Venue[] }) {
  const { source, stage, setSource, setStage, filter } = usePipelineFilters();
  const [venues, setVenues] = useState(initialVenues);
  const [showForm, setShowForm] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [drawerSaving, setDrawerSaving] = useState(false);
  const [drawerForm, setDrawerForm] = useState<Record<string, string | null | string[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const confirmed = venues.find((v) => v.stage === "confirmed");
  const filtered = filter(venues);

  const columns = [
    {
      key: "name",
      label: "Name",
      width: "160px",
      render: (v: Venue) => (
        <p className="font-medium text-sm">{v.name}</p>
      ),
    },
    {
      key: "address",
      label: "Address",
      width: "180px",
      render: (v: Venue) => (
        <span className="text-xs text-muted-foreground">{v.address || "—"}</span>
      ),
    },
    {
      key: "contactName",
      label: "Contact",
      width: "130px",
      render: (v: Venue) => (
        <span className="text-xs text-muted-foreground">{v.contactName || "—"}</span>
      ),
    },
    {
      key: "capacity",
      label: "Capacity",
      width: "80px",
      render: (v: Venue) => (
        <span className="text-xs font-medium">{v.capacity ?? "—"}</span>
      ),
    },
    {
      key: "priceQuote",
      label: "Price Quote",
      width: "110px",
      render: (v: Venue) => (
        <span className="text-xs text-muted-foreground">{v.priceQuote || "—"}</span>
      ),
    },
  ];

  // Refresh data without full page reload
  const refreshData = useCallback(async () => {
    const res = await fetch("/api/venues");
    if (res.ok) {
      const json = await res.json();
      if (json.data) setVenues(json.data);
    } else {
      window.location.reload();
    }
  }, []);

  const openDrawer = (venue: Venue) => {
    setSelectedVenue(venue);
    setDrawerForm({
      name: venue.name || "",
      address: venue.address || "",
      contactName: venue.contactName || "",
      contactEmail: venue.contactEmail || "",
      contactPhone: venue.contactPhone || "",
      capacity: venue.capacity != null ? String(venue.capacity) : "",
      priceQuote: venue.priceQuote || "",
      pros: venue.pros || "",
      cons: venue.cons || "",
      notes: venue.notes || "",
      mainImageUrl: venue.mainImageUrl || "",
      interiorPhotos: venue.interiorPhotos || [],
      exteriorPhotos: venue.exteriorPhotos || [],
      floorPlanUrl: venue.floorPlanUrl || "",
      source: venue.source || "intake",
      stage: venue.stage || "lead",
      assignedTo: venue.assignedTo || "",
    });
  };

  const updateField = (field: string, value: string | null | string[]) => {
    setDrawerForm((prev) => ({ ...prev, [field]: Array.isArray(value) ? value : (value || "") }));
  };

  const handleDrawerSave = async () => {
    if (!selectedVenue) return;
    setDrawerSaving(true);
    const res = await fetch(`/api/venues/${selectedVenue.id}`, {
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
    const emailErr = validateEmail(data.contactEmail, "Contact email");
    if (emailErr) newErrors.contactEmail = emailErr;
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});

    const res = await fetch("/api/venues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      toast.error(await getApiError(res, "Failed to create venue"));
      return;
    }

    const json = await res.json();
    setVenues((prev) => [json.data, ...prev]);
    setShowForm(false);
  };

  const drawerSections = selectedVenue
    ? [
        {
          label: "Venue",
          content: (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input value={(drawerForm.name as string) || ""} onChange={(e) => updateField("name", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Address</Label>
                  <Input value={(drawerForm.address as string) || ""} onChange={(e) => updateField("address", e.target.value)} />
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Contact Phone</Label>
                  <Input value={(drawerForm.contactPhone as string) || ""} onChange={(e) => updateField("contactPhone", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Capacity</Label>
                  <Input type="number" value={(drawerForm.capacity as string) || ""} onChange={(e) => updateField("capacity", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Price Quote</Label>
                <Input value={(drawerForm.priceQuote as string) || ""} onChange={(e) => updateField("priceQuote", e.target.value)} />
              </div>

              {/* Portal Invite — only for confirmed venues with email */}
              {selectedVenue?.stage === "confirmed" && selectedVenue?.contactEmail && (
                <PortalInviteSection entityType="venue" entityId={selectedVenue.id} entityEmail={selectedVenue.contactEmail} />
              )}
            </div>
          ),
        },
        {
          label: "Evaluation",
          content: (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Pros</Label>
                <Textarea rows={4} placeholder="What makes this venue great..." value={(drawerForm.pros as string) || ""} onChange={(e) => updateField("pros", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Cons</Label>
                <Textarea rows={4} placeholder="Any drawbacks..." value={(drawerForm.cons as string) || ""} onChange={(e) => updateField("cons", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea rows={4} placeholder="Additional notes..." value={(drawerForm.notes as string) || ""} onChange={(e) => updateField("notes", e.target.value)} />
              </div>
            </div>
          ),
        },
        {
          label: "Photos",
          content: (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <FileUpload
                  value={(drawerForm.mainImageUrl as string) || ""}
                  onChange={(url) => updateField("mainImageUrl", url)}
                  folder="venues/main"
                  label="Main Image"
                />
              </div>
              <div className="space-y-1.5">
                <ImageGalleryUpload
                  images={Array.isArray(drawerForm.interiorPhotos) ? drawerForm.interiorPhotos : []}
                  onChange={(urls) => updateField("interiorPhotos", urls)}
                  folder="venues/interior"
                  label="Interior Photos"
                  maxImages={10}
                />
              </div>
              <div className="space-y-1.5">
                <ImageGalleryUpload
                  images={Array.isArray(drawerForm.exteriorPhotos) ? drawerForm.exteriorPhotos : []}
                  onChange={(urls) => updateField("exteriorPhotos", urls)}
                  folder="venues/exterior"
                  label="Exterior Photos"
                  maxImages={10}
                />
              </div>
              <div className="space-y-1.5">
                <FileUpload
                  value={(drawerForm.floorPlanUrl as string) || ""}
                  onChange={(url) => updateField("floorPlanUrl", url)}
                  folder="venues/floorplans"
                  label="Floor Plan"
                />
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
        // Checklist tab (only for confirmed venues)
        ...(selectedVenue?.stage === "confirmed"
          ? [
              {
                label: "Checklist",
                content: (
                  <ChecklistPanel entityType="venue" entityId={selectedVenue.id} />
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
          <h1 className="font-heading text-2xl font-bold tracking-tight">Venues</h1>
          <p className="text-sm text-muted-foreground">{venues.length} total</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? <><X className="mr-2 h-3 w-3" /> Cancel</> : <><Plus className="mr-2 h-3 w-3" /> Add Venue</>}
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
                  <Input name="name" placeholder="e.g., Shangri-La Hotel" aria-invalid={!!errors.name} onChange={() => setErrors((prev) => { const next = { ...prev }; delete next.name; return next; })} />
                  {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Address</Label>
                  <Input name="address" placeholder="e.g., Olympic St 19, Ulaanbaatar" />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact Name</Label>
                  <Input name="contactName" placeholder="e.g., Bat-Erdene D." />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact Email</Label>
                  <Input name="contactEmail" type="email" placeholder="contact@venue.mn" aria-invalid={!!errors.contactEmail} onChange={() => setErrors((prev) => { const next = { ...prev }; delete next.contactEmail; return next; })} />
                  {errors.contactEmail && <p className="text-xs text-destructive">{errors.contactEmail}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Contact Phone</Label>
                  <Input name="contactPhone" placeholder="+976 ..." />
                </div>
                <div className="space-y-1.5">
                  <Label>Capacity</Label>
                  <Input name="capacity" type="number" placeholder="e.g., 500" />
                </div>
                <div className="space-y-1.5">
                  <Label>Price Quote</Label>
                  <Input name="priceQuote" placeholder="e.g., $5,000/day" />
                </div>
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
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Assigned To</Label>
                  <AssignedToSelect name="assignedTo" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Pros</Label>
                  <Textarea name="pros" placeholder="What makes this venue great..." rows={2} />
                </div>
                <div className="space-y-1.5">
                  <Label>Cons</Label>
                  <Textarea name="cons" placeholder="Any drawbacks..." rows={2} />
                </div>
              </div>
              <Button type="submit" className="w-full sm:w-auto">Add Venue</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Confirmed venue banner */}
      {confirmed && (
        <Card className="mb-4 border-emerald-200 bg-emerald-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-emerald-100 p-2">
                <Check className="h-5 w-5 text-emerald-700" />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-emerald-900">{confirmed.name}</p>
                  <Badge className="bg-emerald-100 text-emerald-700">Confirmed</Badge>
                </div>
                {confirmed.address && <p className="text-sm text-emerald-700 mt-0.5">{confirmed.address}</p>}
                {(confirmed.capacity || confirmed.priceQuote) && (
                  <p className="text-sm text-emerald-700">
                    {confirmed.capacity ? `Capacity: ${confirmed.capacity}` : ""}{confirmed.capacity && confirmed.priceQuote ? " · " : ""}{confirmed.priceQuote || ""}
                  </p>
                )}
                {(confirmed.contactName || confirmed.assignedTo) && (
                  <p className="text-xs text-emerald-600 mt-1">
                    {confirmed.contactName ? `Contact: ${confirmed.contactName}` : ""}{confirmed.contactName && confirmed.assignedTo ? " · " : ""}{confirmed.assignedTo ? `Managed by ${confirmed.assignedTo}` : ""}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pipeline filters */}
      <PipelineFilters
        items={venues}
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
        entityName="venue"
        apiEndpoint="/api/venues"
        onUpdate={refreshData}
        onRowClick={(venue) => openDrawer(venue)}
      />

      {filtered.length === 0 && venues.length > 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">No venues match the current filters.</p>
      )}

      <EntityDrawer
        key={selectedVenue?.id || "closed"}
        isOpen={!!selectedVenue}
        onClose={() => setSelectedVenue(null)}
        title={selectedVenue?.name || ""}
        subtitle={selectedVenue?.address || ""}
        sections={drawerSections}
        onSave={handleDrawerSave}
        saving={drawerSaving}
      />
    </div>
  );
}
