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
import { AssignedToSelect } from "@/components/assigned-to-select";
import { Plus, ArrowRight, X } from "lucide-react";
import { toast } from "sonner";
import { validateRequired, validateEmail, getApiError } from "@/lib/validation";
import { useTranslations } from "next-intl";

type OutreachStatus = "identified" | "contacted" | "interested" | "negotiating" | "confirmed" | "declined" | "converted";
type TargetType = "speaker" | "sponsor" | "booth" | "volunteer" | "media";

const statusStyles: Record<OutreachStatus, { color: string }> = {
  identified: { color: "bg-stone-100 text-stone-600" },
  contacted: { color: "bg-sky-50 text-sky-700" },
  interested: { color: "bg-violet-50 text-violet-700" },
  negotiating: { color: "bg-yellow-50 text-yellow-700" },
  confirmed: { color: "bg-emerald-50 text-emerald-700" },
  declined: { color: "bg-red-50 text-red-600" },
  converted: { color: "bg-emerald-100 text-emerald-800" },
};

const STATUS_LABEL_KEYS: Record<OutreachStatus, string> = {
  identified: "statusIdentified",
  contacted: "statusContacted",
  interested: "statusInterested",
  negotiating: "statusNegotiating",
  confirmed: "statusConfirmed",
  declined: "statusDeclined",
  converted: "statusConverted",
};

const typeStyles: Record<TargetType, { color: string }> = {
  speaker: { color: "bg-sky-100 text-sky-800" },
  sponsor: { color: "bg-yellow-100 text-yellow-800" },
  booth: { color: "bg-violet-100 text-violet-800" },
  volunteer: { color: "bg-emerald-100 text-emerald-800" },
  media: { color: "bg-pink-100 text-pink-800" },
};

const TYPE_LABEL_KEYS: Record<TargetType, string> = {
  speaker: "targetSpeaker",
  sponsor: "targetSponsor",
  booth: "targetBooth",
  volunteer: "targetVolunteer",
  media: "targetMedia",
};

type OutreachRecord = {
  id: string;
  targetType: string;
  name: string;
  company: string | null;
  status: string;
  assignedTo: string | null;
  lastContactDate: Date | null;
  nextFollowUp: Date | null;
  source: string | null;
  notes: string | null;
};

