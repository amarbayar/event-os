"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

type BoothStatus = "available" | "reserved" | "confirmed" | "setup";

const statusConfig: Record<BoothStatus, { label: string; color: string }> = {
  available: { label: "Available", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  reserved: { label: "Reserved", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  confirmed: { label: "Confirmed", color: "bg-sky-50 text-sky-700 border-sky-200" },
  setup: { label: "Setup Complete", color: "bg-stone-100 text-stone-600 border-stone-200" },
};

type Booth = {
  id: string;
  name: string;
  location: string | null;
  size: string | null;
  status: string;
  sponsorId: string | null;
  equipment: string | null;
};

export function BoothsClient({ initialBooths }: { initialBooths: Booth[] }) {
  const [filter, setFilter] = useState<BoothStatus | "all">("all");

  const booths = initialBooths;
  const filtered = filter === "all" ? booths : booths.filter((b) => b.status === filter);

  const counts = {
    total: booths.length,
    available: booths.filter((b) => b.status === "available").length,
    reserved: booths.filter((b) => b.status === "reserved").length,
    confirmed: booths.filter((b) => b.status === "confirmed").length,
  };

  return (
    <div>
      <div className="mb-6 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Booths</h1>
          <p className="text-sm text-muted-foreground">Manage exhibitor booths and floor plan</p>
        </div>
        <Button size="sm"><Plus className="mr-2 h-3 w-3" /> Add Booth</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 mb-6">
        <Card><CardContent className="p-4"><p className="text-2xl font-semibold tabular-nums">{counts.total}</p><p className="text-xs text-muted-foreground">Total Booths</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-semibold tabular-nums text-emerald-600">{counts.available}</p><p className="text-xs text-muted-foreground">Available</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-semibold tabular-nums text-yellow-600">{counts.reserved}</p><p className="text-xs text-muted-foreground">Reserved</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-semibold tabular-nums text-sky-600">{counts.confirmed}</p><p className="text-xs text-muted-foreground">Confirmed</p></CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(["all", "available", "reserved", "confirmed", "setup"] as const).map((status) => (
          <Button key={status} variant={filter === status ? "default" : "outline"} size="sm" onClick={() => setFilter(status)} className="capitalize">
            {status}
          </Button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((booth) => (
          <Card key={booth.id} className="hover:border-yellow-500/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-medium">{booth.name}</p>
                  <p className="text-xs text-muted-foreground">{booth.location}</p>
                </div>
                <Badge className={statusConfig[booth.status as BoothStatus]?.color}>
                  {statusConfig[booth.status as BoothStatus]?.label ?? booth.status}
                </Badge>
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
                {booth.equipment && (
                  <div className="text-xs text-muted-foreground pt-1 border-t">
                    {booth.equipment}
                  </div>
                )}
              </div>
              {booth.status === "available" && (
                <Button size="sm" variant="outline" className="w-full mt-3">Reserve</Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
