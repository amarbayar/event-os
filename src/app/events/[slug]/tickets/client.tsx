"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Banknote,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  RefreshCcw,
  Ticket,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiError } from "@/lib/validation";

type TicketType = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  currency: string;
  capacity: number | null;
  soldCount: number;
  reservedCount: number;
  maxPerOrder: number;
  active: boolean;
};

type TicketSalesSummary = {
  currency: string;
  grossPaidAmount: number;
  paidOrders: number;
  pendingOrders: number;
  ticketsSold: number;
  ticketsReserved: number;
  byTicketType: Array<{
    ticketTypeId: string;
    name: string;
    slug: string;
    capacity: number | null;
    soldCount: number;
    reservedCount: number;
    remaining: number | null;
    paidQuantity: number;
    paidAmount: number;
  }>;
};

const emptySummary: TicketSalesSummary = {
  currency: "MNT",
  grossPaidAmount: 0,
  paidOrders: 0,
  pendingOrders: 0,
  ticketsSold: 0,
  ticketsReserved: 0,
  byTicketType: [],
};

function formatMoney(amount: number, currency: string) {
  return `${new Intl.NumberFormat("en-US").format(amount)} ${currency}`;
}

function formatRemaining(ticket: TicketType) {
  if (ticket.capacity === null) return "Unlimited";
  const remaining = Math.max(
    ticket.capacity - ticket.soldCount - ticket.reservedCount,
    0,
  );
  return `${remaining} left`;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export function TicketsClient() {
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [summary, setSummary] = useState<TicketSalesSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [capacity, setCapacity] = useState("");

  const currency = summary.currency || ticketTypes[0]?.currency || "MNT";

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const [typesRes, summaryRes] = await Promise.all([
        fetch("/api/ticket-types"),
        fetch("/api/ticket-sales/summary"),
      ]);
      if (!typesRes.ok) throw new Error(await getApiError(typesRes, "Failed to load ticket types"));
      if (!summaryRes.ok) throw new Error(await getApiError(summaryRes, "Failed to load ticket sales"));

      const [typesJson, summaryJson] = await Promise.all([
        typesRes.json(),
        summaryRes.json(),
      ]);
      setTicketTypes(typesJson.data || []);
      setSummary(summaryJson.data || emptySummary);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const progressByType = useMemo(() => {
    return new Map(summary.byTicketType.map((item) => [item.ticketTypeId, item]));
  }, [summary.byTicketType]);

  const createTicketType = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const amount = Number(price);
    const capacityValue = capacity.trim() ? Number(capacity) : null;

    if (!trimmedName || !Number.isInteger(amount) || amount < 0) {
      toast.error("Enter a ticket name and whole-number price");
      return;
    }
    if (capacityValue !== null && (!Number.isInteger(capacityValue) || capacityValue < 0)) {
      toast.error("Capacity must be a whole number");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/ticket-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          slug: slugify(trimmedName),
          price: amount,
          currency,
          capacity: capacityValue,
        }),
      });
      if (!res.ok) throw new Error(await getApiError(res, "Failed to create ticket type"));

      toast.success("Ticket type created");
      setName("");
      setPrice("");
      setCapacity("");
      await loadTickets();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create ticket type");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight">Ticket Sales</h1>
            <Badge variant="outline">Server-priced checkout</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Bonum checkout, sales counters, and QR-ready attendees.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadTickets} disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : <RefreshCcw />}
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Banknote className="h-4 w-4 text-emerald-600" />
              Paid Sales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {formatMoney(summary.grossPaidAmount, currency)}
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Tickets Sold
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{summary.ticketsSold}</div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-amber-600" />
              Pending Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{summary.pendingOrders}</div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Ticket className="h-4 w-4 text-primary" />
              Ticket Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{ticketTypes.length}</div>
          </CardContent>
        </Card>
      </div>

      <form
        onSubmit={createTicketType}
        className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_140px_140px_auto] sm:items-end"
      >
        <div className="space-y-1.5">
          <Label htmlFor="ticket-name">Create Ticket Type</Label>
          <Input
            id="ticket-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="General Admission"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ticket-price">Price</Label>
          <Input
            id="ticket-price"
            inputMode="numeric"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="50000"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ticket-capacity">Capacity</Label>
          <Input
            id="ticket-capacity"
            inputMode="numeric"
            value={capacity}
            onChange={(event) => setCapacity(event.target.value)}
            placeholder="250"
          />
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Plus />}
          Add
        </Button>
      </form>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">Sales Progress</h2>
          <span className="text-sm text-muted-foreground">
            {summary.paidOrders} paid orders
          </span>
        </div>

        {ticketTypes.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No ticket types yet.
          </div>
        ) : (
          <div className="grid gap-3">
            {ticketTypes.map((ticket) => {
              const progress = progressByType.get(ticket.id);
              const capacityLabel = ticket.capacity === null ? "Unlimited" : `${ticket.capacity} capacity`;
              const percent =
                ticket.capacity && ticket.capacity > 0
                  ? Math.min(100, Math.round((ticket.soldCount / ticket.capacity) * 100))
                  : 0;

              return (
                <Card key={ticket.id} size="sm">
                  <CardContent className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-medium">{ticket.name}</h3>
                          {!ticket.active && <Badge variant="secondary">Inactive</Badge>}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {formatMoney(ticket.price, ticket.currency)} · {capacityLabel} · {formatRemaining(ticket)}
                        </div>
                      </div>
                      <div className="text-left sm:text-right">
                        <div className="font-medium">
                          {progress?.paidQuantity || 0} sold
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatMoney(progress?.paidAmount || 0, ticket.currency)}
                        </div>
                      </div>
                    </div>
                    {ticket.capacity !== null && (
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
