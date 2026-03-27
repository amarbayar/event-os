"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
import { Plus, Send, X } from "lucide-react";
import { toast } from "sonner";
import { validateRequired, validateEmail, getApiError } from "@/lib/validation";

type InvitationType = "special_guest" | "speaker_invitee" | "organizer_invitee" | "student" | "vip";
type InvitationStatus = "pending" | "sent" | "accepted" | "declined";

const typeColors: Record<InvitationType, string> = {
  special_guest: "bg-violet-100 text-violet-700",
  speaker_invitee: "bg-sky-100 text-sky-700",
  organizer_invitee: "bg-yellow-100 text-yellow-700",
  student: "bg-emerald-100 text-emerald-700",
  vip: "bg-pink-100 text-pink-700",
};

const statusColors: Record<InvitationStatus, string> = {
  pending: "bg-stone-100 text-stone-600",
  sent: "bg-sky-50 text-sky-700",
  accepted: "bg-emerald-50 text-emerald-700",
  declined: "bg-red-50 text-red-600",
};

const typeKeys: Record<InvitationType, string> = {
  special_guest: "typeSpecialGuest",
  speaker_invitee: "typeSpeakerPlus",
  organizer_invitee: "typeOrganizerPlus",
  student: "typeStudent",
  vip: "typeVip",
};

const statusKeys: Record<InvitationStatus, string> = {
  pending: "statusPending",
  sent: "statusSent",
  accepted: "statusAccepted",
  declined: "statusDeclined",
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

export function InvitationsClient({ initialInvitations }: { initialInvitations: Invitation[] }) {
  const t = useTranslations("Invitations");
  const tC = useTranslations("Common");
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
      toast.error(await getApiError(res, tC("failedTo", { action: "create invitation" })));
      return;
    }

    setShowForm(false);
    window.location.reload();
  };

  return (
    <div>
      <div className="mb-6 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Send className="mr-2 h-3 w-3" /> {t("sendBatch")}</Button>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? <><X className="mr-2 h-3 w-3" /> {tC("cancel")}</> : <><Plus className="mr-2 h-3 w-3" /> {t("inviteGuest")}</>}
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
                  <Label>{t("nameLabel")}</Label>
                  <Input name="name" placeholder="e.g., Bat-Erdene D." aria-invalid={!!errors.name} onChange={() => setErrors((prev) => { const { name: _, ...rest } = prev; return rest; })} />
                  {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>{t("typeLabel")}</Label>
                  <Select name="type" defaultValue="special_guest">
                    <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="special_guest">{t("typeSpecialGuest")}</SelectItem>
                      <SelectItem value="speaker_invitee">{t("speakerInvitee")}</SelectItem>
                      <SelectItem value="organizer_invitee">{t("organizerInvitee")}</SelectItem>
                      <SelectItem value="student">{t("typeStudent")}</SelectItem>
                      <SelectItem value="vip">{t("typeVip")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("emailLabel")}</Label>
                  <Input name="email" type="email" placeholder="guest@email.mn" aria-invalid={!!errors.email} onChange={() => setErrors((prev) => { const { email: _, ...rest } = prev; return rest; })} />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>{t("invitedByLabel")}</Label>
                  <Input name="invitedBy" placeholder="e.g., Organizer name" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t("notesLabel")}</Label>
                <Textarea name="notes" placeholder="" rows={2} />
              </div>
              <Button type="submit" className="w-full sm:w-auto">{t("addInvitation")}</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Stats + Allocations */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 mb-4">
        <Card><CardContent className="p-4"><p className="text-2xl font-semibold tabular-nums">{counts.total}</p><p className="text-xs text-muted-foreground">{t("totalInvitations")}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-semibold tabular-nums text-emerald-600">{counts.accepted}</p><p className="text-xs text-muted-foreground">{t("accepted")}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-semibold tabular-nums text-sky-600">{counts.withQr}</p><p className="text-xs text-muted-foreground">{t("qrGenerated")}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-semibold tabular-nums text-yellow-600">{counts.pending}</p><p className="text-xs text-muted-foreground">{t("pending")}</p></CardContent></Card>
      </div>

      {/* Allocation tracking */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <h3 className="text-sm font-medium mb-3">{t("allocations")}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">{t("speakerInvitees", { count: allocationConfig.speakerInvitees })}</span>
                <span className="font-medium tabular-nums">{speakerAllocUsed} / {speakerAllocTotal}</span>
              </div>
              <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                <div className="h-full bg-sky-500 rounded-full" style={{ width: `${speakerAllocTotal > 0 ? (speakerAllocUsed / speakerAllocTotal) * 100 : 0}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">{t("organizerInvitees", { count: allocationConfig.organizerInvitees })}</span>
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
        <Button variant={typeFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setTypeFilter("all")}>{tC("allSources") || "All"}</Button>
        {(Object.keys(typeColors) as InvitationType[]).map((type) => (
          <Button key={type} variant={typeFilter === type ? "default" : "outline"} size="sm" onClick={() => setTypeFilter(type)}>
            {t(typeKeys[type] as "typeSpecialGuest")} ({initialInvitations.filter((i) => i.type === type).length})
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
                    <Badge className={typeColors[inv.type as InvitationType]}>{t(typeKeys[inv.type as InvitationType] as "typeSpecialGuest") ?? inv.type}</Badge>
                    <Badge className={statusColors[inv.status as InvitationStatus]}>{t(statusKeys[inv.status as InvitationStatus] as "statusPending") ?? inv.status}</Badge>
                    {inv.qrHash && <Badge variant="outline" className="text-[10px]">{t("qrReady")}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {t("invitedBy", { name: inv.invitedBy || "" })}
                    {inv.email && <> &middot; {inv.email}</>}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {!inv.qrHash && inv.status !== "declined" && (
                    <Button size="sm" variant="outline">{t("generateQr")}</Button>
                  )}
                  {inv.status === "pending" && (
                    <Button size="sm"><Send className="mr-1 h-3 w-3" /> {t("send")}</Button>
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
