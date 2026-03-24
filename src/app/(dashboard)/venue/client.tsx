"use client";

import { useState } from "react";
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
import { PipelineFilters, StageBadge, SourceBadge, usePipelineFilters } from "@/components/pipeline-view";
import { Plus, Star, Check, X } from "lucide-react";

type Venue = {
  id: string;
  name: string;
  address: string | null;
  contactName: string | null;
  capacity: number | null;
  priceQuote: string | null;
  status: string;
  source: string;
  stage: string;
  isFinalized: boolean;
  assignedTo: string | null;
  pros: string | null;
  cons: string | null;
};

export function VenueClient({ initialVenues }: { initialVenues: Venue[] }) {
  const { source, stage, setSource, setStage, filter } = usePipelineFilters();
  const [showForm, setShowForm] = useState(false);
  const finalized = initialVenues.find((v) => v.isFinalized);
  const venues = initialVenues;
  const filtered = filter(venues).filter((v) => !v.isFinalized);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = Object.fromEntries(form);

    await fetch("/api/venues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    setShowForm(false);
    window.location.reload();
  };

  return (
    <div>
      <div className="mb-6 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Venue</h1>
          <p className="text-sm text-muted-foreground">{venues.length} total</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? <><X className="mr-2 h-3 w-3" /> Cancel</> : <><Plus className="mr-2 h-3 w-3" /> Add Candidate</>}
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
                  <Input name="name" placeholder="e.g., Shangri-La Hotel" required />
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
                  <Input name="contactEmail" type="email" placeholder="contact@venue.mn" />
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
                    <SelectTrigger><SelectValue /></SelectTrigger>
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
                  <Input name="assignedTo" placeholder="e.g., Team member name" />
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
              <Button type="submit" className="w-full sm:w-auto">Create Venue Candidate</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Finalized venue banner */}
      {finalized && (
        <Card className="mb-6 border-emerald-200 bg-emerald-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-emerald-100 p-2">
                <Check className="h-5 w-5 text-emerald-700" />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-emerald-900">{finalized.name}</p>
                  <Badge className="bg-emerald-100 text-emerald-700">Finalized</Badge>
                </div>
                <p className="text-sm text-emerald-700 mt-0.5">{finalized.address}</p>
                <p className="text-sm text-emerald-700">Capacity: {finalized.capacity} &middot; {finalized.priceQuote}</p>
                <p className="text-xs text-emerald-600 mt-1">Contact: {finalized.contactName} &middot; Managed by {finalized.assignedTo}</p>
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

      {/* Venue cards */}
      <div className="space-y-3">
        {filtered.map((venue) => (
          <Card key={venue.id} className="hover:border-yellow-500/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{venue.name}</p>
                    <StageBadge stage={venue.stage} />
                    <SourceBadge source={venue.source} />
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{venue.address}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Capacity:</span>{" "}
                      <span className="font-medium">{venue.capacity}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Contact:</span>{" "}
                      <span className="font-medium">{venue.contactName}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Assigned:</span>{" "}
                      <span className="font-medium text-yellow-600">{venue.assignedTo}</span>
                    </div>
                  </div>
                  <p className="text-sm mt-1"><span className="text-muted-foreground">Quote:</span> {venue.priceQuote}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-xs">
                    {venue.pros && <div className="text-emerald-600">+ {venue.pros}</div>}
                    {venue.cons && <div className="text-red-600">- {venue.cons}</div>}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-3 sm:justify-end">
                <Button size="sm" variant="outline" className="flex-1 sm:flex-none">Update Status</Button>
                <Button size="sm" className="flex-1 sm:flex-none">
                  <Star className="mr-2 h-3 w-3" /> Finalize
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">No venues match the current filters.</p>
        )}
      </div>
    </div>
  );
}
