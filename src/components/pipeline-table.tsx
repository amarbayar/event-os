"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/confirm-dialog";
import { Trash2, MoreHorizontal } from "lucide-react";

// ─── Types ───────────────────────────────────────────────

type Stage = "lead" | "engaged" | "confirmed" | "declined";
type Source = "intake" | "outreach" | "sponsored";

type Column<T> = {
  key: string;
  label: string;
  width?: string;
  render: (item: T) => React.ReactNode;
};

type PipelineTableProps<T extends { id: string; stage: string; source: string; assignedTo: string | null }> = {
  items: T[];
  columns: Column<T>[];
  entityName: string;
  apiEndpoint: string; // e.g., "/api/speakers"
  idEndpoint?: string; // e.g., "/api/speakers" (+ /[id]) for PATCH/DELETE
  onUpdate?: () => void; // called after any mutation
  onRowClick?: (item: T) => void; // opens detail drawer
};

// ─── Stage/Source badges ─────────────────────────────────

const stageColors: Record<string, string> = {
  lead: "bg-stone-100 text-stone-600 hover:bg-stone-200",
  engaged: "bg-sky-50 text-sky-700 hover:bg-sky-100",
  confirmed: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
  declined: "bg-red-50 text-red-600 hover:bg-red-100",
};

const sourceColors: Record<string, string> = {
  intake: "bg-violet-50 text-violet-700",
  outreach: "bg-sky-50 text-sky-700",
  sponsored: "bg-yellow-50 text-yellow-700",
};

const stages: Stage[] = ["lead", "engaged", "confirmed", "declined"];

// ─── Inline editable cell ────────────────────────────────

function InlineEdit({
  value,
  onSave,
  placeholder,
}: {
  value: string;
  onSave: (val: string) => void;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <input
        autoFocus
        className="w-full rounded border border-yellow-400 bg-yellow-50 px-1.5 py-0.5 text-xs outline-none"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft !== value) onSave(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setEditing(false);
            if (draft !== value) onSave(draft);
          }
          if (e.key === "Escape") {
            setEditing(false);
            setDraft(value);
          }
        }}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`cursor-pointer rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-yellow-50 ${
        value ? "" : "text-stone-300 italic"
      }`}
    >
      {value || placeholder || "Click to edit"}
    </span>
  );
}

// ─── Stage dropdown ──────────────────────────────────────

function StageDropdown({
  stage,
  onChange,
}: {
  stage: string;
  onChange: (newStage: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
          stageColors[stage] || stageColors.lead
        }`}
      >
        {stage}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 rounded-md border bg-white py-1 shadow-lg min-w-[100px]">
            {stages.map((s) => (
              <button
                key={s}
                onClick={() => {
                  onChange(s);
                  setOpen(false);
                }}
                className={`block w-full px-3 py-1 text-left text-xs capitalize transition-colors hover:bg-stone-50 ${
                  s === stage ? "font-medium text-yellow-700 bg-yellow-50" : ""
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Pipeline Table ──────────────────────────────────────

export function PipelineTable<
  T extends { id: string; stage: string; source: string; assignedTo: string | null }
>({ items, columns, entityName, apiEndpoint, idEndpoint, onUpdate, onRowClick }: PipelineTableProps<T>) {
  const patchEndpoint = idEndpoint || apiEndpoint;
  const { confirm } = useConfirm();

  const handlePatch = async (id: string, field: string, value: string) => {
    await fetch(`${patchEndpoint}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "If-Match": "999" }, // TODO: track version per row
      body: JSON.stringify({ [field]: value }),
    });
    onUpdate?.();
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: `Delete ${entityName}`,
      message: `Are you sure you want to remove this ${entityName}? This action cannot be undone.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) return;
    await fetch(`${patchEndpoint}/${id}`, { method: "DELETE" });
    onUpdate?.();
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-stone-50">
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-stone-500"
                style={{ width: col.width }}
              >
                {col.label}
              </th>
            ))}
            <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-stone-500 w-[80px]">
              Source
            </th>
            <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-stone-500 w-[90px]">
              Stage
            </th>
            <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-stone-500 w-[120px]">
              Assigned To
            </th>
            <th className="px-3 py-2 w-[40px]" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              onClick={() => onRowClick?.(item)}
              className={cn(
                "border-b last:border-0 hover:bg-yellow-50/30 transition-colors",
                onRowClick && "cursor-pointer"
              )}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-3 py-2">
                  {col.render(item)}
                </td>
              ))}
              <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                <Badge className={`text-[10px] ${sourceColors[item.source] || sourceColors.intake}`}>
                  {item.source}
                </Badge>
              </td>
              <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                <StageDropdown
                  stage={item.stage}
                  onChange={(newStage) => handlePatch(item.id, "stage", newStage)}
                />
              </td>
              <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                <InlineEdit
                  value={item.assignedTo || ""}
                  placeholder="Assign..."
                  onSave={(val) => handlePatch(item.id, "assignedTo", val)}
                />
              </td>
              <td className="px-3 py-1" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="rounded p-1 text-stone-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
