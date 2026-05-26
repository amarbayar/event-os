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
import { Download, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { validateRequired, validateEmail, getApiError } from "@/lib/validation";

type InvitationType = "special_guest" | "speaker_invitee" | "organizer_invitee" | "student" | "vip";
type InvitationStatus = "pending" | "sent" | "accepted" | "declined";

const typeConfig: Record<InvitationType, { label: string; color: string }> = {
  special_guest: { label: "Special Guest", color: "bg-violet-100 text-violet-700" },
  speaker_invitee: { label: "Speaker +1", color: "bg-sky-100 text-sky-700" },
  organizer_invitee: { label: "Organizer +1", color: "bg-yellow-100 text-yellow-700" },
  student: { label: "Student", color: "bg-emerald-100 text-emerald-700" },
  vip: { label: "VIP", color: "bg-pink-100 text-pink-700" },
};

const statusConfig: Record<InvitationStatus, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-stone-100 text-stone-600" },
  sent: { label: "Sent", color: "bg-sky-50 text-sky-700" },
  accepted: { label: "Accepted", color: "bg-emerald-50 text-emerald-700" },
  declined: { label: "Declined", color: "bg-red-50 text-red-600" },
};

// Allocation config
const allocationConfig = {
  speakerInvitees: 2,   // per accepted speaker
  organizerInvitees: 2, // per organizer
};

type Invitation = {
  id: string;
  name: string;
  email: string | null;
  type: string;
  status: string;
  invitedBy: string | null;
  sourceType: string | null;
  qrHash: string | null;
};

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

function invitationFileName(invitation: Invitation) {
  const name = invitation.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `devsummit-2026-invitation-${name || invitation.id}.pdf`;
}

async function downloadInvitationTicketPdf(invitation: Invitation) {
  if (!invitation.qrHash) {
    throw new Error("This invitation does not have a QR code yet");
  }

  const [{ jsPDF }, { toDataURL }] = await Promise.all([
    import("jspdf"),
    import("qrcode"),
  ]);
  const [logoDataUrl, qrDataUrl] = await Promise.all([
    loadImageDataUrl("/logo.png"),
    toDataURL(invitation.qrHash, {
      width: 280,
      margin: 1,
      color: { dark: "#111827", light: "#ffffff" },
    }),
  ]);

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const invitationType =
    typeConfig[invitation.type as InvitationType]?.label || invitation.type;

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
  doc.text("DevSummit 2026 Guest Pass", 70, 190);
  doc.setFontSize(13);
  doc.setTextColor("#556070");
  doc.text("Show this QR code at registration for check-in.", 70, 214);

  doc.setFillColor("#F7F9FC");
  doc.roundedRect(70, 248, 220, 220, 12, 12, "F");
  doc.addImage(qrDataUrl, "PNG", 88, 266, 184, 184, undefined, "FAST");

  const detailsX = 324;
  const detailRows = [
    ["Guest", invitation.name],
    ["Invitation type", invitationType],
    ["Invited by", invitation.invitedBy || "DevSummit"],
    ["Invitation ID", invitation.id],
  ];

  detailRows.forEach(([label, value], index) => {
    const y = 264 + index * 62;
    doc.setTextColor("#7A8494");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(label.toUpperCase(), detailsX, y);
    doc.setTextColor("#0B1020");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(index === 3 ? 9 : 14);
    doc.text(doc.splitTextToSize(value, 190).slice(0, 2), detailsX, y + 20);
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
      "If your QR code cannot be scanned, organizers can look up your guest pass by name, email, invitation ID, or QR code.",
      pageWidth - 188,
    ),
    94,
    572,
  );

  doc.setTextColor("#B9C3D5");
  doc.setFontSize(10);
  doc.text("devsummit.dev", 44, pageHeight - 42);
  doc.text("DevSummit guest registration", pageWidth - 180, pageHeight - 42);
  doc.save(invitationFileName(invitation));
}

