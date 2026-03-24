"use client";

import { useState, useCallback } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { PipelineFilters, usePipelineFilters } from "@/components/pipeline-view";
import { PipelineTable } from "@/components/pipeline-table";
import { EntityDrawer } from "@/components/entity-drawer";
import { Mic2, Copy, Check, ExternalLink, Plus, X } from "lucide-react";

type Speaker = {
  id: string;
  name: string;
  email: string;
  talkTitle: string;
  talkAbstract: string | null;
  talkType: string | null;
  company: string | null;
  title: string | null;
  bio: string | null;
  headshotUrl: string | null;
  status: string;
  reviewScore: number | null;
  reviewNotes: string | null;
  source: string;
  stage: string;
  assignedTo: string | null;
  trackPreference: string | null;
  createdAt: Date;
};

export function SpeakersClient({ initialSpeakers }: { initialSpeakers: Speaker[] }) {
  const { source, stage, setSource, setStage, filter } = usePipelineFilters();
  const [speakers, setSpeakers] = useState(initialSpeakers);
  const [copied, setCopied] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedSpeaker, setSelectedSpeaker] = useState<Speaker | null>(null);
  const [drawerSaving, setDrawerSaving] = useState(false);

  const filtered = filter(speakers);

  const handleCopyCfp = () => {
    navigator.clipboard.writeText(`${window.location.origin}/apply/dev-summit-2026`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Refresh data without full page reload
  const refreshData = useCallback(() => {
    window.location.reload();
  }, []);

  // Drawer save
  const handleDrawerSave = async () => {
    if (!selectedSpeaker) return;
    setDrawerSaving(true);
    const form = document.getElementById("speaker-drawer-form") as HTMLFormElement;
    if (form) {
      const data = Object.fromEntries(new FormData(form));
      await fetch(`/api/speakers/${selectedSpeaker.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "If-Match": "999" },
        body: JSON.stringify(data),
      });
    }
    setDrawerSaving(false);
    setSelectedSpeaker(null);
    refreshData();
  };

  // Speaker drawer sections
  const drawerSections = selectedSpeaker
    ? [
        {
          label: "Profile",
          content: (
            <form id="speaker-drawer-form" className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input name="name" defaultValue={selectedSpeaker.name} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input name="email" defaultValue={selectedSpeaker.email || ""} />
                </div>
                <div className="space-y-1.5">
                  <Label>Company</Label>
                  <Input name="company" defaultValue={selectedSpeaker.company || ""} />
                </div>
                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input name="title" defaultValue={selectedSpeaker.title || ""} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Bio</Label>
                <Textarea name="bio" rows={4} placeholder="Speaker bio..." defaultValue={selectedSpeaker.bio || ""} />
              </div>
            </form>
          ),
        },
        {
          label: "Talk",
          content: (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Talk Title</Label>
                <Input name="talkTitle" defaultValue={selectedSpeaker.talkTitle || ""} form="speaker-drawer-form" />
              </div>
              <div className="space-y-1.5">
                <Label>Abstract</Label>
                <Textarea name="talkAbstract" rows={6} placeholder="Talk abstract..." defaultValue={selectedSpeaker.talkAbstract || ""} form="speaker-drawer-form" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select name="talkType" defaultValue={selectedSpeaker.talkType || "talk"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="talk">Talk</SelectItem>
                      <SelectItem value="keynote">Keynote</SelectItem>
                      <SelectItem value="workshop">Workshop</SelectItem>
                      <SelectItem value="panel">Panel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Track</Label>
                  <Input name="trackPreference" defaultValue={selectedSpeaker.trackPreference || ""} form="speaker-drawer-form" />
                </div>
              </div>
            </div>
          ),
        },
        {
          label: "Requirements",
          content: (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">AV and logistics requirements for this speaker.</p>
              <div className="grid grid-cols-2 gap-2">
                {["Podium", "Projector", "Demo setup", "Wireless mic", "Lapel mic", "Hand-held mic", "USB-C adapter", "HDMI adapter", "Whiteboard", "Internet access"].map((req) => (
                  <label key={req} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-stone-50 rounded px-2 py-1">
                    <input type="checkbox" className="rounded border-stone-300" />
                    <span>{req}</span>
                  </label>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label>Special Requirements</Label>
                <Textarea rows={3} placeholder="Any other requirements..." />
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
                  <Select name="source" defaultValue={selectedSpeaker.source}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="intake">Intake</SelectItem>
                      <SelectItem value="outreach">Outreach</SelectItem>
                      <SelectItem value="sponsored">Sponsored</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Stage</Label>
                  <Select name="stage" defaultValue={selectedSpeaker.stage}>
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
                <Input name="assignedTo" defaultValue={selectedSpeaker.assignedTo || ""} form="speaker-drawer-form" />
              </div>
              <div className="space-y-1.5">
                <Label>Review Notes</Label>
                <Textarea name="reviewNotes" rows={4} placeholder="Internal notes..." defaultValue={selectedSpeaker.reviewNotes || ""} form="speaker-drawer-form" />
              </div>
            </div>
          ),
        },
      ]
    : [];

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = Object.fromEntries(form);
    const res = await fetch("/api/speakers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const json = await res.json();
      setSpeakers((prev) => [json.data, ...prev]);
      setShowForm(false);
    }
  };

  const columns = [
    {
      key: "name",
      label: "Speaker",
      width: "200px",
      render: (s: Speaker) => (
        <div>
          <p className="font-medium text-sm">{s.name}</p>
          <p className="text-xs text-muted-foreground">{s.email || "No email"}</p>
        </div>
      ),
    },
    {
      key: "company",
      label: "Company",
      width: "140px",
      render: (s: Speaker) => (
        <span className="text-xs text-muted-foreground">{s.company || "—"}</span>
      ),
    },
    {
      key: "talk",
      label: "Talk",
      render: (s: Speaker) => (
        <div>
          <p className="text-xs">{s.talkTitle || "TBD"}</p>
          {s.trackPreference && (
            <p className="text-[10px] text-muted-foreground">{s.trackPreference}</p>
          )}
        </div>
      ),
    },
    {
      key: "score",
      label: "Score",
      width: "60px",
      render: (s: Speaker) => (
        <span className="text-xs tabular-nums font-medium">
          {s.reviewScore ? (s.reviewScore / 10).toFixed(1) : "—"}
        </span>
      ),
    },
  ];

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
                  <Input name="assignedTo" placeholder="Team member" />
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

      {/* Table view */}
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
        <PipelineTable
          items={filtered}
          columns={columns}
          entityName="speaker"
          apiEndpoint="/api/speakers"
          onUpdate={refreshData}
          onRowClick={(speaker) => setSelectedSpeaker(speaker)}
        />
      )}

      {filtered.length === 0 && speakers.length > 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">No speakers match the current filters.</p>
      )}

      {/* Detail drawer */}
      <EntityDrawer
        key={selectedSpeaker?.id || "closed"}
        isOpen={!!selectedSpeaker}
        onClose={() => setSelectedSpeaker(null)}
        title={selectedSpeaker?.name || ""}
        subtitle={selectedSpeaker?.company || selectedSpeaker?.email || ""}
        sections={drawerSections}
        onSave={handleDrawerSave}
        saving={drawerSaving}
      />
    </div>
  );
}
