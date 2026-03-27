"use client";

import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AssignedToSelect } from "@/components/assigned-to-select";
import { useConfirm } from "@/components/confirm-dialog";
import { Plus, ChevronLeft, ChevronRight, X, Trash2, Calendar, Check } from "lucide-react";
import { toast } from "sonner";
import { validateRequired, getApiError } from "@/lib/validation";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";

type Campaign = {
  id: string;
  title: string;
  type: string;
  platform: string | null;
  status: string;
  scheduledDate: string | null;
  content: string | null;
  assignedTo: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-stone-300",
  scheduled: "bg-yellow-400",
  published: "bg-emerald-400",
  cancelled: "bg-red-300",
};

const PLATFORM_COLORS: Record<string, string> = {
  twitter: "bg-sky-100 text-sky-700",
  facebook: "bg-blue-100 text-blue-700",
  instagram: "bg-pink-100 text-pink-700",
  linkedin: "bg-indigo-100 text-indigo-700",
  telegram: "bg-cyan-100 text-cyan-700",
};

export function MarketingClient({ initialCampaigns }: { initialCampaigns: Campaign[] }) {
  const t = useTranslations("Marketing");
  const tC = useTranslations("Common");
  const locale = useLocale();
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createDate, setCreateDate] = useState("");

  const monthNames = useMemo(() =>
    Array.from({ length: 12 }, (_, i) =>
      new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(2024, i))
    ), [locale]);

  const dayNames = useMemo(() =>
    Array.from({ length: 7 }, (_, i) =>
      new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2024, 0, i))
    ), [locale]);

  const refreshCampaigns = async () => {
    const res = await fetch("/api/campaigns");
    if (!res.ok) return;
    const d = await res.json();
    if (d.data) setCampaigns(d.data);
  };

  // Calendar grid
  const calendarDays = useMemo(() => {
    const { year, month } = currentMonth;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const days: { date: string; day: number; isCurrentMonth: boolean }[] = [];

    const prevLastDay = new Date(year, month, 0).getDate();
    for (let i = startPad - 1; i >= 0; i--) {
      const d = prevLastDay - i;
      const m = month === 0 ? 11 : month - 1;
      const y = month === 0 ? year - 1 : year;
      days.push({ date: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, day: d, isCurrentMonth: false });
    }
    for (let d = 1; d <= totalDays; d++) {
      days.push({ date: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, day: d, isCurrentMonth: true });
    }
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const m = month === 11 ? 0 : month + 1;
      const y = month === 11 ? year + 1 : year;
      days.push({ date: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, day: d, isCurrentMonth: false });
    }
    return days;
  }, [currentMonth]);

  const getCampaignsForDate = (dateStr: string) => {
    return campaigns.filter((c) => {
      if (!c.scheduledDate) return false;
      // Compare just the date part (YYYY-MM-DD)
      const d = c.scheduledDate.slice(0, 10);
      return d === dateStr;
    });
  };

  const today = new Date().toISOString().split("T")[0];

  const counts = {
    total: campaigns.length,
    unscheduled: campaigns.filter((c) => !c.scheduledDate).length,
    scheduled: campaigns.filter((c) => c.scheduledDate && c.status !== "published").length,
    published: campaigns.filter((c) => c.status === "published").length,
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("subtitle", { total: counts.total, unscheduled: counts.unscheduled, scheduled: counts.scheduled, published: counts.published })}
          </p>
        </div>
        <Button size="sm" onClick={() => { setCreateDate(""); setShowCreate(true); }}>
          <Plus className="mr-2 h-3 w-3" /> {t("addCampaign")}
        </Button>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setCurrentMonth((p) => ({ year: p.month === 0 ? p.year - 1 : p.year, month: p.month === 0 ? 11 : p.month - 1 }))} className="rounded p-1.5 hover:bg-stone-100 transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold">{monthNames[currentMonth.month]} {currentMonth.year}</h2>
        <button onClick={() => setCurrentMonth((p) => ({ year: p.month === 11 ? p.year + 1 : p.year, month: p.month === 11 ? 0 : p.month + 1 }))} className="rounded p-1.5 hover:bg-stone-100 transition-colors">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 border-b bg-stone-50">
          {dayNames.map((day) => (
            <div key={day} className="px-2 py-2 text-center text-xs font-medium text-stone-500">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {calendarDays.map((day, i) => {
            const dayCampaigns = getCampaignsForDate(day.date);
            const isToday = day.date === today;
            return (
              <div
                key={i}
                onClick={() => { setCreateDate(day.date); setShowCreate(true); }}
                className={`min-h-[100px] border-b border-r p-1.5 cursor-pointer transition-colors hover:bg-yellow-50/30 ${
                  !day.isCurrentMonth ? "bg-stone-50/50" : ""
                } ${isToday ? "bg-yellow-50/50" : ""}`}
              >
                <div className="mb-1">
                  <span className={`text-xs tabular-nums ${
                    isToday ? "bg-yellow-500 text-white rounded-full w-5 h-5 inline-flex items-center justify-center font-medium" :
                    !day.isCurrentMonth ? "text-stone-300" : "text-stone-600"
                  }`}>
                    {day.day}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {dayCampaigns.slice(0, 3).map((c) => (
                    <button
                      key={c.id}
                      onClick={(e) => { e.stopPropagation(); setSelectedCampaign(c); }}
                      className={`w-full text-left rounded px-1.5 py-0.5 text-[10px] font-medium truncate transition-colors hover:opacity-80 ${
                        PLATFORM_COLORS[c.platform || ""] || "bg-stone-100 text-stone-600"
                      }`}
                    >
                      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${STATUS_COLORS[c.status] || "bg-stone-300"}`} />
                      {c.title}
                    </button>
                  ))}
                  {dayCampaigns.length > 3 && (
                    <span className="text-[9px] text-stone-400 pl-1">{t("moreItems", { count: dayCampaigns.length - 3 })}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Unscheduled items */}
      {counts.unscheduled > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium mb-2 text-stone-500">{t("unscheduled", { count: counts.unscheduled })}</h3>
          <div className="flex flex-wrap gap-2">
            {campaigns.filter((c) => !c.scheduledDate).map((c) => (
              <button key={c.id} onClick={() => setSelectedCampaign(c)} className="rounded-md border px-3 py-1.5 text-xs hover:border-yellow-400 transition-colors flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[c.status]}`} />
                {c.title}
                {c.platform && <Badge className={`${PLATFORM_COLORS[c.platform]} text-[9px] px-1`}>{c.platform}</Badge>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Create Dialog */}
      {showCreate && (
        <CreateDialog
          initialDate={createDate}
          onClose={() => setShowCreate(false)}
          onCreate={async (data) => {
            const res = await fetch("/api/campaigns", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });
            if (!res.ok) {
              toast.error(await getApiError(res, tC("failedTo", { action: t("addCampaign").toLowerCase() })));
              return;
            }
            setShowCreate(false);
            refreshCampaigns();
          }}
        />
      )}

      {/* Detail Drawer */}
      {selectedCampaign && (
        <DetailDrawer
          campaign={selectedCampaign}
          onClose={() => setSelectedCampaign(null)}
          onSaved={(updated) => {
            setCampaigns((prev) => prev.map((c) => c.id === updated.id ? updated : c));
            setSelectedCampaign(null);
          }}
          onDeleted={() => {
            setCampaigns((prev) => prev.filter((c) => c.id !== selectedCampaign.id));
            setSelectedCampaign(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Create Dialog ───────────────────────────────────

function CreateDialog({ initialDate, onClose, onCreate }: {
  initialDate: string;
  onClose: () => void;
  onCreate: (data: Record<string, string>) => void;
}) {
  const t = useTranslations("Marketing");
  const tC = useTranslations("Common");
  const [form, setForm] = useState({
    title: "",
    type: "social_post",
    platform: "twitter",
    content: "",
    scheduledDate: initialDate,
    assignedTo: "",
    status: initialDate ? "scheduled" : "draft",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{t("newItem")}</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-stone-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("titleLabel")}</Label>
            <Input autoFocus value={form.title} onChange={(e) => { setForm({ ...form, title: e.target.value }); setErrors((prev) => { const { title: _, ...rest } = prev; return rest; }); }} placeholder={t("titlePlaceholder")} aria-invalid={!!errors.title} />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>{t("notesContent")}</Label>
            <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder={t("contentPlaceholder")} rows={4} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("type")}</Label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="speaker_announcement">{t("typeSpeakerAnnouncement")}</option>
                <option value="sponsor_promo">{t("typeSponsorPromo")}</option>
                <option value="event_update">{t("typeEventUpdate")}</option>
                <option value="social_post">{t("typeSocialPost")}</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("platform")}</Label>
              <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="twitter">{t("platformTwitter")}</option>
                <option value="facebook">{t("platformFacebook")}</option>
                <option value="instagram">{t("platformInstagram")}</option>
                <option value="linkedin">{t("platformLinkedin")}</option>
                <option value="telegram">{t("platformTelegram")}</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("date")}</Label>
              <Input type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("assignedTo")}</Label>
              <AssignedToSelect value={form.assignedTo} onChange={(val) => setForm({ ...form, assignedTo: val })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>{tC("cancel")}</Button>
            <Button onClick={() => {
              const newErrors = validateRequired(form, ["title"]);
              if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
              setErrors({});
              onCreate(form);
            }}>{tC("create")}</Button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Detail Drawer ───────────────────────────────────

function DetailDrawer({ campaign, onClose, onSaved, onDeleted }: {
  campaign: Campaign;
  onClose: () => void;
  onSaved: (updated: Campaign) => void;
  onDeleted: () => void;
}) {
  const t = useTranslations("Marketing");
  const tC = useTranslations("Common");
  const { confirm: confirmDialog } = useConfirm();
  const [form, setForm] = useState({
    title: campaign.title,
    type: campaign.type,
    platform: campaign.platform || "twitter",
    content: campaign.content || "",
    status: campaign.status,
    scheduledDate: campaign.scheduledDate ? campaign.scheduledDate.slice(0, 10) : "",
    assignedTo: campaign.assignedTo || "",
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSave = async () => {
    const res = await fetch(`/api/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "If-Match": "999" },
      body: JSON.stringify({
        title: form.title,
        type: form.type,
        platform: form.platform,
        content: form.content || null,
        status: form.status,
        scheduledDate: form.scheduledDate || null,
        assignedTo: form.assignedTo || null,
      }),
    });
    const d = await res.json();
    if (res.ok && d.data) {
      onSaved(d.data);
    } else {
      toast.error(d.message || d.error || tC("failedTo", { action: tC("save").toLowerCase() }));
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirmDialog({
      title: t("deleteTitle"),
      message: t("deleteMessage", { title: campaign.title }),
      confirmLabel: tC("delete"),
      variant: "danger",
    });
    if (!confirmed) return;
    await fetch(`/api/campaigns/${campaign.id}`, { method: "DELETE" });
    onDeleted();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-background border-l shadow-xl flex flex-col">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            {campaign.platform && <Badge className={`text-[10px] ${PLATFORM_COLORS[campaign.platform] || "bg-stone-100"}`}>{campaign.platform}</Badge>}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={handleDelete} className="rounded p-1.5 hover:bg-red-50 text-stone-400 hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
            <button onClick={onClose} className="rounded p-1.5 hover:bg-stone-100"><X className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="text-lg font-medium border-0 px-0 focus-visible:ring-0 shadow-none" placeholder={t("titleInputPlaceholder")} />

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">{t("notesContent")}</Label>
            <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder={t("contentPlaceholder")} rows={6} className="resize-none" />
          </div>

          <div className="space-y-3 pt-2 border-t">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t("status")}</Label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="draft">{t("statusDraft")}</option>
                  <option value="scheduled">{t("statusScheduled")}</option>
                  <option value="published">{t("statusPublished")}</option>
                  <option value="cancelled">{t("statusCancelled")}</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t("platform")}</Label>
                <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="twitter">{t("platformTwitter")}</option>
                  <option value="facebook">{t("platformFacebook")}</option>
                  <option value="instagram">{t("platformInstagram")}</option>
                  <option value="linkedin">{t("platformLinkedin")}</option>
                  <option value="telegram">{t("platformTelegram")}</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t("date")}</Label>
                <Input type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t("assignedTo")}</Label>
                <AssignedToSelect value={form.assignedTo} onChange={(val) => setForm({ ...form, assignedTo: val })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("type")}</Label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="speaker_announcement">{t("typeSpeakerAnnouncement")}</option>
                <option value="sponsor_promo">{t("typeSponsorPromo")}</option>
                <option value="event_update">{t("typeEventUpdate")}</option>
                <option value="social_post">{t("typeSocialPost")}</option>
              </select>
            </div>
          </div>

          {form.status === "draft" && (
            <div className="flex gap-2 pt-2 border-t">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setForm({ ...form, status: "scheduled" })}>
                <Calendar className="mr-2 h-3 w-3" /> {t("markScheduled")}
              </Button>
              <Button size="sm" className="flex-1" onClick={() => setForm({ ...form, status: "published" })}>
                <Check className="mr-2 h-3 w-3" /> {t("markDone")}
              </Button>
            </div>
          )}
        </div>

        <div className="border-t px-4 py-3">
          <Button className="w-full" onClick={handleSave}>{t("saveChanges")}</Button>
        </div>
      </aside>
    </>
  );
}
