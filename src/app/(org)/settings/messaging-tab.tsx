"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────

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

// ─── Bot Personality ──────────────────────────────────

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

// ─── Telegram Setup Component ─────────────────────────

function TelegramSetup({ onConnected }: { onConnected?: (cfg: PlatformConfig) => void }) {
  const [step, setStep] = useState<"loading" | "idle" | "token" | "group">("loading");
  const [token, setToken] = useState("");
  const [botInfo, setBotInfo] = useState<{ botUsername: string; botName: string } | null>(null);
  const [groups, setGroups] = useState<{ chatId: string; title: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [config, setConfig] = useState<{ botUsername?: string; groupChatId?: string; groupTitle?: string; enabled?: boolean; botRunning?: boolean } | null>(null);

  // Load existing config
  useEffect(() => {
    fetch("/api/messaging/telegram").then(async (res) => {
      const json = await res.json();
      if (json.data) {
        setConfig(json.data);
        setStep(json.data.botUsername ? "group" : "idle");
      } else {
        setStep("idle");
      }
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

// ─── Discord Setup Component ──────────────────────────

function DiscordSetup({ onConnected }: { onConnected?: (cfg: PlatformConfig) => void }) {
  const [step, setStep] = useState<"loading" | "idle" | "token" | "server">("loading");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [botInfo, setBotInfo] = useState<{ username: string; id: string } | null>(null);
  const [config, setConfig] = useState<{ botUsername?: string; serverId?: string; serverName?: string; enabled?: boolean; botRunning?: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/messaging/discord").then(async (res) => {
      const json = await res.json();
      if (json.data) {
        setConfig(json.data);
        setStep(json.data.botUsername ? "server" : "idle");
      } else {
        setStep("idle");
      }
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
          <div className="flex items-center gap-2 pl-7">
            <p className="text-xs text-muted-foreground">
              Bot: <span className="font-medium">{botInfo?.username || config?.botUsername}</span>
            </p>
            <button
              className="text-xs text-muted-foreground underline hover:text-foreground"
              onClick={async () => {
                await fetch("/api/messaging/discord", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "reset" }),
                });
                setConfig(null);
                setBotInfo(null);
                setToken("");
                setStep("idle");
              }}
            >
              Change
            </button>
          </div>
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

// ─── Main Messaging Tab ───────────────────────────────

export function MessagingTab() {
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
