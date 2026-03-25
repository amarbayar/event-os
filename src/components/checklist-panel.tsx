"use client";

import { useState, useEffect } from "react";
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
            placeholder={`Enter ${item.name.toLowerCase()}...`}
            className="text-xs"
          />
        ) : (
          <Input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={item.itemType === "file_upload" ? "Paste file URL..." : item.itemType === "link" ? "Paste URL..." : "Enter value..."}
            className="text-xs h-8"
          />
        )}
        <div className="flex gap-2">
          <Button size="sm" className="h-7 text-xs" disabled={!value.trim()} onClick={() => {
            onSubmit(item.id, value.trim());
            setValue("");
            setShowInput(false);
          }}>
            Submit
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setShowInput(false); setValue(""); }}>
            Cancel
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
          placeholder="What needs to be changed?"
          className="text-xs"
        />
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs text-orange-600" disabled={!rejectNotes.trim()} onClick={() => {
            onReject(item.id, rejectNotes.trim());
            setRejectNotes("");
            setShowReject(false);
          }}>
            Send feedback
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setShowReject(false); setRejectNotes(""); }}>
            Cancel
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
            Confirm
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowInput(true)}>
            {item.status === "needs_revision" ? "Re-submit" : "Submit"}
          </Button>
        )
      )}
      {item.status === "submitted" && (
        <>
          <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => onApprove(item.id)}>
            Approve
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs text-orange-600" onClick={() => setShowReject(true)}>
            Request revision
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

const statusConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  pending: { icon: Circle, color: "text-stone-300", label: "Pending" },
  submitted: { icon: Clock, color: "text-sky-500", label: "Submitted" },
  approved: { icon: CheckCircle2, color: "text-emerald-500", label: "Approved" },
  needs_revision: { icon: AlertCircle, color: "text-orange-500", label: "Needs revision" },
  archived: { icon: Circle, color: "text-stone-200", label: "Archived" },
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
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = () => {
    setLoading(true);
    fetch(`/api/checklist-items?entityType=${entityType}&entityId=${entityId}`)
      .then((r) => r.json())
      .then((d) => { if (d.data) setItems(d.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (entityId) fetchItems();
  }, [entityId, entityType]);

  const handleSubmit = async (itemId: string, value: string) => {
    await fetch(`/api/checklist-items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "submitted", value }),
    });
    fetchItems();
  };

  const handleApprove = async (itemId: string) => {
    await fetch(`/api/checklist-items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    fetchItems();
  };

  const handleReject = async (itemId: string, notes: string) => {
    await fetch(`/api/checklist-items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "needs_revision", notes }),
    });
    fetchItems();
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
          No checklist items yet. Checklist items are automatically created when the entity is confirmed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Progress header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{completed}/{total} completed</span>
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
                      Required
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
                  <p className="text-xs text-orange-600 mt-1">Feedback: {item.notes}</p>
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
        Checklist Progress ({progress.totalEntities} confirmed)
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
          {progress.zeroProgressCount} {entityType}(s) have 0 items completed
        </p>
      )}
    </div>
  );
}
