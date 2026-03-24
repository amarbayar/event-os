"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

type MediaStatus = "pending" | "confirmed" | "declined";

const statusConfig: Record<MediaStatus, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  pending: { label: "Pending", variant: "secondary" },
  confirmed: { label: "Confirmed", variant: "default" },
  declined: { label: "Declined", variant: "destructive" },
};

type MediaPartner = {
  id: string;
  companyName: string;
  contactName: string;
  type: string | null;
  reach: string | null;
  status: string;
  deliverables: string | null;
};

export function MediaClient({ initialPartners }: { initialPartners: MediaPartner[] }) {
  const [filter, setFilter] = useState<MediaStatus | "all">("all");

  const partners = initialPartners;
  const filtered = filter === "all" ? partners : partners.filter((p) => p.status === filter);

  const counts = {
    total: partners.length,
    confirmed: partners.filter((p) => p.status === "confirmed").length,
    pending: partners.filter((p) => p.status === "pending").length,
  };

  return (
    <div>
      <div className="mb-6 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Media Partners</h1>
          <p className="text-sm text-muted-foreground">Manage TV, press, and media collaborations</p>
        </div>
        <Button size="sm"><Plus className="mr-2 h-3 w-3" /> Add Partner</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 mb-6">
        <Card><CardContent className="p-4"><p className="text-2xl font-semibold tabular-nums">{counts.total}</p><p className="text-xs text-muted-foreground">Partners</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-semibold tabular-nums text-emerald-600">{counts.confirmed}</p><p className="text-xs text-muted-foreground">Confirmed</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-semibold tabular-nums text-yellow-600">{counts.pending}</p><p className="text-xs text-muted-foreground">Pending</p></CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(["all", "pending", "confirmed", "declined"] as const).map((status) => (
          <Button key={status} variant={filter === status ? "default" : "outline"} size="sm" onClick={() => setFilter(status)} className="capitalize">
            {status}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((partner) => (
          <Card key={partner.id} className="hover:border-yellow-500/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{partner.companyName}</p>
                    <Badge variant={statusConfig[partner.status as MediaStatus]?.variant ?? "secondary"}>{statusConfig[partner.status as MediaStatus]?.label ?? partner.status}</Badge>
                    {partner.type && <Badge variant="outline" className="text-[10px]">{partner.type}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{partner.contactName} &middot; {partner.reach}</p>
                  {partner.deliverables && <p className="text-xs text-muted-foreground mt-1">{partner.deliverables}</p>}
                </div>
              </div>
              {partner.status === "pending" && (
                <div className="flex gap-2 mt-3 sm:justify-end">
                  <Button size="sm" variant="outline" className="flex-1 sm:flex-none">Decline</Button>
                  <Button size="sm" className="flex-1 sm:flex-none">Confirm</Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
