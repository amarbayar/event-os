"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  Upload,
  Link,
  Type,
  Check,
  Clock,
} from "lucide-react";

// ─── Inline item actions (no system alerts) ─────────────

function ChecklistItemActions({
  item,
  onSubmit,
  onApprove,
  onReject,
}: {
  item: { id: string; status: string; itemType: string; name: string };
  onSubmit: (id: string, value: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string, notes: string) => void;
}) {
  const t = useTranslations("Checklist");
  const tC = useTranslations("Common");
  const [showInput, setShowInput] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [value, setValue] = useState("");
  const [rejectNotes, setRejectNotes] = useState("");

  if (item.status === "approved" || item.status === "archived") return null;

  // Submit / re-submit form
  if ((item.status === "pending" || item.status === "needs_revision") && showInput) {
    return (
      <div className="mt-2 space-y-2">
        {item.itemType === "text_input" ? (
          <Textarea
            autoFocus
            rows={2}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t("enterValue", { name: item.name.toLowerCase() })}
            className="text-xs"
          />
        ) : (
          <Input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={item.itemType === "file_upload" ? t("pasteFileUrl") : item.itemType === "link" ? t("pasteUrl") : t("enterGeneric")}
            className="text-xs h-8"
          />
        )}
        <div className="flex gap-2">
          <Button size="sm" className="h-7 text-xs" disabled={!value.trim()} onClick={() => {
            onSubmit(item.id, value.trim());
            setValue("");
            setShowInput(false);
          }}>
            {t("submit")}
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setShowInput(false); setValue(""); }}>
            {tC("cancel")}
          </Button>
        </div>
      </div>
    );
  }

  // Reject form (organizer feedback)
  if (item.status === "submitted" && showReject) {
    return (
      <div className="mt-2 space-y-2">
        <Textarea
          autoFocus
          rows={2}
          value={rejectNotes}
          onChange={(e) => setRejectNotes(e.target.value)}
          placeholder={t("whatNeedsChanging")}
          className="text-xs"
        />
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs text-orange-600" disabled={!rejectNotes.trim()} onClick={() => {
            onReject(item.id, rejectNotes.trim());
            setRejectNotes("");
            setShowReject(false);
          }}>
            {t("sendFeedback")}
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setShowReject(false); setRejectNotes(""); }}>
            {tC("cancel")}
          </Button>
        </div>
      </div>
    );
  }

  // Action buttons
  return (
    <div className="flex gap-2 mt-2">
      {(item.status === "pending" || item.status === "needs_revision") && (
        item.itemType === "confirmation" ? (
          <Button size="sm" className="h-7 text-xs" onClick={() => onSubmit(item.id, "true")}>
            {tC("confirm")}
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowInput(true)}>
            {item.status === "needs_revision" ? t("resubmit") : t("submit")}
          </Button>
        )
      )}
      {item.status === "submitted" && (
        <>
          <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => onApprove(item.id)}>
            {t("approve")}
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs text-orange-600" onClick={() => setShowReject(true)}>
            {t("requestRevision")}
          </Button>
        </>
      )}
    </div>
  );
}

type ChecklistItem = {
  id: string;
  name: string;
  description: string | null;
  itemType: string;
  required: boolean;
  status: string;
  value: string | null;
  notes: string | null;
  sortOrder: number;
  dueOffsetDays: number | null;
  fieldKey: string | null;
};

const statusConfig: Record<string, { icon: React.ElementType; color: string; key: string }> = {
  pending: { icon: Circle, color: "text-stone-300", key: "statusPending" },
  submitted: { icon: Clock, color: "text-sky-500", key: "statusSubmitted" },
  approved: { icon: CheckCircle2, color: "text-emerald-500", key: "statusApproved" },
  needs_revision: { icon: AlertCircle, color: "text-orange-500", key: "statusNeedsRevision" },
  archived: { icon: Circle, color: "text-stone-200", key: "statusArchived" },
};

const typeIcons: Record<string, React.ElementType> = {
  file_upload: Upload,
  text_input: Type,
  link: Link,
  confirmation: Check,
  meeting: Clock,
};