export function InvitationsClient({ initialInvitations }: { initialInvitations: Invitation[] }) {
  const [typeFilter, setTypeFilter] = useState<InvitationType | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filtered = typeFilter === "all" ? initialInvitations : initialInvitations.filter((i) => i.type === typeFilter);

  const counts = {
    total: initialInvitations.length,
    accepted: initialInvitations.filter((i) => i.status === "accepted").length,
    sent: initialInvitations.filter((i) => i.status === "sent").length,
    pending: initialInvitations.filter((i) => i.status === "pending").length,
    withQr: initialInvitations.filter((i) => i.qrHash).length,
  };

  // Allocation tracking
  const speakerAllocUsed = initialInvitations.filter((i) => i.type === "speaker_invitee").length;
  const speakerAllocTotal = 4 * allocationConfig.speakerInvitees; // 4 accepted speakers * 2
  const organizerAllocUsed = initialInvitations.filter((i) => i.type === "organizer_invitee").length;
  const organizerAllocTotal = 3 * allocationConfig.organizerInvitees; // 3 organizers * 2

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = Object.fromEntries(form);

    const newErrors = validateRequired(data, ["name"]);
    const emailErr = validateEmail(data.email, "Email");
    if (emailErr) newErrors.email = emailErr;
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});

    const res = await fetch("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      toast.error(await getApiError(res, "Failed to create invitation"));
      return;
    }

    setShowForm(false);
    window.location.reload();
  };

  return (
    <div>
      <div className="mb-6 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Invitations</h1>
          <p className="text-sm text-muted-foreground">Special guests, speaker/organizer invitees, and student passes</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? <><X className="mr-2 h-3 w-3" /> Cancel</> : <><Plus className="mr-2 h-3 w-3" /> Invite Guest</>}
          </Button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input name="name" placeholder="e.g., Bat-Erdene D." aria-invalid={!!errors.name} onChange={() => setErrors((prev) => { const next = { ...prev }; delete next.name; return next; })} />
                  {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select name="type" defaultValue="special_guest">
                    <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="special_guest">Special Guest</SelectItem>
                      <SelectItem value="speaker_invitee">Speaker Invitee</SelectItem>
                      <SelectItem value="organizer_invitee">Organizer Invitee</SelectItem>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="vip">VIP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input name="email" type="email" placeholder="guest@email.mn" aria-invalid={!!errors.email} onChange={() => setErrors((prev) => { const next = { ...prev }; delete next.email; return next; })} />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Invited By</Label>
                  <Input name="invitedBy" placeholder="e.g., Organizer name" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea name="notes" placeholder="Any notes about this invitation..." rows={2} />
              </div>
              <Button type="submit" className="w-full sm:w-auto">Add Invitation</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Stats + Allocations */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 mb-4">
        <Card><CardContent className="p-4"><p className="text-2xl font-semibold tabular-nums">{counts.total}</p><p className="text-xs text-muted-foreground">Total Invitations</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-semibold tabular-nums text-emerald-600">{counts.accepted}</p><p className="text-xs text-muted-foreground">Accepted</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-semibold tabular-nums text-sky-600">{counts.withQr}</p><p className="text-xs text-muted-foreground">QR Generated</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-semibold tabular-nums text-yellow-600">{counts.pending}</p><p className="text-xs text-muted-foreground">Pending</p></CardContent></Card>
      </div>

      {/* Allocation tracking */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <h3 className="text-sm font-medium mb-3">Invitation Allocations</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Speaker invitees ({allocationConfig.speakerInvitees}/speaker)</span>
                <span className="font-medium tabular-nums">{speakerAllocUsed} / {speakerAllocTotal}</span>
              </div>
              <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                <div className="h-full bg-sky-500 rounded-full" style={{ width: `${speakerAllocTotal > 0 ? (speakerAllocUsed / speakerAllocTotal) * 100 : 0}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Organizer invitees ({allocationConfig.organizerInvitees}/organizer)</span>
                <span className="font-medium tabular-nums">{organizerAllocUsed} / {organizerAllocTotal}</span>
              </div>
              <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${organizerAllocTotal > 0 ? (organizerAllocUsed / organizerAllocTotal) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Type filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Button variant={typeFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setTypeFilter("all")}>All</Button>
        {(Object.keys(typeConfig) as InvitationType[]).map((type) => (
          <Button key={type} variant={typeFilter === type ? "default" : "outline"} size="sm" onClick={() => setTypeFilter(type)}>
            {typeConfig[type].label} ({initialInvitations.filter((i) => i.type === type).length})
          </Button>
        ))}
      </div>

      {/* Invitation list */}
      <div className="space-y-2">
        {filtered.map((inv) => (
          <Card key={inv.id} className="hover:border-yellow-500/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{inv.name}</p>
                    <Badge className={typeConfig[inv.type as InvitationType]?.color}>{typeConfig[inv.type as InvitationType]?.label ?? inv.type}</Badge>
                    <Badge className={statusConfig[inv.status as InvitationStatus]?.color}>{statusConfig[inv.status as InvitationStatus]?.label ?? inv.status}</Badge>
                    {inv.qrHash && <Badge variant="outline" className="text-[10px]">QR Ready</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Invited by {inv.invitedBy}
                    {inv.email && <> &middot; {inv.email}</>}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {inv.qrHash ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void downloadInvitationTicketPdf(inv).catch((error) => {
                          toast.error(error instanceof Error ? error.message : "Failed to download invitation PDF");
                        });
                      }}
                    >
                      <Download className="mr-1 h-3 w-3" />
                      Download QR PDF
                    </Button>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      QR missing
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
