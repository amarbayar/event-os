"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PipelineFilters, StageBadge, SourceBadge, usePipelineFilters } from "@/components/pipeline-view";
import { Copy, Check, Plus, X } from "lucide-react";

type Volunteer = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  availability: string | null;
  status: string;
  source: string;
  stage: string;
  assignedTo: string | null;
  assignedShift: string | null;
  tshirtSize: string | null;
};

export function VolunteersClient({ initialVolunteers }: { initialVolunteers: Volunteer[] }) {
  const { source, stage, setSource, setStage, filter } = usePipelineFilters();
  const [copied, setCopied] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const volunteers = initialVolunteers;
  const filtered = filter(volunteers);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/volunteer/dev-summit-2026`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = Object.fromEntries(form);

    await fetch("/api/volunteers", {
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
                    <SelectTrigger><SelectValue /></SelectTrigger>
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

      <div className="space-y-2">
        {filtered.map((vol) => (
          <Card key={vol.id} className="hover:border-yellow-500/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{vol.name}</p>
                    <StageBadge stage={vol.stage} />
                    <SourceBadge source={vol.source} />
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{vol.role} &middot; {vol.availability}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    {vol.assignedTo && (
                      <span className="text-yellow-600">Assigned: {vol.assignedTo}</span>
                    )}
                    {vol.assignedShift && (
                      <span className="text-emerald-600">Shift: {vol.assignedShift}</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">T-shirt</p>
                  <p className="text-sm font-medium">{vol.tshirtSize}</p>
                </div>
              </div>
              {vol.stage === "lead" && (
                <div className="flex gap-2 mt-3 sm:justify-end">
                  <Button size="sm" variant="outline" className="flex-1 sm:flex-none">Decline</Button>
                  <Button size="sm" className="flex-1 sm:flex-none">Accept</Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">No volunteers match the current filters.</p>
        )}
      </div>
    </div>
  );
}