export function ChecklistPanel({
  entityType,
  entityId,
}: {
  entityType: string;
  entityId: string;
}) {
  const t = useTranslations("Checklist");
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/checklist-items?entityType=${entityType}&entityId=${entityId}`
      );
      const data = await response.json();
      if (data.data) setItems(data.data);
    } catch {
      // Keep the current checklist state if refresh fails.
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType]);

  useEffect(() => {
    if (!entityId) return;
    const timeoutId = window.setTimeout(() => {
      void fetchItems();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [entityId, fetchItems]);

  const handleSubmit = async (itemId: string, value: string) => {
    await fetch(`/api/checklist-items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "submitted", value }),
    });
    await fetchItems();
  };

  const handleApprove = async (itemId: string) => {
    await fetch(`/api/checklist-items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    await fetchItems();
  };

  const handleReject = async (itemId: string, notes: string) => {
    await fetch(`/api/checklist-items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "needs_revision", notes }),
    });
    await fetchItems();
  };

  const activeItems = items.filter((i) => i.status !== "archived");
  const completed = activeItems.filter((i) => i.status === "submitted" || i.status === "approved").length;
  const total = activeItems.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded bg-stone-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (activeItems.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-muted-foreground">
          {t("noItems")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Progress header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{t("completed", { completed, total })}</span>
          <span className="text-muted-foreground">{percentage}%</span>
        </div>
        <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Items list */}
      <div className="space-y-2">
        {activeItems.map((item) => {
          const StatusIcon = statusConfig[item.status]?.icon || Circle;
          const statusColor = statusConfig[item.status]?.color || "text-stone-300";
          const TypeIcon = typeIcons[item.itemType] || Circle;

          return (
            <div
              key={item.id}
              className="flex items-start gap-3 rounded-md border px-3 py-2.5 hover:bg-accent/30 transition-colors"
            >
              <StatusIcon className={`h-5 w-5 mt-0.5 shrink-0 ${statusColor}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{item.name}</span>
                  <TypeIcon className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                  {item.required && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                      {t("required")}
                    </Badge>
                  )}
                </div>
                {item.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                )}
                {item.value && (
                  <p className="text-xs text-sky-600 mt-1 truncate">{item.value}</p>
                )}
                {item.notes && item.status === "needs_revision" && (
                  <p className="text-xs text-orange-600 mt-1">{t("feedback", { notes: item.notes })}</p>
                )}

                {/* Inline actions — no system alerts */}
                <ChecklistItemActions
                  item={item}
                  onSubmit={handleSubmit}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Progress Bars Component (for entity pages) ────────

export function ChecklistProgress({
  entityType,
}: {
  entityType: string;
}) {
  const t = useTranslations("Checklist");
  const [progress, setProgress] = useState<{
    templateProgress: Record<string, { total: number; done: number }>;
    totalEntities: number;
    zeroProgressCount: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/checklist-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType }),
    })
      .then((r) => r.json())
      .then((d) => { if (d.data) setProgress(d.data); })
      .catch(() => {});
  }, [entityType]);

  if (!progress || progress.totalEntities === 0) return null;

  const entries = Object.entries(progress.templateProgress);
  if (entries.length === 0) return null;

  return (
    <div className="rounded-lg border p-4 mb-4">
      <h3 className="text-sm font-medium mb-3">
        {t("progress", { count: progress.totalEntities })}
      </h3>
      <div className="space-y-2">
        {entries.map(([name, { total, done }]) => {
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          return (
            <div key={name} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-40 truncate">{name}</span>
              <div className="flex-1 h-2 rounded-full bg-stone-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${pct === 100 ? "bg-emerald-500" : "bg-yellow-500"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs tabular-nums w-12 text-right">{done}/{total}</span>
            </div>
          );
        })}
      </div>
      {progress.zeroProgressCount > 0 && (
        <p className="text-xs text-orange-600 mt-2">
          {t("zeroProgress", { count: progress.zeroProgressCount, entityType })}
        </p>
      )}
    </div>
  );
}
