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
import { Building2, Plus, X } from "lucide-react";

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
  createdAt: Date;
};

export function SponsorsClient({ initialSponsors }: { initialSponsors: Sponsor[] }) {
  const { source, stage, setSource, setStage, filter } = usePipelineFilters();
  const [showForm, setShowForm] = useState(false);
  const sponsors = initialSponsors;

  const filtered = filter(sponsors);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = Object.fromEntries(form);

    await fetch("/api/sponsors", {
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
          <h1 className="font-heading text-2xl font-bold tracking-tight">Sponsors</h1>
          <p className="text-sm text-muted-foreground">{sponsors.length} total</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? <><X className="mr-2 h-3 w-3" /> Cancel</> : <><Plus className="mr-2 h-3 w-3" /> Add Sponsor</>}
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
                  <Input name="companyName" placeholder="e.g., Khan Bank" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact Name *</Label>
                  <Input name="contactName" placeholder="e.g., Bat-Erdene D." required />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact Email *</Label>
                  <Input name="contactEmail" type="email" placeholder="events@company.mn" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Package</Label>
                  <Select name="packagePreference" defaultValue="gold">
                    <SelectTrigger><SelectValue /></SelectTrigger>
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
                <Label>Notes</Label>
                <Textarea name="message" placeholder="Any notes about the sponsorship..." rows={2} />
              </div>
              <Button type="submit" className="w-full sm:w-auto">Create Sponsor</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Pipeline filters */}
      <PipelineFilters
        items={sponsors}
        sources={["all", "intake", "outreach"]}
        activeSource={source}
        activeStage={stage}
        onSourceChange={setSource}
        onStageChange={setStage}
      />

      {/* Sponsor list */}
      {sponsors.length === 0 && !showForm ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Building2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-1">No sponsors yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add sponsors manually or paste their info into the agent chat.
            </p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add Sponsor
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((sponsor) => (
            <Card key={sponsor.id} className="hover:border-yellow-500/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{sponsor.companyName}</p>
                      <StageBadge stage={sponsor.stage} />
                      <SourceBadge source={sponsor.source} />
                      {sponsor.packagePreference && (
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {sponsor.packagePreference}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {sponsor.contactName} &middot; {sponsor.contactEmail}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      {sponsor.assignedTo && (
                        <span className="text-yellow-600">Assigned: {sponsor.assignedTo}</span>
                      )}
                      {sponsor.message && <span>{sponsor.message}</span>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No sponsors match the current filters.</p>
          )}
        </div>
      )}
    </div>
  );
}
