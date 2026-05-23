"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Banknote,
  CheckCircle2,
  Clock,
  Download,
  Pencil,
  Loader2,
  Plus,
  RefreshCcw,
  Save,
  Ticket,
  Trash2,
  X,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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

type TicketEditForm = {
  name: string;
  slug: string;
  description: string;
  price: string;
  capacity: string;
  maxPerOrder: string;
};

type DirectSaleForm = {
  ticketTypeId: string;
  quantity: string;
  name: string;
  email: string;
  phone: string;
  purchaserType: "individual" | "company";
  company: string;
  companyRegistrationNumber: string;
  paymentMethod: "bank_transfer" | "cash" | "invoice" | "complimentary" | "sponsor" | "other";
  paymentReference: string;
  notes: string;
};

type CreatedDirectSale = {
  order: {
    id: string;
    status: string;
    totalAmount: number;
    currency: string;
  };
  attendees: Array<{
    id: string;
    name: string;
    email: string;
    ticketType: string;
    ticketTypeName?: string;
    qrHash: string;
  }>;
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

const emptyDirectSale: DirectSaleForm = {
  ticketTypeId: "",
  quantity: "1",
  name: "",
  email: "",
  phone: "",
  purchaserType: "individual",
  company: "",
  companyRegistrationNumber: "",
  paymentMethod: "bank_transfer",
  paymentReference: "",
  notes: "",
};

const directSalePaymentLabels: Record<DirectSaleForm["paymentMethod"], string> = {
  bank_transfer: "Bank transfer",
  cash: "Cash",
  invoice: "Invoice",
  complimentary: "Complimentary",
  sponsor: "Sponsor",
  other: "Other",
};

const purchaserTypeLabels: Record<DirectSaleForm["purchaserType"], string> = {
  individual: "Individual",
  company: "Company",
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

async function loadImageDataUrl(src: string): Promise<string | null> {
  try {
    const response = await fetch(src);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

type DirectSaleTicketPdfInput = {
  attendee: CreatedDirectSale["attendees"][number];
  order: CreatedDirectSale["order"];
  qrDataUrl: string;
  ticketPrice: string;
};

async function buildDirectSaleTicketPdf({
  attendee,
  order,
  qrDataUrl,
  ticketPrice,
}: DirectSaleTicketPdfInput) {
  const logoDataUrl = await loadImageDataUrl("/logo.png");
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFillColor("#070A12");
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  doc.setFillColor("#00D1B2");
  doc.circle(pageWidth - 48, 58, 138, "F");
  doc.setFillColor("#F5B642");
  doc.circle(18, pageHeight - 28, 118, "F");

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", 44, 38, 112, 40, undefined, "FAST");
  } else {
    doc.setTextColor("#ffffff");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.text("DevSummit", 44, 62);
  }

  doc.setTextColor("#B9C3D5");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("May 30-31, 2026 - Ulaanbaatar", 44, 98);

  doc.setFillColor("#ffffff");
  doc.roundedRect(38, 132, pageWidth - 76, 560, 18, 18, "F");
  doc.setDrawColor("#E5EAF3");
  doc.roundedRect(38, 132, pageWidth - 76, 560, 18, 18);

  doc.setTextColor("#0B1020");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text("DevSummit 2026 Ticket", 70, 190);
  doc.setFontSize(13);
  doc.setTextColor("#556070");
  doc.text("Show this QR code at registration for check-in.", 70, 214);

  doc.setFillColor("#F7F9FC");
  doc.roundedRect(70, 248, 220, 220, 12, 12, "F");
  doc.addImage(qrDataUrl, "PNG", 88, 266, 184, 184, undefined, "FAST");

  const detailsX = 324;
  const detailRows = [
    ["Ticket holder", attendee.name],
    ["Ticket type", attendee.ticketTypeName || attendee.ticketType],
    ["Price", ticketPrice],
    ["Order number", order.id],
    ["Ticket ID", attendee.id],
  ];

  detailRows.forEach(([label, value], index) => {
    const y = 264 + index * 58;
    doc.setTextColor("#7A8494");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(label.toUpperCase(), detailsX, y);
    doc.setTextColor("#0B1020");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(index >= 3 ? 9 : 14);
    const lines = doc.splitTextToSize(value, 190);
    doc.text(lines.slice(0, 2), detailsX, y + 20);
  });

  doc.setFillColor("#0B1020");
  doc.roundedRect(70, 518, pageWidth - 140, 86, 12, 12, "F");
  doc.setTextColor("#ffffff");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Registration note", 94, 548);
  doc.setTextColor("#C9D3E3");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(
    doc.splitTextToSize(
      "If your QR code cannot be scanned, organizers can look up your ticket by name, email, order number, or ticket ID.",
      pageWidth - 188,
    ),
    94,
    572,
  );

  doc.setTextColor("#B9C3D5");
  doc.setFontSize(10);
  doc.text("devsummit.dev", 44, pageHeight - 42);
  doc.text("Powered by DevSummit registration", pageWidth - 198, pageHeight - 42);
  return doc;
}

function directSaleTicketFileName(attendee: CreatedDirectSale["attendees"][number], index: number) {
  const name = attendee.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `devsummit-2026-ticket-${index + 1}-${name || attendee.id}.pdf`;
}

async function downloadDirectSaleTicketPdf(input: DirectSaleTicketPdfInput) {
  const doc = await buildDirectSaleTicketPdf(input);
  doc.save(`devsummit-2026-ticket-${input.attendee.id}.pdf`);
}

async function downloadDirectSaleTicketZip({
  sale,
  qrImages,
}: {
  sale: CreatedDirectSale;
  qrImages: Record<string, string>;
}) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const ticketPrice = formatMoney(
    Math.round(sale.order.totalAmount / sale.attendees.length),
    sale.order.currency,
  );
  let addedTickets = 0;

  for (const [index, attendee] of sale.attendees.entries()) {
    const qrDataUrl = qrImages[attendee.id];
    if (!qrDataUrl) continue;

    const doc = await buildDirectSaleTicketPdf({
      attendee,
      order: sale.order,
      qrDataUrl,
      ticketPrice,
    });
    zip.file(directSaleTicketFileName(attendee, index), doc.output("blob"));
    addedTickets += 1;
  }

  if (addedTickets === 0) {
    throw new Error("No QR ticket PDFs are ready to download yet");
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `devsummit-2026-direct-sale-${sale.order.id}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function TicketsClient() {
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [summary, setSummary] = useState<TicketSalesSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [capacity, setCapacity] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TicketEditForm | null>(null);
  const [directSale, setDirectSale] = useState<DirectSaleForm>(emptyDirectSale);
  const [creatingDirectSale, setCreatingDirectSale] = useState(false);
  const [createdDirectSale, setCreatedDirectSale] = useState<CreatedDirectSale | null>(null);
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  useEffect(() => {
    if (directSale.ticketTypeId || !ticketTypes[0]?.id) return;
    setDirectSale((current) => ({ ...current, ticketTypeId: ticketTypes[0].id }));
  }, [directSale.ticketTypeId, ticketTypes]);

  const progressByType = useMemo(() => {
    return new Map(summary.byTicketType.map((item) => [item.ticketTypeId, item]));
  }, [summary.byTicketType]);
  const selectedDirectSaleTicket = useMemo(
    () => ticketTypes.find((ticket) => ticket.id === directSale.ticketTypeId),
    [directSale.ticketTypeId, ticketTypes],
  );

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

  const startEditing = (ticket: TicketType) => {
    setEditingId(ticket.id);
    setEditForm({
      name: ticket.name,
      slug: ticket.slug,
      description: ticket.description || "",
      price: String(ticket.price),
      capacity: ticket.capacity === null ? "" : String(ticket.capacity),
      maxPerOrder: String(ticket.maxPerOrder),
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const updateDirectSale = (field: keyof DirectSaleForm, value: string) => {
    setDirectSale((current) => ({
      ...current,
      [field]: value,
      ...(field === "purchaserType" && value === "individual"
        ? { companyRegistrationNumber: "" }
        : {}),
    }));
  };

  const createDirectSale = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const quantity = Number(directSale.quantity);
    if (!directSale.ticketTypeId) {
      toast.error("Choose a ticket type");
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      toast.error("Quantity must be a whole number");
      return;
    }
    if (!directSale.name.trim() || !directSale.email.trim()) {
      toast.error("Enter buyer name and email");
      return;
    }
    if (directSale.purchaserType === "company" && !directSale.companyRegistrationNumber.trim()) {
      toast.error("Company registration number is required for company buyers");
      return;
    }

    setCreatingDirectSale(true);
    try {
      const res = await fetch("/api/ticket-sales/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketTypeId: directSale.ticketTypeId,
          quantity,
          purchaser: {
            name: directSale.name.trim(),
            email: directSale.email.trim(),
            phone: directSale.phone.trim() || undefined,
            purchaserType: directSale.purchaserType,
            company: directSale.company.trim() || undefined,
            companyRegistrationNumber:
              directSale.purchaserType === "company"
                ? directSale.companyRegistrationNumber.trim()
                : undefined,
          },
          paymentMethod: directSale.paymentMethod,
          paymentReference: directSale.paymentReference.trim() || undefined,
          notes: directSale.notes.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(await getApiError(res, "Failed to create direct sale"));

      const json = (await res.json()) as { data: CreatedDirectSale };
      const { toDataURL } = await import("qrcode");
      const images = Object.fromEntries(
        await Promise.all(
          json.data.attendees.map(async (attendee) => [
            attendee.id,
            await toDataURL(attendee.qrHash, {
              width: 280,
              margin: 1,
              color: { dark: "#111827", light: "#ffffff" },
            }),
          ]),
        ),
      ) as Record<string, string>;

      setCreatedDirectSale(json.data);
      setQrImages(images);
      setDirectSale((current) => ({
        ...emptyDirectSale,
        ticketTypeId: current.ticketTypeId,
        paymentMethod: current.paymentMethod,
      }));
      toast.success("Direct sale created with QR tickets");
      await loadTickets();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create direct sale");
    } finally {
      setCreatingDirectSale(false);
    }
  };

  const updateEditField = (field: keyof TicketEditForm, value: string) => {
    setEditForm((current) => (current ? { ...current, [field]: value } : current));
  };

  const saveTicketType = async (ticket: TicketType) => {
    if (!editForm) return;
    const trimmedName = editForm.name.trim();
    const trimmedSlug = editForm.slug.trim().toLowerCase();
    const amount = Number(editForm.price);
    const capacityValue = editForm.capacity.trim() ? Number(editForm.capacity) : null;
    const maxPerOrder = Number(editForm.maxPerOrder);

    if (!trimmedName || !trimmedSlug || !/^[a-z0-9-]{1,100}$/.test(trimmedSlug)) {
      toast.error("Enter a ticket name and a lowercase URL slug");
      return;
    }
    if (!Number.isInteger(amount) || amount < 0) {
      toast.error("Price must be a whole number");
      return;
    }
    if (capacityValue !== null && (!Number.isInteger(capacityValue) || capacityValue < 0)) {
      toast.error("Capacity must be a whole number");
      return;
    }
    if (!Number.isInteger(maxPerOrder) || maxPerOrder < 1 || maxPerOrder > 50) {
      toast.error("Max per order must be between 1 and 50");
      return;
    }

    setUpdatingId(ticket.id);
    try {
      const res = await fetch(`/api/ticket-types/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          slug: trimmedSlug,
          description: editForm.description.trim() || null,
          price: amount,
          capacity: capacityValue,
          maxPerOrder,
        }),
      });
      if (!res.ok) throw new Error(await getApiError(res, "Failed to update ticket type"));

      toast.success("Ticket type updated");
      cancelEditing();
      await loadTickets();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update ticket type");
    } finally {
      setUpdatingId(null);
    }
  };

  const setTicketActive = async (ticket: TicketType, active: boolean) => {
    setUpdatingId(ticket.id);
    try {
      const res = await fetch(`/api/ticket-types/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error(await getApiError(res, "Failed to update ticket status"));

      toast.success(active ? "Ticket type activated" : "Ticket type deactivated");
      await loadTickets();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update ticket status");
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteTicketType = async (ticket: TicketType) => {
    if (!window.confirm(`Delete "${ticket.name}"? This only works for ticket types with no sales or reservations.`)) {
      return;
    }

    setDeletingId(ticket.id);
    try {
      const res = await fetch(`/api/ticket-types/${ticket.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await getApiError(res, "Failed to delete ticket type"));

      toast.success("Ticket type deleted");
      if (editingId === ticket.id) cancelEditing();
      await loadTickets();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete ticket type");
    } finally {
      setDeletingId(null);
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Ticket className="h-4 w-4 text-primary" />
            Add Direct Sale
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={createDirectSale} className="grid gap-3 lg:grid-cols-4">
            <div className="space-y-1.5 lg:col-span-2">
              <Label>Ticket Type</Label>
              <Select
                value={directSale.ticketTypeId}
                onValueChange={(value) => updateDirectSale("ticketTypeId", value || "")}
              >
                <SelectTrigger>
                  <span data-slot="select-value" className="flex flex-1 text-left">
                    {selectedDirectSaleTicket
                      ? `${selectedDirectSaleTicket.name} · ${formatMoney(selectedDirectSaleTicket.price, selectedDirectSaleTicket.currency)}`
                      : "Choose ticket type"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {ticketTypes.map((ticket) => (
                    <SelectItem key={ticket.id} value={ticket.id}>
                      {ticket.name} · {formatMoney(ticket.price, ticket.currency)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="direct-quantity">Quantity</Label>
              <Input
                id="direct-quantity"
                inputMode="numeric"
                value={directSale.quantity}
                onChange={(event) => updateDirectSale("quantity", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Payment</Label>
              <Select
                value={directSale.paymentMethod}
                onValueChange={(value) => updateDirectSale("paymentMethod", value || "bank_transfer")}
              >
                <SelectTrigger>
                  <span data-slot="select-value" className="flex flex-1 text-left">
                    {directSalePaymentLabels[directSale.paymentMethod]}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="complimentary">Complimentary</SelectItem>
                  <SelectItem value="sponsor">Sponsor</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="direct-name">Buyer Name</Label>
              <Input
                id="direct-name"
                value={directSale.name}
                onChange={(event) => updateDirectSale("name", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="direct-email">Buyer Email</Label>
              <Input
                id="direct-email"
                type="email"
                value={directSale.email}
                onChange={(event) => updateDirectSale("email", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="direct-phone">Phone</Label>
              <Input
                id="direct-phone"
                value={directSale.phone}
                onChange={(event) => updateDirectSale("phone", event.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Buyer Type</Label>
              <Select
                value={directSale.purchaserType}
                onValueChange={(value) => updateDirectSale("purchaserType", value || "individual")}
              >
                <SelectTrigger>
                  <span data-slot="select-value" className="flex flex-1 text-left">
                    {purchaserTypeLabels[directSale.purchaserType]}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="company">Company</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="direct-company">Company</Label>
              <Input
                id="direct-company"
                value={directSale.company}
                onChange={(event) => updateDirectSale("company", event.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="direct-company-registration">Company Registration Number</Label>
              <Input
                id="direct-company-registration"
                value={directSale.companyRegistrationNumber}
                onChange={(event) => updateDirectSale("companyRegistrationNumber", event.target.value)}
                disabled={directSale.purchaserType !== "company"}
                placeholder="Required for company"
              />
            </div>
            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor="direct-reference">Payment Reference</Label>
              <Input
                id="direct-reference"
                value={directSale.paymentReference}
                onChange={(event) => updateDirectSale("paymentReference", event.target.value)}
                placeholder="Bank transaction, invoice, or receipt number"
              />
            </div>
            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor="direct-notes">Notes</Label>
              <Textarea
                id="direct-notes"
                value={directSale.notes}
                onChange={(event) => updateDirectSale("notes", event.target.value)}
                placeholder="Optional internal note"
              />
            </div>
            <div className="flex items-end lg:col-span-2">
              <Button type="submit" disabled={creatingDirectSale || ticketTypes.length === 0}>
                {creatingDirectSale ? <Loader2 className="animate-spin" /> : <Plus />}
                Create QR Tickets
              </Button>
            </div>
          </form>

          {createdDirectSale && (
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-medium">Direct sale created</h3>
                  <p className="text-xs text-muted-foreground">
                    Order {createdDirectSale.order.id} · {formatMoney(createdDirectSale.order.totalAmount, createdDirectSale.order.currency)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="w-fit">QR ready</Badge>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={createdDirectSale.attendees.some((attendee) => !qrImages[attendee.id])}
                    onClick={() => {
                      void downloadDirectSaleTicketZip({
                        sale: createdDirectSale,
                        qrImages,
                      })
                        .then(() => toast.success("Ticket ZIP downloaded"))
                        .catch((error) => {
                          toast.error(error instanceof Error ? error.message : "Failed to create ticket ZIP");
                        });
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download all PDFs
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {createdDirectSale.attendees.map((attendee, index) => (
                  <div key={attendee.id} className="rounded-lg border bg-background p-3">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">Ticket {index + 1}</p>
                        <p className="text-xs text-muted-foreground">{attendee.name}</p>
                      </div>
                      <Badge variant="outline" className="capitalize">{attendee.ticketType}</Badge>
                    </div>
                    {qrImages[attendee.id] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={qrImages[attendee.id]}
                        alt={`QR code for ${attendee.name}`}
                        className="mx-auto h-44 w-44 rounded-md bg-white p-2"
                      />
                    )}
                    <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">
                      {attendee.qrHash}
                    </p>
                    {qrImages[attendee.id] && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3 w-full"
                        onClick={() =>
                          downloadDirectSaleTicketPdf({
                            attendee,
                            order: createdDirectSale.order,
                            qrDataUrl: qrImages[attendee.id],
                            ticketPrice: formatMoney(
                              Math.round(createdDirectSale.order.totalAmount / createdDirectSale.attendees.length),
                              createdDirectSale.order.currency,
                            ),
                          })
                        }
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download ticket PDF
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => startEditing(ticket)}
                          disabled={updatingId === ticket.id || deletingId === ticket.id}
                        >
                          <Pencil />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setTicketActive(ticket, !ticket.active)}
                          disabled={updatingId === ticket.id || deletingId === ticket.id}
                        >
                          {updatingId === ticket.id ? <Loader2 className="animate-spin" /> : null}
                          {ticket.active ? "Deactivate" : "Activate"}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteTicketType(ticket)}
                          disabled={
                            deletingId === ticket.id ||
                            updatingId === ticket.id ||
                            ticket.soldCount > 0 ||
                            ticket.reservedCount > 0
                          }
                          title={
                            ticket.soldCount > 0 || ticket.reservedCount > 0
                              ? "Deactivate ticket types that already have sales or reservations"
                              : "Delete ticket type"
                          }
                        >
                          {deletingId === ticket.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                          Delete
                        </Button>
                      </div>
                    </div>
                    {editingId === ticket.id && editForm && (
                      <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor={`ticket-edit-name-${ticket.id}`}>Name</Label>
                          <Input
                            id={`ticket-edit-name-${ticket.id}`}
                            value={editForm.name}
                            onChange={(event) => updateEditField("name", event.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`ticket-edit-slug-${ticket.id}`}>Slug</Label>
                          <Input
                            id={`ticket-edit-slug-${ticket.id}`}
                            value={editForm.slug}
                            onChange={(event) => updateEditField("slug", slugify(event.target.value))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`ticket-edit-price-${ticket.id}`}>Price</Label>
                          <Input
                            id={`ticket-edit-price-${ticket.id}`}
                            inputMode="numeric"
                            value={editForm.price}
                            onChange={(event) => updateEditField("price", event.target.value)}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label htmlFor={`ticket-edit-capacity-${ticket.id}`}>Capacity</Label>
                            <Input
                              id={`ticket-edit-capacity-${ticket.id}`}
                              inputMode="numeric"
                              value={editForm.capacity}
                              onChange={(event) => updateEditField("capacity", event.target.value)}
                              placeholder="Unlimited"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`ticket-edit-max-${ticket.id}`}>Max / order</Label>
                            <Input
                              id={`ticket-edit-max-${ticket.id}`}
                              inputMode="numeric"
                              value={editForm.maxPerOrder}
                              onChange={(event) => updateEditField("maxPerOrder", event.target.value)}
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                          <Label htmlFor={`ticket-edit-description-${ticket.id}`}>Description</Label>
                          <Textarea
                            id={`ticket-edit-description-${ticket.id}`}
                            value={editForm.description}
                            onChange={(event) => updateEditField("description", event.target.value)}
                            placeholder="Optional public description"
                          />
                        </div>
                        <div className="flex flex-wrap justify-end gap-2 md:col-span-2">
                          <Button type="button" variant="outline" onClick={cancelEditing}>
                            <X />
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            onClick={() => saveTicketType(ticket)}
                            disabled={updatingId === ticket.id}
                          >
                            {updatingId === ticket.id ? <Loader2 className="animate-spin" /> : <Save />}
                            Save
                          </Button>
                        </div>
                      </div>
                    )}
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
