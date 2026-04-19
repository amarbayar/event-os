"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/confirm-dialog";
import { Bell, Check, Trash2, ExternalLink } from "lucide-react";
import Link from "next/link";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  entityType: string | null;
  actorName: string | null;
  read: boolean;
  createdAt: string;
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const { confirm: confirmDialog } = useConfirm();

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    const params = filter === "unread" ? "?unread=true" : "";
    try {
      const response = await fetch(`/api/notifications${params}`);
      const data = await response.json();
      if (data.data) setNotifications(data.data);
    } catch {}
    finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchNotifications();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchNotifications]);

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  const deleteOne = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: "DELETE" });
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_all_read" }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const deleteAllRead = async () => {
    const confirmed = await confirmDialog({
      title: "Delete all read notifications",
      message: "Remove all read notifications? This cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) return;
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_all_read" }),
    });
    setNotifications((prev) => prev.filter((n) => !n.read));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const formatTimestamp = (dateStr: string) =>
    new Date(dateStr).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <div>
      <div className="mb-6 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button size="sm" variant="outline" onClick={markAllRead}>
              <Check className="mr-2 h-3 w-3" /> Mark all read
            </Button>
          )}
          {notifications.some((n) => n.read) && (
            <Button size="sm" variant="outline" onClick={deleteAllRead}>
              <Trash2 className="mr-2 h-3 w-3" /> Clear read
            </Button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b mb-4">
        {(["all", "unread"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              filter === f ? "border-yellow-500 text-yellow-700" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {f} {f === "unread" && unreadCount > 0 && `(${unreadCount})`}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-md bg-stone-100 animate-pulse" />)}
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed p-12 text-center">
          <Bell className="h-10 w-10 text-stone-300 mx-auto mb-3" />
          <p className="text-muted-foreground">
            {filter === "unread" ? "No unread notifications" : "No notifications yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-3 rounded-md border px-4 py-3 transition-colors hover:bg-accent/30 ${
                !n.read ? "bg-yellow-50/50 border-yellow-200" : ""
              }`}
            >
              {/* Unread dot */}
              <div className="mt-1.5 shrink-0">
                {!n.read ? (
                  <span className="block w-2 h-2 rounded-full bg-yellow-500" />
                ) : (
                  <span className="block w-2 h-2 rounded-full bg-transparent" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${!n.read ? "font-medium" : ""}`}>{n.title}</p>
                {n.message && <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-muted-foreground">{formatTimestamp(n.createdAt)}</span>
                  {n.actorName && <span className="text-[10px] text-stone-400">by {n.actorName}</span>}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {n.link && (
                  <Link href={n.link} onClick={() => !n.read && markRead(n.id)} className="rounded p-1.5 hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                )}
                {!n.read && (
                  <button onClick={() => markRead(n.id)} className="rounded p-1.5 hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors" title="Mark read">
                    <Check className="h-3.5 w-3.5" />
                  </button>
                )}
                <button onClick={() => deleteOne(n.id)} className="rounded p-1.5 hover:bg-red-50 text-stone-400 hover:text-red-500 transition-colors" title="Delete">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
