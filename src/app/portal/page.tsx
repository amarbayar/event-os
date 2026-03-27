"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { formatDate } from "@/lib/i18n/date";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  Clock,
  Upload,
  MapPin,
  Calendar,
  Mic2,
  LogOut,
} from "lucide-react";

type ChecklistItem = {
  id: string;
  name: string;
  description: string | null;
  itemType: string;
  required: boolean;
  status: string;
  value: string | null;
  notes: string | null;
  fieldKey: string | null;
};

type PortalData = {
  user: { name: string; email: string; role: string; linkedEntityType: string; linkedEntityId: string };
  entity: Record<string, unknown>;
  edition: { name: string; startDate: string | null; endDate: string | null; venue: string | null };
  checklistItems: ChecklistItem[];
};

const statusConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  pending: { icon: Circle, color: "text-stone-400", bg: "bg-stone-50" },
  submitted: { icon: Clock, color: "text-sky-600", bg: "bg-sky-50" },
  approved: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
  needs_revision: { icon: AlertCircle, color: "text-orange-600", bg: "bg-orange-50" },
};

// ─── Profile Section (editable entity fields) ──────────

function ProfileSection({
  entity,
  entityType,
  onUpdate,
}: {
  entity: Record<string, unknown>;
  entityType: string;
  onUpdate: () => void;
}) {
  const t = useTranslations("Portal");
  const tc = useTranslations("Common");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Fields shown per entity type
  const fieldsByType: Record<string, { key: string; labelKey: string; type: "text" | "textarea" | "url" }[]> = {
    speaker: [
      { key: "name", labelKey: "fullName", type: "text" },
      { key: "bio", labelKey: "bio", type: "textarea" },
      { key: "talkTitle", labelKey: "talkTitle", type: "text" },
      { key: "talkAbstract", labelKey: "talkAbstract", type: "textarea" },
      { key: "phone", labelKey: "phone", type: "text" },
      { key: "linkedin", labelKey: "linkedin", type: "url" },
      { key: "website", labelKey: "website", type: "url" },
    ],
    sponsor: [
      { key: "contactName", labelKey: "contactName", type: "text" },
      { key: "contactEmail", labelKey: "contactEmail", type: "text" },
      { key: "message", labelKey: "companyDescription", type: "textarea" },
    ],
    volunteer: [
      { key: "name", labelKey: "fullName", type: "text" },
      { key: "phone", labelKey: "phone", type: "text" },
    ],
    media: [
      { key: "contactName", labelKey: "contactName", type: "text" },
      { key: "contactEmail", labelKey: "contactEmail", type: "text" },
    ],
  };

  const fields = fieldsByType[entityType] || [];
  if (fields.length === 0) return null;

  const startEditing = () => {
    const initial: Record<string, string> = {};
    for (const f of fields) {
      initial[f.key] = (entity[f.key] as string) || "";
    }
    setForm(initial);
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    await fetch("/api/portal/update-profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setEditing(false);
    onUpdate();
  };

  return (
    <div className="rounded-lg border bg-white p-6 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm uppercase tracking-wider text-stone-500">{t("yourProfile")}</h3>
        {!editing && (
          <Button variant="outline" size="sm" onClick={startEditing}>{tc("edit")}</Button>
        )}
      </div>
      {editing ? (
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <label className="text-xs font-medium text-stone-600">{t(f.labelKey as Parameters<typeof t>[0])}</label>
              {f.type === "textarea" ? (
                <Textarea
                  value={form[f.key] || ""}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  rows={3}
                />
              ) : (
                <Input
                  value={form[f.key] || ""}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={t(f.labelKey as Parameters<typeof t>[0])}
                />
              )}
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? t("saving") : t("saveChanges")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>{tc("cancel")}</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {fields.map((f) => {
            const val = entity[f.key] as string;
            return val ? (
              <div key={f.key} className="flex gap-2 text-sm">
                <span className="text-stone-400 w-28 shrink-0">{t(f.labelKey as Parameters<typeof t>[0])}</span>
                <span className="text-stone-700 truncate">{val}</span>
              </div>
            ) : null;
          })}
          {fields.every((f) => !(entity[f.key])) && (
            <p className="text-sm text-stone-400 italic">{t("noProfileInfo")}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Portal Item Input (explicit Submit button, no keyboard shortcuts) ──

function PortalItemInput({
  itemId,
  itemType,
  onSubmit,
}: {
  itemId: string;
  itemType: string;
  onSubmit: (id: string, value: string) => void;
}) {
  const t = useTranslations("Portal");
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (itemType === "confirmation") {
    return (
      <div className="mt-3">
        <Button size="sm" onClick={async () => { setSubmitting(true); await onSubmit(itemId, "true"); setSubmitting(false); }} disabled={submitting}>
          {submitting ? t("confirming") : t("confirm")}
        </Button>
      </div>
    );
  }

  const placeholder = itemType === "file_upload" ? t("pasteFileUrl")
    : itemType === "link" ? t("pasteUrl")
    : t("enterResponse");

  return (
    <div className="mt-3 space-y-2">
      {itemType === "text_input" ? (
        <Textarea value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} rows={3} />
      ) : (
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} />
      )}
      <Button
        size="sm"
        disabled={!value.trim() || submitting}
        onClick={async () => {
          setSubmitting(true);
          await onSubmit(itemId, value.trim());
          setValue("");
          setSubmitting(false);
        }}
      >
        {submitting ? t("submitting") : t("submit")}
      </Button>
    </div>
  );
}

export default function PortalPage() {
  const t = useTranslations("Portal");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/portal/me")
      .then((r) => {
        if (!r.ok) throw new Error("Not authorized");
        return r.json();
      })
      .then((d) => setData(d.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmitItem = async (itemId: string, value: string) => {
    await fetch(`/api/checklist-items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "submitted", value }),
    });
    // Refresh
    const r = await fetch("/api/portal/me");
    const d = await r.json();
    setData(d.data);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="animate-pulse text-stone-400">{t("loadingPortal")}</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-stone-600">{t("unableToLoad")}</p>
          <p className="text-sm text-stone-400">{t("pleaseSignIn")}</p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => window.location.reload()}>{t("tryAgain")}</Button>
            <Button onClick={() => window.location.href = "/login"}>{t("signIn")}</Button>
          </div>
        </div>
      </div>
    );
  }

  const { user, entity, edition, checklistItems } = data;
  const activeItems = checklistItems.filter((i) => i.status !== "archived");
  const completed = activeItems.filter((i) => i.status === "submitted" || i.status === "approved").length;
  const total = activeItems.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const entityName = (entity.name as string) || (entity.companyName as string) || (entity.contactName as string) || t("yourProfile");

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-lg font-bold">{edition.name}</h1>
            <p className="text-xs text-stone-500 capitalize">{t("portalLabel", { entityType: user.linkedEntityType })}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-stone-600">{user.name}</span>
            <Button variant="outline" size="sm" onClick={() => {
              fetch("/api/auth/signout", { method: "POST" }).then(() => window.location.href = "/login");
            }}>
              <LogOut className="h-3 w-3 mr-1" /> {t("signOut")}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Welcome + Progress */}
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {t("welcome", { name: user.name || entityName })}
          </h2>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{t("yourChecklist", { completed, total })}</span>
              <span className="text-stone-500">{pct}%</span>
            </div>
            <div className="h-3 rounded-full bg-stone-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? "bg-emerald-500" : "bg-yellow-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Checklist Items */}
        <div className="space-y-3">
          {activeItems.map((item) => {
            const cfg = statusConfig[item.status] || statusConfig.pending;
            const StatusIcon = cfg.icon;

            return (
              <div key={item.id} className={`rounded-lg border p-4 ${cfg.bg}`}>
                <div className="flex items-start gap-3">
                  <StatusIcon className={`h-5 w-5 mt-0.5 shrink-0 ${cfg.color}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{item.name}</span>
                      {item.required && (
                        <Badge variant="outline" className="text-[9px]">{t("required")}</Badge>
                      )}
                      {item.status === "approved" && (
                        <Badge className="bg-emerald-100 text-emerald-700 text-[9px]">{t("approved")}</Badge>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-xs text-stone-500 mt-1">{item.description}</p>
                    )}

                    {/* Show submitted value */}
                    {item.value && item.status !== "needs_revision" && (
                      <p className="text-xs text-sky-600 mt-2 break-all">{item.value}</p>
                    )}

                    {/* Revision feedback */}
                    {item.notes && item.status === "needs_revision" && (
                      <div className="mt-2 rounded bg-orange-100 px-3 py-2">
                        <p className="text-xs font-medium text-orange-800">{t("organizerFeedback")}</p>
                        <p className="text-xs text-orange-700 mt-0.5">{item.notes}</p>
                      </div>
                    )}

                    {/* Action for pending / needs_revision */}
                    {(item.status === "pending" || item.status === "needs_revision") && (
                      <PortalItemInput
                        itemId={item.id}
                        itemType={item.itemType}
                        onSubmit={handleSubmitItem}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Your Profile — editable fields */}
        <ProfileSection entity={entity} entityType={user.linkedEntityType} onUpdate={async () => {
          const r = await fetch("/api/portal/me");
          const d = await r.json();
          setData(d.data);
        }} />

        {/* Event Info */}
        <div className="rounded-lg border bg-white p-6 space-y-3">
          <h3 className="font-medium text-sm uppercase tracking-wider text-stone-500">{t("eventInfo")}</h3>
          {edition.venue && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-stone-400" />
              <span>{edition.venue}</span>
            </div>
          )}
          {edition.startDate && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-stone-400" />
              <span>
                {formatDate(edition.startDate, locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                {edition.endDate && ` — ${formatDate(edition.endDate, locale, { month: "long", day: "numeric" })}`}
              </span>
            </div>
          )}
        </div>

        {/* Completion message */}
        {pct === 100 && (
          <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50 p-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
            <p className="font-medium text-emerald-800">{t("allDone")}</p>
            <p className="text-sm text-emerald-600 mt-1">{t("organizerWillReview")}</p>
          </div>
        )}
      </main>
    </div>
  );
}
