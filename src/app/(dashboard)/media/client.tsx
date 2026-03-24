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
import { Plus, X } from "lucide-react";

type MediaPartner = {
  id: string;
  companyName: string;
  contactName: string;
  type: string | null;
  reach: string | null;
  status: string;
  source: string;
  stage: string;
  assignedTo: string | null;
  deliverables: string | null;
};

export function MediaClient({ initialPartners }: { initialPartners: MediaPartner[] }) {
  const { source, stage, setSource, setStage, filter } = usePipelineFilters();
  const [showForm, setShowForm] = useState(false);

  const partners = initialPartners;
  const filtered = filter(partners);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = Object.fromEntries(form);

    await fetch("/api/media-partners", {
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

      <div className="space-y-2">
        {filtered.map((partner) => (
          <Card key={partner.id} className="hover:border-yellow-500/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{partner.companyName}</p>
                    <StageBadge stage={partner.stage} />
                    <SourceBadge source={partner.source} />
                    {partner.type && <Badge variant="outline" className="text-[10px]">{partner.type}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{partner.contactName} &middot; {partner.reach}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    {partner.assignedTo && (
                      <span className="text-yellow-600">Assigned: {partner.assignedTo}</span>
                    )}
                    {partner.deliverables && <span>{partner.deliverables}</span>}
                  </div>
                </div>
              </div>
              {partner.stage === "lead" && (
                <div className="flex gap-2 mt-3 sm:justify-end">
                  <Button size="sm" variant="outline" className="flex-1 sm:flex-none">Decline</Button>
                  <Button size="sm" className="flex-1 sm:flex-none">Confirm</Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">No media partners match the current filters.</p>
        )}
      </div>
    </div>
  );
}