export function OutreachClient({ initialOutreach }: { initialOutreach: OutreachRecord[] }) {
  const t = useTranslations("Outreach");
  const tC = useTranslations("Common");
  const tP = useTranslations("Pipeline");
  const [typeFilter, setTypeFilter] = useState<TargetType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<OutreachStatus | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filtered = initialOutreach
    .filter((o) => typeFilter === "all" || o.targetType === typeFilter)
    .filter((o) => statusFilter === "all" || o.status === statusFilter);

  const pipelineCounts = {
    identified: initialOutreach.filter((o) => o.status === "identified").length,
    contacted: initialOutreach.filter((o) => o.status === "contacted").length,
    interested: initialOutreach.filter((o) => o.status === "interested").length,
    negotiating: initialOutreach.filter((o) => o.status === "negotiating").length,
    confirmed: initialOutreach.filter((o) => o.status === "confirmed").length,
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = Object.fromEntries(form);

    const newErrors = validateRequired(data, ["name"]);
    const emailErr = validateEmail(data.email, "Email");
    if (emailErr) newErrors.email = emailErr;
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});

    const res = await fetch("/api/outreach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      toast.error(await getApiError(res, tC("failedTo", { action: tC("create") })));
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
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? <><X className="mr-2 h-3 w-3" /> {tC("cancel")}</> : <><Plus className="mr-2 h-3 w-3" /> {t("addLead")}</>}
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t("nameLabel")}</Label>
                  <Input name="name" placeholder="e.g., Jane Doe" aria-invalid={!!errors.name} onChange={() => setErrors((prev) => { const { name: _, ...rest } = prev; return rest; })} />
                  {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>{t("targetType")}</Label>
                  <Select name="targetType" defaultValue="speaker">
                    <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="speaker">{t("targetSpeaker")}</SelectItem>
                      <SelectItem value="sponsor">{t("targetSponsor")}</SelectItem>
                      <SelectItem value="booth">{t("targetBooth")}</SelectItem>
                      <SelectItem value="volunteer">{t("targetVolunteer")}</SelectItem>
                      <SelectItem value="media">{t("targetMedia")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("emailLabel")}</Label>
                  <Input name="email" type="email" placeholder="jane@company.com" aria-invalid={!!errors.email} onChange={() => setErrors((prev) => { const { email: _, ...rest } = prev; return rest; })} />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>{t("companyLabel")}</Label>
                  <Input name="company" placeholder="e.g., Acme Corp" />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("sourceLabel")}</Label>
                  <Input name="source" placeholder={t("sourcePlaceholder")} />
                </div>
                <div className="space-y-1.5">
                  <Label>{tP("assignedTo")}</Label>
                  <AssignedToSelect name="assignedTo" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{tP("notes")}</Label>
                <Textarea name="notes" placeholder={t("notesPlaceholder")} rows={2} />
              </div>
              <Button type="submit" className="w-full sm:w-auto">{t("addLead")}</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Pipeline funnel */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-2">
        {(["identified", "contacted", "interested", "negotiating", "confirmed"] as const).map((status, i) => (
          <div key={status} className="flex items-center shrink-0">
            <button
              onClick={() => setStatusFilter(statusFilter === status ? "all" : status)}
              className={`rounded-md px-3 py-2 text-center min-w-[90px] transition-colors ${
                statusFilter === status ? "ring-2 ring-yellow-500" : ""
              }`}
            >
              <p className="text-lg font-semibold tabular-nums">{pipelineCounts[status]}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t(STATUS_LABEL_KEYS[status])}</p>
            </button>
            {i < 4 && <ArrowRight className="h-4 w-4 text-stone-300 shrink-0 mx-1" />}
          </div>
        ))}
      </div>

      {/* Type filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Button variant={typeFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setTypeFilter("all")}>{t("all")}</Button>
        {(Object.keys(typeStyles) as TargetType[]).map((type) => (
          <Button key={type} variant={typeFilter === type ? "default" : "outline"} size="sm" onClick={() => setTypeFilter(type)} className="capitalize">
            {t(TYPE_LABEL_KEYS[type])} ({initialOutreach.filter((o) => o.targetType === type).length})
          </Button>
        ))}
      </div>

      {/* Outreach list */}
      <div className="space-y-2">
        {filtered.map((lead) => (
          <Card key={lead.id} className="hover:border-yellow-500/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{lead.name}</p>
                    <Badge className={typeStyles[lead.targetType as TargetType]?.color}>{t(TYPE_LABEL_KEYS[lead.targetType as TargetType]) ?? lead.targetType}</Badge>
                    <Badge className={statusStyles[lead.status as OutreachStatus]?.color}>{t(STATUS_LABEL_KEYS[lead.status as OutreachStatus]) ?? lead.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{lead.company} &middot; {t("sourceLabel")}: {lead.source}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{lead.notes}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span>{t("assigned", { name: lead.assignedTo ?? "" })}</span>
                    {lead.lastContactDate && <span>{t("lastContact", { date: new Date(lead.lastContactDate).toLocaleDateString() })}</span>}
                    {lead.nextFollowUp && (
                      <span className="text-yellow-600 font-medium">{t("followUp", { date: new Date(lead.nextFollowUp).toLocaleDateString() })}</span>
                    )}
                  </div>
                </div>
              </div>
              {lead.status !== "confirmed" && lead.status !== "declined" && lead.status !== "converted" && (
                <div className="flex gap-2 mt-3 sm:justify-end">
                  <Button size="sm" variant="outline" className="flex-1 sm:flex-none">{t("logContact")}</Button>
                  <Button size="sm" variant="outline" className="flex-1 sm:flex-none">{t("updateStatus")}</Button>
                  {(lead.status === "interested" || lead.status === "negotiating") && (
                    <Button size="sm" className="flex-1 sm:flex-none">{t("convertToApplication")}</Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
