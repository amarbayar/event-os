"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { UserPlus, Trash2, Loader2, Plus, GripVertical } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/components/confirm-dialog";

type Tab = "event" | "team" | "checklists" | "ai" | "telegram";
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

  const { confirm: confirmDialog } = useConfirm();

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await confirmDialog({
      title: "Delete checklist template",
      message: `Remove "${name}"? Existing checklist items from this template will also be removed.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) return;
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
                onClick={() => handleDelete(t.id, t.name)}
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

  const { confirm: confirmDialog } = useConfirm();

  const handleRemove = async (userId: string, userName: string | null) => {
    const confirmed = await confirmDialog({
      title: "Remove team member",
      message: `Remove ${userName || "this user"} from the organization? They will lose access to all event data.`,
      confirmLabel: "Remove",
      variant: "danger",
    });
    if (!confirmed) return;
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
    { key: "ai", label: "AI Model" },
    { key: "telegram", label: "Messaging" },
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

      {/* AI Model tab */}
      {tab === "ai" && (
        <div className="max-w-lg space-y-4">
          <p className="text-sm text-muted-foreground">
            Choose the LLM that powers the agent — both the web chat and messaging bots (Telegram, Discord).
          </p>
          <LlmSettings />
        </div>
      )}

      {/* Messaging tab */}
      {tab === "telegram" && <MessagingTab />}
    </div>
  );
}

// ─── Messaging Tab — Redesigned ───────────────────────

type PlatformConfig = {
  id: string;
  botUsername?: string;
  groupChatId?: string;
  groupTitle?: string;
  enabled?: boolean;
};
type PlatformLink = {
  id: string;
  platform: string;
  platformUserId: string;
  displayName: string | null;
  userName: string | null;
  userEmail: string;
};
type OrgMember = { userId: string; name: string | null; email: string; role: string };

function MessagingTab() {
  const [activePlatform, setActivePlatform] = useState<"telegram" | "discord" | null>(null);
  const [links, setLinks] = useState<PlatformLink[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [tgConfig, setTgConfig] = useState<PlatformConfig | null>(null);
  const [dcConfig, setDcConfig] = useState<PlatformConfig | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load all data once
  useEffect(() => {
    Promise.all([
      fetch("/api/messaging/telegram").then((r) => r.json()).catch(() => ({})),
      fetch("/api/messaging/discord").then((r) => r.json()).catch(() => ({})),
      fetch("/api/messaging/links").then((r) => r.json()).catch(() => ({})),
    ]).then(([tg, dc, lk]) => {
      if (tg.data) setTgConfig(tg.data);
      if (dc.data) setDcConfig(dc.data);
      if (lk.data) {
        setLinks(lk.data.links || []);
        setMembers(lk.data.members || []);
      }
      // Auto-expand connected platform or first available
      if (tg.data?.enabled) setActivePlatform("telegram");
      else if (dc.data?.enabled) setActivePlatform("discord");
      setLoaded(true);
    });
  }, []);

  const tgLinks = links.filter((l) => l.platform === "telegram");
  const dcLinks = links.filter((l) => l.platform === "discord");

  const refreshLinks = async () => {
    const res = await fetch("/api/messaging/links");
    const json = await res.json();
    if (json.data) setLinks(json.data.links || []);
  };

  if (!loaded) {
    return <div className="py-8 text-sm text-muted-foreground">Loading messaging config...</div>;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Connect your team&apos;s chat to Event OS. The bot joins your group and responds
        when @mentioned — query data, create records, manage your event through conversation.
      </p>

      {/* Bot personality */}
      <BotPersonality />

      {/* Platform selector cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => setActivePlatform("telegram")}
          className={`text-left rounded-lg border p-4 transition-colors ${activePlatform === "telegram" ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"}`}
        >
          <div className="flex items-center gap-3">
            <img src="/telegram-logo.png" alt="Telegram" className="w-10 h-10 rounded-lg" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium">Telegram</h4>
                {tgConfig?.enabled && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {tgConfig?.enabled ? `@${tgConfig.botUsername} · ${tgLinks.length} member${tgLinks.length !== 1 ? "s" : ""}` : "Not connected"}
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setActivePlatform("discord")}
          className={`text-left rounded-lg border p-4 transition-colors ${activePlatform === "discord" ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"}`}
        >
          <div className="flex items-center gap-3">
            <img src="/discord-logo.png" alt="Discord" className="w-10 h-10 rounded-lg" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium">Discord</h4>
                {dcConfig?.enabled && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {dcConfig?.enabled ? `${dcConfig.botUsername} · ${dcLinks.length} member${dcLinks.length !== 1 ? "s" : ""}` : "Not connected"}
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Platform-specific section */}
      {activePlatform === "telegram" && (
        <PlatformSection
          platform="telegram"
          logo="/telegram-logo.png"
          config={tgConfig}
          links={tgLinks}
          members={members}
          onConfigChange={setTgConfig}
          onLinksChange={refreshLinks}
          setupComponent={<TelegramSetup onConnected={(cfg) => setTgConfig(cfg)} />}
        />
      )}
      {activePlatform === "discord" && (
        <PlatformSection
          platform="discord"
          logo="/discord-logo.png"
          config={dcConfig}
          links={dcLinks}
          members={members}
          onConfigChange={setDcConfig}
          onLinksChange={refreshLinks}
          setupComponent={<DiscordSetup onConnected={(cfg) => setDcConfig(cfg)} />}
        />
      )}
    </div>
  );
}

// ─── Bot Personality ──────────────────────────────────

const LANGUAGES = [
  { value: "auto", label: "Auto (match user's language)" },
  { value: "en", label: "English" },
  { value: "mn", label: "Mongolian" },
  { value: "ko", label: "Korean" },
  { value: "ja", label: "Japanese" },
  { value: "zh", label: "Chinese" },
  { value: "ru", label: "Russian" },
];

const MOODS = [
  { value: "professional", label: "Professional", desc: "Straight to the point" },
  { value: "friendly", label: "Friendly", desc: "Warm and encouraging" },
  { value: "sarcastic", label: "Sarcastic", desc: "Witty and dry humor" },
  { value: "nerdy", label: "Nerdy", desc: "Enthusiastic tech nerd" },
  { value: "funny", label: "Funny", desc: "Light-hearted and humorous" },
];

const LLM_PROVIDERS = [
  { value: "gemini", label: "Google Gemini", desc: "Google's Gemini models" },
  { value: "zai", label: "z.ai (Zhipu)", desc: "GLM models from z.ai" },
  { value: "xai", label: "xAI (Grok)", desc: "Grok models from xAI" },
  { value: "ollama", label: "Ollama (Local)", desc: "Self-hosted open-source models" },
];

function LlmSettings() {
  const [provider, setProvider] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [apiKeyMasked, setApiKeyMasked] = useState<string | null>(null);
  const [apiKeySet, setApiKeySet] = useState(false);
  const [providerModels, setProviderModels] = useState<Record<string, { id: string; label: string; note?: string }[]>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingKey, setEditingKey] = useState(false);

  useEffect(() => {
    fetch("/api/messaging/llm-settings").then(async (res) => {
      const json = await res.json();
      if (json.data) {
        setProvider(json.data.provider);
        setModel(json.data.model);
        setApiKeySet(json.data.apiKeySet);
        setApiKeyMasked(json.data.apiKeyMasked);
        if (json.data.providerModels) setProviderModels(json.data.providerModels);
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const save = async (updates: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch("/api/messaging/llm-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const json = await res.json();
      if (json.data) {
        if (json.data.apiKeySet !== undefined) {
          setApiKeySet(json.data.apiKeySet);
          setEditingKey(false);
          setApiKey("");
          // Refetch to get masked key
          const r = await fetch("/api/messaging/llm-settings");
          const j = await r.json();
          if (j.data) setApiKeyMasked(j.data.apiKeyMasked);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  const models = provider ? (providerModels[provider] || []) : [];
  const needsApiKey = provider && provider !== "ollama";

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <h3 className="text-sm font-medium">AI Model</h3>
      <p className="text-xs text-muted-foreground">
        Choose the LLM that powers the agent — both the web chat and messaging bots.
        {!provider && " Using server default (env vars)."}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Provider */}
        <div className="space-y-1.5">
          <Label className="text-xs">Provider</Label>
          <select
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            value={provider || ""}
            onChange={(e) => {
              const v = e.target.value || null;
              setProvider(v);
              setModel(null);
              setApiKeySet(false);
              setApiKeyMasked(null);
              setEditingKey(false);
              if (v) save({ provider: v, model: null, apiKey: null });
              else save({ provider: null, model: null, apiKey: null });
            }}
          >
            <option value="">Server default (env vars)</option>
            {LLM_PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Model */}
        {provider && (
          <div className="space-y-1.5">
            <Label className="text-xs">Model</Label>
            <select
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              value={model || ""}
              onChange={(e) => {
                const v = e.target.value || null;
                setModel(v);
                save({ model: v });
              }}
            >
              <option value="">Default</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.label}{m.note ? ` — ${m.note}` : ""}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* API Key */}
      {needsApiKey && (
        <div className="space-y-1.5">
          <Label className="text-xs">API Key</Label>
          {apiKeySet && !editingKey ? (
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{apiKeyMasked}</code>
              <button
                onClick={() => setEditingKey(true)}
                className="text-xs text-primary hover:underline"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder={`Enter your ${LLM_PROVIDERS.find((p) => p.value === provider)?.label} API key`}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="text-sm font-mono"
              />
              <Button
                size="sm"
                disabled={!apiKey.trim() || saving}
                onClick={() => save({ apiKey: apiKey.trim() })}
              >
                {saving ? "Saving..." : "Save"}
              </Button>
              {editingKey && (
                <Button size="sm" variant="ghost" onClick={() => { setEditingKey(false); setApiKey(""); }}>
                  Cancel
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {saving && <p className="text-xs text-muted-foreground">Saving & syncing with messaging bots...</p>}
    </div>
  );
}

function BotPersonality() {
  const [language, setLanguage] = useState("auto");
  const [mood, setMood] = useState("professional");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/messaging/bot-settings").then(async (res) => {
      const json = await res.json();
      if (json.data) {
        setLanguage(json.data.language || "auto");
        setMood(json.data.mood || "professional");
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const save = async (newLang?: string, newMood?: string) => {
    setSaving(true);
    await fetch("/api/messaging/bot-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: newLang || language, mood: newMood || mood }),
    });
    setSaving(false);
  };

  if (!loaded) return null;

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <h3 className="text-sm font-medium">Bot Personality</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Response Language</Label>
          <select
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            value={language}
            onChange={(e) => { setLanguage(e.target.value); save(e.target.value, undefined); }}
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Mood</Label>
          <div className="flex flex-wrap gap-1.5">
            {MOODS.map((m) => (
              <button
                key={m.value}
                onClick={() => { setMood(m.value); save(undefined, m.value); }}
                className={`px-2.5 py-1 rounded-full text-xs transition-colors ${mood === m.value ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80 text-muted-foreground"}`}
                title={m.desc}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {saving && <p className="text-xs text-muted-foreground">Saving...</p>}
    </div>
  );
}

// ─── Platform Section — unified layout per platform ───

function PlatformSection({
  platform, logo, config, links, members, onConfigChange, onLinksChange, setupComponent,
}: {
  platform: string;
  logo: string;
  config: PlatformConfig | null;
  links: PlatformLink[];
  members: OrgMember[];
  onConfigChange: (c: PlatformConfig | null) => void;
  onLinksChange: () => void;
  setupComponent: React.ReactNode;
}) {
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [formMember, setFormMember] = useState("");
  const [formPlatformId, setFormPlatformId] = useState("");
  const [formName, setFormName] = useState("");
  const [linkError, setLinkError] = useState("");

  const addLink = async () => {
    if (!formMember || !formPlatformId.trim()) {
      setLinkError("Select a team member and enter their platform ID");
      return;
    }
    setLinkError("");
    const res = await fetch("/api/messaging/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: formMember,
        platform,
        platformUserId: formPlatformId.trim(),
        displayName: formName || undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) { setLinkError(json.error || "Failed"); return; }
    setShowLinkForm(false);
    setFormMember("");
    setFormPlatformId("");
    setFormName("");
    onLinksChange();
  };

  const removeLink = async (id: string) => {
    await fetch(`/api/messaging/links?id=${id}`, { method: "DELETE" });
    onLinksChange();
  };

  const disconnect = async () => {
    await fetch(`/api/messaging/${platform}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "disconnect" }),
    });
    onConfigChange(null);
  };

  // Not connected — show setup flow
  if (!config?.enabled) {
    return <div className="mt-2">{setupComponent}</div>;
  }

  // Connected — show status + members
  return (
    <div className="space-y-4">
      {/* Connection status */}
      <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt={platform} className="w-6 h-6 rounded" />
            <div>
              <p className="text-sm font-medium">
                {platform === "telegram" ? `@${config.botUsername}` : config.botUsername}
              </p>
              {config.groupTitle && (
                <p className="text-xs text-muted-foreground">{config.groupTitle}</p>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={disconnect}>Disconnect</Button>
        </div>
      </div>

      {/* Linked members for this platform */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium">
            Team Members ({platform === "telegram" ? "Telegram" : "Discord"})
          </h4>
          <Button size="sm" variant="outline" onClick={() => setShowLinkForm(!showLinkForm)}>
            {showLinkForm ? "Cancel" : "+ Link Member"}
          </Button>
        </div>

        {showLinkForm && (
          <div className="rounded-lg border p-3 mb-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Team Member</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                  value={formMember}
                  onChange={(e) => setFormMember(e.target.value)}
                >
                  <option value="">Select...</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name || m.email} ({m.role})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">
                  {platform === "telegram" ? "Telegram User ID" : "Discord User ID"}
                </Label>
                <Input
                  className="h-8 text-sm"
                  placeholder={platform === "telegram" ? "e.g., 123456789" : "e.g., 836852783227207690"}
                  value={formPlatformId}
                  onChange={(e) => { setFormPlatformId(e.target.value); setLinkError(""); }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Display Name</Label>
                <Input
                  className="h-8 text-sm"
                  placeholder="@username"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {platform === "telegram"
                ? "To find your Telegram ID: message @userinfobot in Telegram."
                : "To find your Discord ID: right-click your name → Copy User ID. (Turn on Developer Mode in Settings → Advanced first.)"}
            </p>
            {linkError && <p className="text-xs text-destructive">{linkError}</p>}
            <Button size="sm" onClick={addLink}>Link Account</Button>
          </div>
        )}

        {links.length > 0 ? (
          <div className="rounded-lg border divide-y">
            {links.map((link) => (
              <div key={link.id} className="flex items-center justify-between px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{link.userName || link.userEmail}</p>
                  <p className="text-xs text-muted-foreground">
                    {link.displayName ? `${link.displayName} · ` : ""}{link.platformUserId}
                  </p>
                </div>
                <button
                  onClick={() => removeLink(link.id)}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground border rounded-lg p-3">
            No team members linked yet. The bot won&apos;t recognize anyone until you link their accounts.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── (PlatformLinks removed — functionality in PlatformSection) ──
function _unused_PlatformLinks() { void 0; } void _unused_PlatformLinks;
function __old_PlatformLinks() {
  const [links, setLinks] = useState<{ id: string; platform: string; platformUserId: string; displayName: string | null; userName: string | null; userEmail: string }[]>([]);
  const [members, setMembers] = useState<{ userId: string; name: string | null; email: string; role: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formPlatform, setFormPlatform] = useState("telegram");
  const [formUserId, setFormUserId] = useState("");
  const [formMember, setFormMember] = useState("");
  const [formName, setFormName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/messaging/links").then(async (res) => {
      const json = await res.json();
      if (json.data) {
        setLinks(json.data.links || []);
        setMembers(json.data.members || []);
      }
    }).catch(() => {});
  }, []);

  const addLink = async () => {
    if (!formMember || !formUserId.trim()) {
      setError("Select a team member and enter their platform ID");
      return;
    }
    setError("");
    const res = await fetch("/api/messaging/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: formMember,
        platform: formPlatform,
        platformUserId: formUserId.trim(),
        displayName: formName || undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error || "Failed"); return; }
    // Refresh
    setShowForm(false);
    setFormUserId("");
    setFormName("");
    const refreshRes = await fetch("/api/messaging/links");
    const refreshJson = await refreshRes.json();
    if (refreshJson.data) setLinks(refreshJson.data.links || []);
  };

  const removeLink = async (id: string) => {
    await fetch(`/api/messaging/links?id=${id}`, { method: "DELETE" });
    setLinks((prev) => prev.filter((l) => l.id !== id));
  };

  return (
    <div className="border-t pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Linked Team Members</h3>
          <p className="text-xs text-muted-foreground">
            Connect team members&apos; Telegram or Discord accounts so the bot recognizes them.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Link Member"}
        </Button>
      </div>

      {showForm && (
        <div className="rounded-lg border p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Team Member</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={formMember}
                onChange={(e) => setFormMember(e.target.value)}
              >
                <option value="">Select a member...</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name || m.email} ({m.role})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Platform</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={formPlatform}
                onChange={(e) => setFormPlatform(e.target.value)}
              >
                <option value="telegram">Telegram</option>
                <option value="discord">Discord</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Platform User ID</Label>
              <Input
                placeholder={formPlatform === "telegram" ? "e.g., 123456789" : "e.g., 836852783227207690"}
                value={formUserId}
                onChange={(e) => { setFormUserId(e.target.value); setError(""); }}
              />
              <p className="text-xs text-muted-foreground">
                {formPlatform === "telegram"
                  ? "Message @userinfobot on Telegram to get your numeric ID"
                  : "Right-click username in Discord → Copy User ID (enable Developer Mode first)"}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Display Name (optional)</Label>
              <Input
                placeholder="e.g., @username"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button size="sm" onClick={addLink}>Link Account</Button>
        </div>
      )}

      {links.length > 0 ? (
        <div className="rounded-lg border divide-y">
          {links.map((link) => (
            <div key={link.id} className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-3">
                <img
                  src={link.platform === "telegram" ? "/telegram-logo.png" : "/discord-logo.png"}
                  alt={link.platform}
                  className="w-5 h-5 rounded"
                />
                <div>
                  <p className="text-sm font-medium">{link.userName || link.userEmail}</p>
                  <p className="text-xs text-muted-foreground">
                    {link.displayName || link.platformUserId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => removeLink(link.id)}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground py-2">
          No team members linked yet. Link members so the bot recognizes them in group chats.
        </p>
      )}
    </div>
  );
}

// ─── Discord Setup Component ──────────────────────────

function DiscordSetup({ onConnected }: { onConnected?: (cfg: PlatformConfig) => void }) {
  const [step, setStep] = useState<"loading" | "idle" | "token" | "server">("loading");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [botInfo, setBotInfo] = useState<{ username: string; id: string } | null>(null);
  const [config, setConfig] = useState<{ botUsername?: string; serverId?: string; serverName?: string; enabled?: boolean } | null>(null);
  const [openclaw, setOpenclaw] = useState<{ installed?: boolean; gatewayRunning?: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/messaging/discord").then(async (res) => {
      const json = await res.json();
      if (json.data) {
        setConfig(json.data);
        setStep(json.data.botUsername ? "server" : "idle");
      } else {
        setStep("idle");
      }
      if (json.openclaw) setOpenclaw(json.openclaw);
    }).catch(() => setStep("idle"));
  }, []);

  const validateToken = async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/messaging/discord", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "validate", botToken: token }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { setError(json.error || "Invalid token"); return; }
    setBotInfo(json.data);
    setStep("server");
  };

  const connectServer = async (serverId: string) => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/messaging/discord", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "connect", serverId }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { setError(json.error || "Failed to connect"); return; }
    const newConfig = { ...config, enabled: true, serverId, groupTitle: json.data?.serverName, botUsername: config?.botUsername || botInfo?.username };
    setConfig(newConfig);
    onConnected?.({ id: "", ...newConfig } as PlatformConfig);
  };

  if (step === "loading") {
    return <div className="py-4 text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="max-w-lg space-y-4 mt-4">
      {/* Step 1: Create bot */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-medium ${botInfo || step === "server" ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"}`}>1</span>
          <h4 className="text-sm font-medium">Create a Discord bot</h4>
        </div>
        {step === "idle" || step === "token" ? (
          <div className="space-y-2 pl-7">
            <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li>Go to <a href="https://discord.com/developers/applications" target="_blank" rel="noopener" className="underline">Discord Developer Portal</a></li>
              <li>Click <span className="font-medium">New Application</span> → name it (e.g., &quot;Event OS&quot;)</li>
              <li>Go to <span className="font-medium">Bot</span> tab → click <span className="font-medium">Reset Token</span> → copy it</li>
              <li>Under <span className="font-medium">Privileged Gateway Intents</span>, turn on <span className="font-medium">Message Content Intent</span></li>
              <li>Go to <span className="font-medium">OAuth2</span> → check <span className="font-medium">bot</span> + <span className="font-medium">applications.commands</span></li>
              <li>Under Bot Permissions, check: View Channels, Send Messages, Read Message History, Add Reactions</li>
              <li>Copy the invite URL → open it → add bot to your server</li>
            </ol>
            <div className="flex gap-2 pt-1">
              <Input
                type="password"
                placeholder="Paste bot token..."
                value={token}
                onChange={(e) => { setToken(e.target.value); setError(""); }}
              />
              <Button size="sm" disabled={!token || loading} onClick={validateToken}>
                {loading ? "Checking..." : "Verify"}
              </Button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground pl-7">
            Bot: <span className="font-medium">{botInfo?.username || config?.botUsername}</span>
          </p>
        )}
      </div>

      {/* Step 2: Enter server ID */}
      {step === "server" && (
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full text-xs flex items-center justify-center font-medium bg-muted text-muted-foreground">2</span>
            <h4 className="text-sm font-medium">Connect to your server</h4>
          </div>
          <div className="space-y-2 pl-7">
            <p className="text-xs text-muted-foreground">
              Right-click your server icon in Discord → <span className="font-medium">Copy Server ID</span>.
              (Enable Developer Mode first: User Settings → Advanced → Developer Mode)
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Paste Server ID..."
                id="discord-server-id"
                onChange={() => setError("")}
              />
              <Button size="sm" disabled={loading} onClick={() => {
                const id = (document.getElementById("discord-server-id") as HTMLInputElement)?.value?.trim();
                if (id && /^\d+$/.test(id)) {
                  connectServer(id);
                } else {
                  setError("Server ID should be a number (e.g., 1234567890)");
                }
              }}>
                {loading ? "Connecting..." : "Connect"}
              </Button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Telegram Setup Component ─────────────────────────

function TelegramSetup({ onConnected }: { onConnected?: (cfg: PlatformConfig) => void }) {
  const [step, setStep] = useState<"loading" | "idle" | "token" | "group">("loading");
  const [token, setToken] = useState("");
  const [botInfo, setBotInfo] = useState<{ botUsername: string; botName: string } | null>(null);
  const [groups, setGroups] = useState<{ chatId: string; title: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [config, setConfig] = useState<{ botUsername?: string; groupChatId?: string; groupTitle?: string; enabled?: boolean } | null>(null);
  const [openclaw, setOpenclaw] = useState<{ installed?: boolean; gatewayRunning?: boolean; telegramConnected?: boolean } | null>(null);

  // Load existing config + OpenClaw status
  useEffect(() => {
    fetch("/api/messaging/telegram").then(async (res) => {
      const json = await res.json();
      if (json.data) {
        setConfig(json.data);
        setStep(json.data.botUsername ? "group" : "idle");
      } else {
        setStep("idle");
      }
      if (json.openclaw) setOpenclaw(json.openclaw);
    }).catch(() => setStep("idle"));
  }, []);

  const validateToken = async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/messaging/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "validate", botToken: token }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error || "Invalid token");
      return;
    }
    setBotInfo(json.data);
    setStep("group");
  };

  const detectGroups = async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/messaging/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "detect-group" }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error || "Detection failed");
      return;
    }
    setGroups(json.data.groups || []);
    if (json.data.groups?.length === 0) {
      setError(json.message || "No groups found. Add the bot to a group and send a message first.");
    }
  };

  const connectGroup = async (chatId: string, title: string) => {
    setLoading(true);
    const res = await fetch("/api/messaging/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "connect", groupChatId: chatId, groupTitle: title }),
    });
    setLoading(false);
    if (res.ok) {
      const newConfig = { botUsername: botInfo?.botUsername || config?.botUsername, groupChatId: chatId, groupTitle: title, enabled: true };
      setConfig(newConfig);
      onConnected?.({ id: "", ...newConfig } as PlatformConfig);
    }
  };

  const disconnect = async () => {
    await fetch("/api/messaging/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "disconnect" }),
    });
    setConfig(null);
    setStep("idle");
    setToken("");
    setBotInfo(null);
    setGroups([]);
  };

  // Loading state — prevents flash of empty form
  if (step === "loading") {
    return (
      <div className="max-w-lg py-8 text-sm text-muted-foreground">Loading messaging config...</div>
    );
  }

  return (
    <div className="max-w-lg space-y-4">
      <p className="text-sm text-muted-foreground">
        Connect a Telegram bot to your team group chat. The bot can answer questions,
        create records, and manage your event through natural conversation.
      </p>

      {/* Step 1: Bot token */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-medium ${botInfo || step === "group" ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"}`}>1</span>
          <h4 className="text-sm font-medium">Create a bot</h4>
        </div>
        {step === "idle" || step === "token" ? (
          <div className="space-y-2 pl-7">
            <p className="text-xs text-muted-foreground">
              Open Telegram, message <span className="font-medium">@BotFather</span>, send <code className="bg-muted px-1 rounded">/newbot</code>, and paste the token below.
            </p>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="Paste bot token..."
                value={token}
                onChange={(e) => { setToken(e.target.value); setError(""); }}
              />
              <Button size="sm" disabled={!token.includes(":") || loading} onClick={validateToken}>
                {loading ? "Checking..." : "Verify"}
              </Button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground pl-7">
            Bot: <span className="font-medium">@{botInfo?.botUsername || config?.botUsername}</span>
          </p>
        )}
      </div>

      {/* Step 2: Detect group */}
      {(step === "group") && (
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-medium ${groups.length > 0 ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"}`}>2</span>
            <h4 className="text-sm font-medium">Connect to group chat</h4>
          </div>
          <div className="space-y-3 pl-7">
            <p className="text-xs text-muted-foreground">
              Add <span className="font-medium">@{botInfo?.botUsername || config?.botUsername}</span> to your team group chat,
              send any message in the group, then click Detect. If detect doesn&apos;t find your group,
              enter the chat ID manually below.
            </p>
            <div className="flex gap-2">
              <Button size="sm" disabled={loading} onClick={detectGroups}>
                {loading ? "Detecting..." : "Detect Group"}
              </Button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            {groups.length > 0 && (
              <div className="space-y-1">
                {groups.map((g) => (
                  <button
                    key={g.chatId}
                    className="w-full text-left px-3 py-2 rounded border hover:bg-muted text-sm flex justify-between items-center"
                    onClick={() => connectGroup(g.chatId, g.title)}
                  >
                    <span>{g.title}</span>
                    <span className="text-xs font-medium text-primary">Connect</span>
                  </button>
                ))}
              </div>
            )}
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs text-muted-foreground">Or enter group chat ID manually:</p>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g., -1001234567890"
                  onChange={(e) => setError("")}
                  id="manual-group-id"
                />
                <Button size="sm" onClick={() => {
                  const input = (document.getElementById("manual-group-id") as HTMLInputElement)?.value?.trim();
                  if (input && input.startsWith("-")) {
                    connectGroup(input, "Group chat");
                  } else {
                    setError("Group chat IDs start with a dash (e.g., -1001234567890)");
                  }
                }}>
                  Connect
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
