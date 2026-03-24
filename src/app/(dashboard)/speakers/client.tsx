"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Mic2, Copy, Check, ExternalLink, Plus, X, Trash2 } from "lucide-react";

type Speaker = {
  id: string;
  name: string;
  email: string;
  talkTitle: string;
  company: string | null;
  status: string;
  reviewScore: number | null;
  source: string;
  stage: string;
  assignedTo: string | null;
  createdAt: Date;
};

export function SpeakersClient({ initialSpeakers }: { initialSpeakers: Speaker[] }) {
  const { source, stage, setSource, setStage, filter } = usePipelineFilters();
  const [copied, setCopied] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const speakers = initialSpeakers;
  const filtered = filter(speakers);

  const handleCopyCfp = () => {
    navigator.clipboard.writeText(`${window.location.origin}/apply/dev-summit-2026`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStatusChange = async (id: string, newStage: string) => {
    await fetch(`/api/speakers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "If-Match": "1" },
      body: JSON.stringify({ status: newStage === "confirmed" ? "accepted" : newStage === "declined" ? "rejected" : "pending" }),
    });
    window.location.reload();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this speaker?")) return;
    await fetch(`/api/speakers/${id}`, { method: "DELETE" });
    window.location.reload();
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = Object.fromEntries(form);
    await fetch("/api/speakers", {
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
          <h1 className="font-heading text-2xl font-bold tracking-tight">Speakers</h1>
          <p className="text-sm text-muted-foreground">{speakers.length} total</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyCfp}>
            {copied ? <><Check className="mr-2 h-3 w-3" /> Copied</> : <><ExternalLink className="mr-2 h-3 w-3" /> CFP Link</>}
          </Button>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? <><X className="mr-2 h-3 w-3" /> Cancel</> : <><Plus className="mr-2 h-3 w-3" /> Add Speaker</>}
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
                  <Input name="name" placeholder="e.g., Batbold T." required />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input name="email" type="email" placeholder="batbold@example.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Company</Label>
                  <Input name="company" placeholder="DataMN" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Talk Title</Label>
                  <Input name="talkTitle" placeholder="TBD" />
                </div>
                <div className="space-y-1.5">
                  <Label>Source</Label>
                  <Select name="source" defaultValue="outreach">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="intake">Intake (CFP)</SelectItem>
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
              <Button type="submit" className="w-full sm:w-auto">Add Speaker</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Pipeline filters */}
      <PipelineFilters
        items={speakers}
        sources={["all", "intake", "outreach", "sponsored"]}
        activeSource={source}
        activeStage={stage}
        onSourceChange={setSource}
        onStageChange={setStage}
      />

      {/* Speaker list */}
      {speakers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Mic2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-1">No speakers yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Share your CFP link or add speakers via the agent chat.</p>
            <Button onClick={handleCopyCfp}>
              <Copy className="mr-2 h-4 w-4" /> Copy CFP Link
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((speaker) => (
            <Card key={speaker.id} className="hover:border-yellow-500/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium truncate">{speaker.name}</p>
                      <StageBadge stage={speaker.stage} />
                      <SourceBadge source={speaker.source} />
                      {speaker.status && speaker.status !== "pending" && (
                        <Badge variant="outline" className="text-[10px]">{speaker.status}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-0.5">
                      {speaker.talkTitle || "Talk TBD"}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      {speaker.company && <span>{speaker.company}</span>}
                      {speaker.assignedTo && (
                        <span className="text-yellow-600">Assigned: {speaker.assignedTo}</span>
                      )}
                      <span>{new Date(speaker.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {speaker.reviewScore && (
                    <div className="text-right shrink-0">
                      <p className="text-lg font-semibold tabular-nums">{(speaker.reviewScore / 10).toFixed(1)}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Score</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 mt-3 sm:justify-end">
                  <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(speaker.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                  {speaker.stage === "lead" && (
                    <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => handleStatusChange(speaker.id, "engaged")}>Engage</Button>
                  )}
                  {(speaker.stage === "lead" || speaker.stage === "engaged") && (
                    <>
                      <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => handleStatusChange(speaker.id, "declined")}>Decline</Button>
                      <Button size="sm" className="flex-1 sm:flex-none" onClick={() => handleStatusChange(speaker.id, "confirmed")}>Confirm</Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No speakers match the current filters.</p>
          )}
        </div>
      )}
    </div>
  );
}
