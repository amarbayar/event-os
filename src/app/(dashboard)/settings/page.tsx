"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { UserPlus, Trash2, Loader2, Plus, GripVertical } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

type Tab = "event" | "team" | "checklists" | "telegram";
type User = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
};

type ChecklistTemplate = {
  id: string;
  entityType: string;
  name: string;
  description: string | null;
  fieldKey: string | null;
  itemType: string;
  required: boolean;
  sortOrder: number;
  dueOffsetDays: number | null;
};

const ENTITY_TYPES = ["speaker", "sponsor", "venue", "booth", "volunteer", "media"];
const ITEM_TYPES = ["file_upload", "text_input", "link", "confirmation", "meeting"];

const roleBadgeColors: Record<string, string> = {
  owner: "bg-yellow-100 text-yellow-800 border-yellow-200",
  admin: "bg-stone-100 text-stone-800 border-stone-200",
  organizer: "bg-sky-50 text-sky-700 border-sky-200",
  coordinator: "bg-emerald-50 text-emerald-700 border-emerald-200",
  viewer: "bg-stone-50 text-stone-500 border-stone-200",
};

// ─── Checklist Templates Tab ──────────────────────────

function ChecklistTemplatesTab() {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState("speaker");
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", description: "", itemType: "text_input", fieldKey: "", required: true, dueOffsetDays: -14 });
  const [saving, setSaving] = useState(false);

  const fetchTemplates = () => {
    setLoading(true);
    fetch(`/api/checklist-templates?entityType=${selectedType}`)
      .then((r) => r.json())
      .then((d) => { if (d.data) setTemplates(d.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTemplates(); }, [selectedType]);

  const handleAdd = async () => {
    if (!newItem.name.trim()) return;
    setSaving(true);
    await fetch("/api/checklist-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityType: selectedType,
        name: newItem.name,
        description: newItem.description || null,
        itemType: newItem.itemType,
        fieldKey: newItem.fieldKey || null,
        required: newItem.required,
        dueOffsetDays: newItem.dueOffsetDays,
        sortOrder: templates.length,
      }),
    });
    setSaving(false);
    setShowAdd(false);
    setNewItem({ name: "", description: "", itemType: "text_input", fieldKey: "", required: true, dueOffsetDays: -14 });
    fetchTemplates();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this checklist template? Existing items won't be affected.")) return;
    await fetch(`/api/checklist-templates/${id}`, { method: "DELETE" });
    fetchTemplates();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Checklist Templates</h2>
        <p className="text-sm text-muted-foreground">
          Configure what confirmed entities need to complete. Templates auto-generate checklist items when an entity is confirmed.
        </p>
      </div>

      {/* Entity type selector */}
      <div className="flex gap-1 flex-wrap">
        {ENTITY_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors",
              selectedType === type
                ? "bg-yellow-500 text-stone-900"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            )}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Templates list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-md bg-stone-100 animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-1">
          {templates.map((t, i) => (
            <div key={t.id} className="flex items-center gap-3 rounded-md border px-3 py-2.5 hover:bg-accent/30 transition-colors">
              <GripVertical className="h-4 w-4 text-stone-300 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{t.name}</span>
                  <Badge variant="outline" className="text-[9px]">{t.itemType.replace("_", " ")}</Badge>
                  {t.required && <Badge variant="outline" className="text-[9px] text-yellow-700 border-yellow-200">Required</Badge>}
                  {t.fieldKey && <Badge variant="outline" className="text-[9px] text-sky-600 border-sky-200">{t.fieldKey}</Badge>}
                </div>
                {t.description && <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>}
                {t.dueOffsetDays && (
                  <p className="text-[10px] text-stone-400 mt-0.5">Due {Math.abs(t.dueOffsetDays)} days before event</p>
                )}
              </div>
              <button
                onClick={() => handleDelete(t.id)}
                className="rounded p-1 text-stone-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {templates.length === 0 && (
            <div className="rounded-lg border-2 border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No checklist templates for {selectedType}s yet.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Add new template */}
      {showAdd ? (
        <div className="rounded-md border p-4 space-y-3">
          <h3 className="text-sm font-medium">New checklist item for {selectedType}s</h3>
          <div className="space-y-1.5">
            <Label>Item name *</Label>
            <Input
              autoFocus
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              placeholder="e.g., Upload headshot photo"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={newItem.description}
              onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
              placeholder="Instructions for the stakeholder..."
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <select
                value={newItem.itemType}
                onChange={(e) => setNewItem({ ...newItem, itemType: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {ITEM_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace("_", " ")}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Due (days before event)</Label>
              <Input
                type="number"
                value={Math.abs(newItem.dueOffsetDays)}
                onChange={(e) => setNewItem({ ...newItem, dueOffsetDays: -Math.abs(parseInt(e.target.value) || 14) })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Maps to entity field (optional)</Label>
              <Input
                value={newItem.fieldKey}
                onChange={(e) => setNewItem({ ...newItem, fieldKey: e.target.value })}
                placeholder="e.g., headshotUrl, bio"
              />
            </div>
            <div className="space-y-1.5 flex items-end gap-2 pb-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={newItem.required}
                  onChange={(e) => setNewItem({ ...newItem, required: e.target.checked })}
                  className="rounded"
                />
                Required
              </label>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleAdd} disabled={!newItem.name.trim() || saving}>
              {saving ? "Adding..." : "Add Item"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
          <Plus className="mr-2 h-3 w-3" /> Add Checklist Item
        </Button>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("team");
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite dialog state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("organizer");
  const [inviteError, setInviteError] = useState("");
  const [inviting, setInviting] = useState(false);

  const fetchMembers = () => {
    setLoading(true);
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => {
        if (d.data) setMembers(d.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError("");

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: inviteName || undefined,
        email: inviteEmail,
        role: inviteRole,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setInviteError(data.error || "Failed to invite");
      setInviting(false);
      return;
    }

    setInviteOpen(false);
    setInviteName("");
    setInviteEmail("");
    setInviteRole("organizer");
    setInviting(false);
    fetchMembers();
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    fetchMembers();
  };

  const handleRemove = async (userId: string, userName: string | null) => {
    if (!confirm(`Remove ${userName || "this user"} from the organization?`)) return;
    await fetch(`/api/users/${userId}`, { method: "DELETE" });
    fetchMembers();
  };

  const initials = (name: string) =>
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const tabs: { key: Tab; label: string }[] = [
    { key: "event", label: "Event" },
    { key: "team", label: "Team" },
    { key: "checklists", label: "Checklists" },
    { key: "telegram", label: "Telegram" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure your event and organization
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
              tab === t.key
                ? "border-yellow-500 text-yellow-700"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Event tab */}
      {tab === "event" && (
        <div className="max-w-lg space-y-4">
          <div className="space-y-1.5">
            <Label>Event Name</Label>
            <Input defaultValue="Dev Summit 2026" />
          </div>
          <div className="space-y-1.5">
            <Label>Venue</Label>
            <Input defaultValue="Chinggis Khaan Hotel, Ulaanbaatar" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <Input type="date" defaultValue="2026-03-28" />
            </div>
            <div className="space-y-1.5">
              <Label>End Date</Label>
              <Input type="date" defaultValue="2026-03-29" />
            </div>
          </div>
          <Button>Save Changes</Button>
        </div>
      )}

      {/* Team tab */}
      {tab === "team" && (
        <div className="space-y-6">
          {/* Header + invite button */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium">
                Team Members ({members.length})
              </h2>
              <p className="text-sm text-muted-foreground">
                Manage who has access to your event workspace
              </p>
            </div>
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite Member
            </Button>

            {/* Invite modal */}
            {inviteOpen && (
              <>
                <div
                  className="fixed inset-0 z-50 bg-black/50"
                  onClick={() => setInviteOpen(false)}
                />
                <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg">
                  <h3 className="text-lg font-semibold mb-4">
                    Invite Team Member
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Name</Label>
                      <Input
                        value={inviteName}
                        onChange={(e) => setInviteName(e.target.value)}
                        placeholder="e.g., Tuvshin"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Email *</Label>
                      <Input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="tuvshin@devsummit.mn"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Role</Label>
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="organizer">Organizer</option>
                        <option value="coordinator">Coordinator</option>
                        <option value="viewer">Viewer</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    {inviteError && (
                      <p className="text-sm text-red-600">{inviteError}</p>
                    )}
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setInviteOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleInvite}
                        disabled={!inviteEmail.trim() || inviting}
                      >
                        {inviting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Inviting...
                          </>
                        ) : (
                          "Invite"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Members list */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 rounded-md bg-stone-100 animate-pulse"
                />
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed p-12 text-center">
              <p className="text-muted-foreground mb-2">
                No team members yet. Invite your first teammate to get started.
              </p>
              <Button onClick={() => setInviteOpen(true)} size="sm">
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Member
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-md border px-4 py-3 hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-200 text-xs font-medium text-stone-600">
                      {initials(m.name || m.email)}
                    </span>
                    <div>
                      <p className="text-sm font-medium">
                        {m.name || m.email.split("@")[0]}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {m.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {m.role === "owner" ? (
                      <Badge
                        className={roleBadgeColors.owner}
                        variant="outline"
                      >
                        Owner
                      </Badge>
                    ) : (
                      <select
                        value={m.role}
                        onChange={(e) =>
                          handleRoleChange(m.id, e.target.value)
                        }
                        className="rounded border border-input bg-background px-2 py-1 text-xs"
                      >
                        <option value="admin">Admin</option>
                        <option value="organizer">Organizer</option>
                        <option value="coordinator">Coordinator</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    )}
                    {m.role !== "owner" && (
                      <button
                        onClick={() => handleRemove(m.id, m.name)}
                        className="rounded p-1 text-stone-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Checklists tab */}
      {tab === "checklists" && (
        <ChecklistTemplatesTab />
      )}

      {/* Telegram tab */}
      {tab === "telegram" && (
        <div className="max-w-lg space-y-4">
          <p className="text-sm text-muted-foreground">
            Connect your Telegram group to receive agent notifications for
            speaker applications, deadline reminders, and conflict alerts.
          </p>
          <div className="space-y-1.5">
            <Label>Telegram Bot Token</Label>
            <Input type="password" placeholder="Enter your bot token..." />
          </div>
          <div className="space-y-1.5">
            <Label>Chat ID</Label>
            <Input placeholder="e.g., -1001234567890" />
          </div>
          <Button variant="outline">Connect Telegram</Button>
        </div>
      )}
    </div>
  );
}
