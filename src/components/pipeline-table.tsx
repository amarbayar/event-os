"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/confirm-dialog";
import { NotesButton, NotesPanel } from "@/components/notes-panel";
import { Trash2, CheckCircle2 } from "lucide-react";
import { stageKeys, sourceKeys } from "@/components/pipeline-view";

type OrgUser = { id: string; name: string | null; email: string };
type ChecklistCount = { done: number; total: number };

// ─── Types ───────────────────────────────────────────────

type Stage = "lead" | "engaged" | "confirmed" | "declined";

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

// ─── Stage dropdown ──────────────────────────────────────

function StageDropdown({
  stage,
  onChange,
}: {
  stage: string;
  onChange: (newStage: string) => void;
}) {
  const t = useTranslations("Pipeline");
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
          stageColors[stage] || stageColors.lead
        }`}
      >
        {t((stageKeys as Record<string, string>)[stage] || "stageLead")}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 rounded-md border bg-white py-1 shadow-lg min-w-[100px] dropdown-active">
            {stages.map((s) => (
              <button
                key={s}
                onClick={() => {
                  onChange(s);
                  setOpen(false);
                }}
                className={`block w-full px-3 py-1 text-left text-xs transition-colors hover:bg-stone-50 ${
                  s === stage ? "font-medium text-yellow-700 bg-yellow-50" : ""
                }`}
              >
                {t(stageKeys[s])}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── User Dropdown (AssignedTo) ──────────────────────────

function UserDropdown({
  value,
  users,
  onSelect,
}: {
  value: string | null;
  users: OrgUser[];
  onSelect: (name: string, userId: string | null) => void;
}) {
  const t = useTranslations("Pipeline");
  const [open, setOpen] = useState(false);

  const initials = (name: string) =>
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-yellow-50 ${
          value ? "" : "text-stone-300 italic"
        }`}
      >
        {value ? (
          <>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-stone-200 text-[9px] font-medium text-stone-600">
              {initials(value)}
            </span>
            <span>{value}</span>
          </>
        ) : (
          t("assign")
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 rounded-md border bg-white py-1 shadow-lg min-w-[160px] dropdown-active">
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => {
                  onSelect(u.name || u.email, u.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-stone-50 ${
                  value === u.name ? "font-medium text-yellow-700 bg-yellow-50" : ""
                }`}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-stone-200 text-[9px] font-medium text-stone-600">
                  {initials(u.name || u.email)}
                </span>
                <span className="truncate">{u.name || u.email}</span>
              </button>
            ))}
            {value && (
              <>
                <div className="border-t border-stone-100 my-1" />
                <button
                  onClick={() => {
                    onSelect("", null);
                    setOpen(false);
                  }}
                  className="block w-full px-3 py-1.5 text-left text-xs text-stone-400 hover:bg-stone-50"
                >
                  {t("unassign")}
                </button>
              </>
            )}
            {users.length === 0 && (
              <p className="px-3 py-2 text-xs text-stone-400 italic">{t("noTeamMembers")}</p>
            )}
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
  const t = useTranslations("Pipeline");
  const tC = useTranslations("Common");
  const { confirm } = useConfirm();
  const [notesOpenFor, setNotesOpenFor] = useState<string | null>(null);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [checklistCounts, setChecklistCounts] = useState<Record<string, ChecklistCount>>({});

  // Fetch org users for AssignedTo dropdown
  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => { if (d.data) setOrgUsers(d.data); })
      .catch(() => {});
  }, []);

  // Fetch checklist counts for confirmed entities
  useEffect(() => {
    const confirmed = items.filter((i) => i.stage === "confirmed");
    if (confirmed.length === 0) return;
    Promise.all(
      confirmed.map((item) =>
        fetch(`/api/checklist-items?entityType=${entityName}&entityId=${item.id}`)
          .then((r) => r.json())
          .then((d) => {
            const active = (d.data || []).filter((i: { status: string }) => i.status !== "archived");
            const done = active.filter((i: { status: string }) => i.status === "submitted" || i.status === "approved").length;
            return { id: item.id, done, total: active.length };
          })
          .catch(() => ({ id: item.id, done: 0, total: 0 }))
      )
    ).then((results) => {
      const counts: Record<string, ChecklistCount> = {};
      for (const r of results) counts[r.id] = { done: r.done, total: r.total };
      setChecklistCounts(counts);
    });
  }, [items, entityName]);

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
      title: t("deleteTitle", { entity: entityName }),
      message: t("deleteMessage", { entity: entityName }),
      confirmLabel: tC("delete"),
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
    <div className="overflow-visible rounded-lg border">
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
              {t("source")}
            </th>
            <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-stone-500 w-[90px]">
              {t("stage")}
            </th>
            <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-stone-500 w-[120px]">
              {t("assignedTo")}
            </th>
            <th className="px-3 py-2 text-center text-[11px] font-medium uppercase tracking-wider text-stone-500 w-[60px]">
              {t("checklist")}
            </th>
            <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-stone-500 w-[50px]">
              {t("notes")}
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
                  {t((sourceKeys as Record<string, string>)[item.source] || "sourceIntake")}
                </Badge>
              </td>
              <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                <StageDropdown
                  stage={item.stage}
                  onChange={(newStage) => handlePatch(item.id, "stage", newStage)}
                />
              </td>
              <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                <UserDropdown
                  value={item.assignedTo}
                  users={orgUsers}
                  onSelect={(name) => {
                    handlePatch(item.id, "assignedTo", name);
                    // TODO: also set assigneeId when PATCH supports it
                  }}
                />
              </td>
              <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                {checklistCounts[item.id] ? (
                  checklistCounts[item.id].done === checklistCounts[item.id].total ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                  ) : (
                    <span className="text-xs tabular-nums text-stone-500">
                      {checklistCounts[item.id].done}/{checklistCounts[item.id].total}
                    </span>
                  )
                ) : item.stage === "confirmed" ? (
                  <span className="text-xs text-stone-300">...</span>
                ) : null}
              </td>
              <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                <NotesButton
                  count={0}
                  onClick={() => setNotesOpenFor(item.id)}
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

      {/* Notes panel */}
      <NotesPanel
        entityType={entityName}
        entityId={notesOpenFor || ""}
        isOpen={!!notesOpenFor}
        onClose={() => setNotesOpenFor(null)}
      />
    </div>
  );
}
