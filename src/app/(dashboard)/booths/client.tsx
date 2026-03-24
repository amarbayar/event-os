"use client";

import { useState } from "react";
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
import { PipelineFilters, StageBadge, SourceBadge, usePipelineFilters } from "@/components/pipeline-view";
import { Plus, X } from "lucide-react";

type Booth = {
  id: string;
  name: string;
  location: string | null;
  size: string | null;
  status: string;
  source: string;
  stage: string;
  assignedTo: string | null;
  sponsorId: string | null;
  equipment: string | null;
};

export function BoothsClient({ initialBooths }: { initialBooths: Booth[] }) {
  const { source, stage, setSource, setStage, filter } = usePipelineFilters();
  const [showForm, setShowForm] = useState(false);

  const booths = initialBooths;
  const filtered = filter(booths);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = Object.fromEntries(form);

    await fetch("/api/booths", {
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
                    <SelectTrigger><SelectValue /></SelectTrigger>
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
                    <SelectTrigger><SelectValue /></SelectTrigger>
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((booth) => (
          <Card key={booth.id} className="hover:border-yellow-500/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-medium">{booth.name}</p>
                  <p className="text-xs text-muted-foreground">{booth.location}</p>
                </div>
                <StageBadge stage={booth.stage} />
              </div>
              <div className="flex flex-wrap items-center gap-1 mb-2">
                <SourceBadge source={booth.source} />
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Size</span>
                  <span className="font-medium">{booth.size}</span>
                </div>
                {booth.sponsorId && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sponsor</span>
                    <span className="font-medium">Assigned</span>
                  </div>
                )}
                {booth.assignedTo && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Assigned</span>
                    <span className="font-medium text-yellow-600">{booth.assignedTo}</span>
                  </div>
                )}
                {booth.equipment && (
                  <div className="text-xs text-muted-foreground pt-1 border-t">
                    {booth.equipment}
                  </div>
                )}
              </div>
              {booth.stage === "lead" && (
                <Button size="sm" variant="outline" className="w-full mt-3">Reserve</Button>
              )}
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8 col-span-full">No booths match the current filters.</p>
        )}
      </div>
    </div>
  );
}
