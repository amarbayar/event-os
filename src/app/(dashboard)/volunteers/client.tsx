"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

type VolunteerStatus = "pending" | "accepted" | "rejected";

const statusConfig: Record<VolunteerStatus, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  pending: { label: "Pending", variant: "secondary" },
  accepted: { label: "Accepted", variant: "default" },
  rejected: { label: "Declined", variant: "destructive" },
};

type Volunteer = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  availability: string | null;
  status: string;
  assignedShift: string | null;
  tshirtSize: string | null;
};

export function VolunteersClient({ initialVolunteers }: { initialVolunteers: Volunteer[] }) {
  const [filter, setFilter] = useState<VolunteerStatus | "all">("all");
  const [copied, setCopied] = useState(false);

  const volunteers = initialVolunteers;
  const filtered = filter === "all" ? volunteers : volunteers.filter((v) => v.status === filter);

  const counts = {
    total: volunteers.length,
    accepted: volunteers.filter((v) => v.status === "accepted").length,
    pending: volunteers.filter((v) => v.status === "pending").length,
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/volunteer/dev-summit-2026`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div className="mb-6 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Volunteers</h1>
          <p className="text-sm text-muted-foreground">Manage volunteer applications and shift assignments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyLink}>
            {copied ? <><Check className="mr-2 h-3 w-3" /> Copied</> : <><Copy className="mr-2 h-3 w-3" /> Signup Link</>}
          </Button>
          <Button size="sm">+ Add Volunteer</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 mb-6">
        <Card><CardContent className="p-4"><p className="text-2xl font-semibold tabular-nums">{counts.total}</p><p className="text-xs text-muted-foreground">Applications</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-semibold tabular-nums text-emerald-600">{counts.accepted}</p><p className="text-xs text-muted-foreground">Accepted</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-semibold tabular-nums text-yellow-600">{counts.pending}</p><p className="text-xs text-muted-foreground">Pending</p></CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(["all", "pending", "accepted", "rejected"] as const).map((status) => (
          <Button key={status} variant={filter === status ? "default" : "outline"} size="sm" onClick={() => setFilter(status)} className="capitalize">
            {status}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((vol) => (
          <Card key={vol.id} className="hover:border-yellow-500/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{vol.name}</p>
                    <Badge variant={statusConfig[vol.status as VolunteerStatus]?.variant ?? "secondary"}>{statusConfig[vol.status as VolunteerStatus]?.label ?? vol.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{vol.role} &middot; {vol.availability}</p>
                  {vol.assignedShift && (
                    <p className="text-xs text-emerald-600 mt-0.5">Shift: {vol.assignedShift}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">T-shirt</p>
                  <p className="text-sm font-medium">{vol.tshirtSize}</p>
                </div>
              </div>
              {vol.status === "pending" && (
                <div className="flex gap-2 mt-3 sm:justify-end">
                  <Button size="sm" variant="outline" className="flex-1 sm:flex-none">Decline</Button>
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
