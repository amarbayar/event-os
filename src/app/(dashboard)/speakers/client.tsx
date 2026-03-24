"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mic2, Copy, Check, ExternalLink } from "lucide-react";

type SpeakerStatus = "pending" | "accepted" | "rejected" | "waitlisted";

type Speaker = {
  id: string;
  name: string;
  email: string;
  talkTitle: string;
  company: string | null;
  status: SpeakerStatus;
  reviewScore: number | null;
  createdAt: Date;
};

const statusConfig: Record<
  SpeakerStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending: { label: "Pending Review", variant: "secondary" },
  accepted: { label: "Accepted", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
  waitlisted: { label: "Waitlisted", variant: "outline" },
};

export function SpeakersClient({ initialSpeakers }: { initialSpeakers: Speaker[] }) {
  const [filter, setFilter] = useState<SpeakerStatus | "all">("all");
  const [copied, setCopied] = useState(false);

  const speakers = initialSpeakers;
  const filtered = filter === "all" ? speakers : speakers.filter((s) => s.status === filter);

  const counts = {
    total: speakers.length,
    accepted: speakers.filter((s) => s.status === "accepted").length,
    pending: speakers.filter((s) => s.status === "pending").length,
    rejected: speakers.filter((s) => s.status === "rejected").length,
  };

  const handleCopyCfp = () => {
    navigator.clipboard.writeText(`${window.location.origin}/apply/dev-summit-2026`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (speakers.length === 0) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold tracking-tight">Speakers</h1>
          <p className="text-sm text-muted-foreground">Manage speaker applications</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Mic2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-1">No applications yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Share your CFP link to start receiving.</p>
            <Button onClick={handleCopyCfp}>
              {copied ? <><Check className="mr-2 h-4 w-4" /> Copied!</> : <><Copy className="mr-2 h-4 w-4" /> Copy CFP Link</>}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Speakers</h1>
          <p className="text-sm text-muted-foreground">{counts.total} applications</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyCfp}>
            {copied ? <><Check className="mr-2 h-3 w-3" /> Copied</> : <><ExternalLink className="mr-2 h-3 w-3" /> CFP Link</>}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 mb-6">
        <Card><CardContent className="p-4"><p className="text-2xl font-semibold tabular-nums">{counts.total}</p><p className="text-xs text-muted-foreground">Applications</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-semibold tabular-nums text-emerald-600">{counts.accepted}</p><p className="text-xs text-muted-foreground">Accepted</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-semibold tabular-nums text-yellow-600">{counts.pending}</p><p className="text-xs text-muted-foreground">Pending</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-semibold tabular-nums text-red-600">{counts.rejected}</p><p className="text-xs text-muted-foreground">Rejected</p></CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(["all", "pending", "accepted", "waitlisted", "rejected"] as const).map((status) => (
          <Button key={status} variant={filter === status ? "default" : "outline"} size="sm" onClick={() => setFilter(status)} className="capitalize">
            {status}
            {status !== "all" && <span className="ml-1 tabular-nums">({speakers.filter((s) => s.status === status).length})</span>}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((speaker) => (
          <Card key={speaker.id} className="hover:border-yellow-500/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium truncate">{speaker.name}</p>
                    <Badge variant={statusConfig[speaker.status].variant}>{statusConfig[speaker.status].label}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate mt-0.5">{speaker.talkTitle}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {speaker.company} &middot; {new Date(speaker.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {speaker.reviewScore && (
                  <div className="text-right shrink-0">
                    <p className="text-lg font-semibold tabular-nums">{(speaker.reviewScore / 10).toFixed(1)}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Score</p>
                  </div>
                )}
              </div>
              {speaker.status === "pending" && (
                <div className="flex gap-2 mt-3 sm:justify-end">
                  <Button size="sm" variant="outline" className="flex-1 sm:flex-none">Reject</Button>
                  <Button size="sm" className="flex-1 sm:flex-none">Accept</Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
