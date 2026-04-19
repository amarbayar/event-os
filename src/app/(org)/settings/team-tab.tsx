"use client";

import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Trash2, Loader2, RefreshCw, Copy, KeyRound } from "lucide-react";
import { useConfirm } from "@/components/confirm-dialog";

type User = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
};

type Invite = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  status: "pending" | "claimed" | "expired" | "revoked";
  expiresAt: string;
  attemptCount: number;
  createdAt: string;
};

const roleBadgeColors: Record<string, string> = {
  owner: "bg-yellow-100 text-yellow-800 border-yellow-200",
  admin: "bg-stone-100 text-stone-800 border-stone-200",
  organizer: "bg-sky-50 text-sky-700 border-sky-200",
  coordinator: "bg-emerald-50 text-emerald-700 border-emerald-200",
  viewer: "bg-stone-50 text-stone-500 border-stone-200",
};

const statusBadgeColors: Record<string, string> = {
  pending: "bg-orange-50 text-orange-600 border-orange-200",
  claimed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  expired: "bg-stone-50 text-stone-400 border-stone-200",
  revoked: "bg-red-50 text-red-500 border-red-200",
};

export function TeamTab() {
  const [members, setMembers] = useState<User[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite dialog state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteRole, setInviteRole] = useState("organizer");
  const [inviteError, setInviteError] = useState("");
  const [inviting, setInviting] = useState(false);

  // Generated code display
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  // Reset password display
  const [tempPassword, setTempPassword] = useState<{ userId: string; password: string } | null>(null);

  const { confirm: confirmDialog } = useConfirm();

  const fetchMembers = () => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => {
        if (d.data) setMembers(d.data);
      })
      .catch(() => {});
  };

  const fetchInvites = () => {
    fetch("/api/org/invites")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setInvites(data);
      })
      .catch(() => {});
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [userData, inviteData] = await Promise.all([
        fetch("/api/users").then((r) => r.json()),
        fetch("/api/org/invites").then((r) => r.json()),
      ]);
      if (userData.data) setMembers(userData.data);
      if (Array.isArray(inviteData)) setInvites(inviteData);
    } catch {
      // Ignore refresh failures; keep the last successful state visible.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchAll();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchAll]);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !inviteName.trim()) return;
    setInviting(true);
    setInviteError("");

    const res = await fetch("/api/org/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: inviteName,
        email: inviteEmail,
        phone: invitePhone || undefined,
        role: inviteRole,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setInviteError(data.error || "Failed to invite");
      setInviting(false);
      return;
    }

    setGeneratedCode(data.code);
    setInviting(false);
    fetchInvites();
  };

  const handleCloseInviteModal = () => {
    setInviteOpen(false);
    setInviteName("");
    setInviteEmail("");
    setInvitePhone("");
    setInviteRole("organizer");
    setInviteError("");
    setGeneratedCode(null);
  };

  const handleRegenerate = async (inviteId: string) => {
    const res = await fetch(`/api/org/invites/${inviteId}/regenerate`, {
      method: "POST",
    });
    const data = await res.json();
    if (res.ok && data.code) {
      setGeneratedCode(data.code);
      setInviteOpen(true); // Show the code
      fetchInvites();
    }
  };

  const handleRevoke = async (inviteId: string, email: string) => {
    const confirmed = await confirmDialog({
      title: "Revoke invite",
      message: `Revoke the invite for ${email}? They will no longer be able to join with their code.`,
      confirmLabel: "Revoke",
      variant: "danger",
    });
    if (!confirmed) return;
    await fetch(`/api/org/invites/${inviteId}`, { method: "DELETE" });
    fetchInvites();
  };

  const handleResetPassword = async (userId: string, userName: string | null) => {
    const confirmed = await confirmDialog({
      title: "Reset password",
      message: `Generate a new temporary password for ${userName || "this user"}? They will need to change it on next login.`,
      confirmLabel: "Reset",
      variant: "danger",
    });
    if (!confirmed) return;

    const res = await fetch(`/api/users/${userId}/reset-password`, {
      method: "POST",
    });
    const data = await res.json();
    if (res.ok && data.tempPassword) {
      setTempPassword({ userId, password: data.tempPassword });
    }
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const initials = (name: string) =>
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const pendingInvites = invites.filter((i) => i.status === "pending" || i.status === "expired");

  return (
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
              onClick={handleCloseInviteModal}
            />
            <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg">
              <h3 className="text-lg font-semibold mb-4">
                {generatedCode ? "Invite Code Generated" : "Invite Team Member"}
              </h3>

              {generatedCode ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Share this code with the invitee. They can enter it at the login page.
                  </p>
                  <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-2">8-digit invite code</p>
                    <p className="font-mono text-3xl font-bold tracking-[0.25em] text-stone-900">
                      {generatedCode.slice(0, 4)} {generatedCode.slice(4)}
                    </p>
                    <p className="text-xs text-orange-600 mt-2">Expires in 1 hour</p>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => copyToClipboard(generatedCode)}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy code
                  </Button>
                  <Button className="w-full" onClick={handleCloseInviteModal}>
                    Done
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Name *</Label>
                      <Input
                        value={inviteName}
                        onChange={(e) => setInviteName(e.target.value)}
                        placeholder="Full name"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Phone</Label>
                      <Input
                        type="tel"
                        value={invitePhone}
                        onChange={(e) => setInvitePhone(e.target.value)}
                        placeholder="+976 ..."
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="member@devsummit.mn"
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
                    <Button variant="outline" onClick={handleCloseInviteModal}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleInvite}
                      disabled={!inviteEmail.trim() || !inviteName.trim() || inviting}
                    >
                      {inviting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        "Generate invite code"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Temp password display */}
      {tempPassword && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-stone-900">Temporary password generated</p>
              <p className="font-mono text-lg font-bold mt-1">{tempPassword.password}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Share this with the user. They will be asked to change it on next login.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(tempPassword.password)}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => setTempPassword(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Pending invites section */}
      {pendingInvites.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Pending Invites</h3>
          <div className="space-y-1">
            {pendingInvites.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between rounded-md border px-4 py-3 bg-stone-50/50"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-xs font-medium text-stone-400 border border-dashed border-stone-300">
                    {initials(inv.name)}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-stone-600">{inv.name}</p>
                    <p className="text-xs text-muted-foreground">{inv.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    className={statusBadgeColors[inv.status]}
                    variant="outline"
                  >
                    {inv.status}
                  </Badge>
                  <Badge
                    className={roleBadgeColors[inv.role] || roleBadgeColors.organizer}
                    variant="outline"
                  >
                    {inv.role}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-xs"
                    onClick={() => handleRegenerate(inv.id)}
                  >
                    <RefreshCw className="mr-1 h-3 w-3" />
                    Regenerate
                  </Button>
                  <button
                    onClick={() => handleRevoke(inv.id, inv.email)}
                    className="rounded p-1 text-stone-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active members list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 rounded-md bg-stone-100 animate-pulse"
            />
          ))}
        </div>
      ) : members.length === 0 && pendingInvites.length === 0 ? (
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
          {members.length > 0 && pendingInvites.length > 0 && (
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Active Members</h3>
          )}
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
                  <>
                    <button
                      onClick={() => handleResetPassword(m.id, m.name)}
                      className="rounded p-1 text-stone-300 hover:text-yellow-600 hover:bg-yellow-50 transition-colors"
                      title="Reset password"
                    >
                      <KeyRound className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleRemove(m.id, m.name)}
                      className="rounded p-1 text-stone-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Remove member"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
