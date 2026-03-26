"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Calendar,
  Mic2,
  DollarSign,
  Users,
  ScanLine,
  Settings,
  Menu,
  X,
  HandHelping,
  Store,
  Tv,
  Megaphone,
  MapPin,
  CheckSquare,
  ChevronDown,
  MessageSquare,
  Bell,
  Mail,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/locale-switcher";

type NavItem = { href: string; labelKey: string; icon: React.ElementType };
type NavGroup = { key: string; labelKey: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    key: "program", labelKey: "program",
    items: [
      { href: "/agenda", labelKey: "agenda", icon: Calendar },
      { href: "/speakers", labelKey: "speakers", icon: Mic2 },
    ],
  },
  {
    key: "partnerships", labelKey: "partnerships",
    items: [
      { href: "/sponsors", labelKey: "sponsors", icon: DollarSign },
      { href: "/media", labelKey: "media", icon: Tv },
      { href: "/venue", labelKey: "venues", icon: MapPin },
      { href: "/booths", labelKey: "booths", icon: Store },
    ],
  },
  {
    key: "teamAndTasks", labelKey: "teamAndTasks",
    items: [
      { href: "/tasks", labelKey: "tasks", icon: CheckSquare },
      { href: "/marketing", labelKey: "marketing", icon: Megaphone },
      { href: "/volunteers", labelKey: "volunteers", icon: HandHelping },
    ],
  },
  {
    key: "attendees", labelKey: "attendees",
    items: [
      { href: "/attendees", labelKey: "registration", icon: Users },
      { href: "/invitations", labelKey: "invitations", icon: Mail },
      { href: "/check-in", labelKey: "checkIn", icon: ScanLine },
    ],
  },
];

const topItems: NavItem[] = [
  { href: "/", labelKey: "dashboard", icon: LayoutDashboard },
];

type Edition = {
  id: string;
  name: string;
};

export function Sidebar({ onToggleChat, chatOpen }: { onToggleChat?: () => void; chatOpen?: boolean }) {
  const pathname = usePathname();
  const t = useTranslations("Nav");
  const tc = useTranslations("Common");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(["program", "partnerships", "teamAndTasks", "attendees"])
  );
  const [editions, setEditions] = useState<Edition[]>([]);
  const [activeEdition, setActiveEdition] = useState<string>("");
  const [showEditionPicker, setShowEditionPicker] = useState(false);
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [newEventName, setNewEventName] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  // Poll for notification count every 30s
  useEffect(() => {
    const fetchCount = () => {
      fetch("/api/notifications?count=true")
        .then((r) => r.json())
        .then((d) => { if (d.data?.unreadCount !== undefined) setUnreadCount(d.data.unreadCount); })
        .catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch editions on mount
  useEffect(() => {
    fetch("/api/editions")
      .then((r) => r.json())
      .then((d) => {
        if (d.data?.length) {
          setEditions(d.data);
          const active = d.data.find((e: Edition) => e.id === d.activeEditionId) || d.data[0];
          setActiveEdition(active.name);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Auto-expand the group that contains the active page
  useEffect(() => {
    for (const group of navGroups) {
      if (group.items.some((item) => pathname === item.href || pathname.startsWith(item.href + "/"))) {
        setExpandedGroups((prev) => new Set([...prev, group.key]));
      }
    }
  }, [pathname]);

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href));

  const navLink = (item: NavItem, indent = false) => (
    <Link
      key={item.href}
      href={item.href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors",
        indent && "pl-9",
        isActive(item.href)
          ? "bg-yellow-500/15 font-medium text-yellow-500"
          : "text-stone-400 hover:bg-white/5 hover:text-white"
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      <span>{t(item.labelKey as never)}</span>
    </Link>
  );

  const sidebarContent = (
    <>
      {/* Brand + Edition Selector */}
      <div className="border-b border-stone-800 px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-wider text-stone-500">
          Event OS
        </span>
        {editions.length > 0 && (
          <div className="relative mt-1">
            <button
              onClick={() => setShowEditionPicker(!showEditionPicker)}
              className="flex w-full items-center justify-between rounded-md text-sm font-medium text-white hover:text-yellow-400 transition-colors"
            >
              <span className="truncate">{activeEdition || tc("selectEvent")}</span>
              <ChevronDown className={cn("h-3 w-3 ml-1 shrink-0 transition-transform", showEditionPicker && "rotate-180")} />
            </button>
            {showEditionPicker && (
              <div className="absolute left-0 right-0 top-full mt-1 rounded-md border border-stone-700 bg-stone-800 py-1 z-50 dropdown-active">
                {editions.map((ed) => (
                  <button
                    key={ed.id}
                    onClick={async () => {
                      await fetch("/api/editions/switch", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ editionId: ed.id }),
                      });
                      setActiveEdition(ed.name);
                      setShowEditionPicker(false);
                      window.location.reload();
                    }}
                    className={cn(
                      "block w-full px-3 py-1.5 text-left text-sm transition-colors",
                      ed.name === activeEdition
                        ? "text-yellow-400 bg-yellow-500/10"
                        : "text-stone-300 hover:bg-stone-700 hover:text-white"
                    )}
                  >
                    {ed.name}
                  </button>
                ))}
                <div className="border-t border-stone-700 mt-1 pt-1">
                  {showNewEvent ? (
                    <div className="px-3 py-2 space-y-2">
                      <input
                        autoFocus
                        value={newEventName}
                        onChange={(e) => setNewEventName(e.target.value)}
                        placeholder="e.g., Dev Summit 2027"
                        className="w-full rounded bg-stone-700 border-stone-600 px-2 py-1 text-xs text-white placeholder:text-stone-400 outline-none focus:ring-1 focus:ring-yellow-500"
                        onKeyDown={async (e) => {
                          if (e.key === "Enter" && newEventName.trim()) {
                            const res = await fetch("/api/editions/create", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ name: newEventName }),
                            });
                            if (res.ok) {
                              const json = await res.json();
                              await fetch("/api/editions/switch", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ editionId: json.data.id }),
                              });
                              window.location.reload();
                            }
                          }
                          if (e.key === "Escape") {
                            setShowNewEvent(false);
                            setNewEventName("");
                          }
                        }}
                      />
                      <p className="text-[10px] text-stone-500">{tc("enterToCreate")}</p>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowNewEvent(true)}
                      className="block w-full px-3 py-1.5 text-left text-xs text-yellow-400 hover:bg-stone-700 transition-colors"
                    >
                      {tc("newEvent")}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {/* Top items */}
        {topItems.map((item) => navLink(item))}

        {/* Agent chat trigger */}
        {onToggleChat && (
          <button
            onClick={onToggleChat}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors",
              chatOpen
                ? "text-yellow-500 bg-yellow-500/15 font-medium"
                : "text-stone-400 hover:bg-white/5 hover:text-white"
            )}
          >
            <MessageSquare className="h-4 w-4 shrink-0" />
            <span>{t("agent")}</span>
            <kbd className="ml-auto hidden lg:inline-flex text-[9px] text-stone-500 border border-stone-700 rounded px-1">⌘K</kbd>
          </button>
        )}

        {/* Grouped sections */}
        {navGroups.map((group) => {
          const isExpanded = expandedGroups.has(group.key);
          const hasActive = group.items.some((item) => isActive(item.href));

          return (
            <div key={group.key} className="pt-2">
              <button
                onClick={() => toggleGroup(group.key)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors",
                  hasActive
                    ? "text-stone-200"
                    : "text-stone-500 hover:text-stone-300"
                )}
              >
                <span>{t(group.labelKey as never)}</span>
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform",
                    !isExpanded && "-rotate-90"
                  )}
                />
              </button>
              {isExpanded && (
                <div className="mt-1 space-y-0.5">
                  {group.items.map((item) => navLink(item, true))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-stone-800 px-2 py-3 space-y-1">
        <Link
          href="/notifications"
          className={cn(
            "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors relative",
            isActive("/notifications")
              ? "bg-yellow-500/15 font-medium text-yellow-500"
              : "text-stone-400 hover:bg-white/5 hover:text-white"
          )}
        >
          <Bell className="h-4 w-4 shrink-0" />
          <span>{t("notifications")}</span>
          {unreadCount > 0 && (
            <span className="absolute right-2 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors",
            isActive("/settings")
              ? "bg-yellow-500/15 font-medium text-yellow-500"
              : "text-stone-400 hover:bg-white/5 hover:text-white"
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span>{t("settings")}</span>
        </Link>
        <LocaleSwitcher />
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-stone-200 bg-white px-4 lg:hidden">
        <span className="text-lg font-bold tracking-tight">Event OS</span>
        <div className="flex items-center gap-2">
          {onToggleChat && (
            <button
              onClick={onToggleChat}
              className="rounded-md p-2 text-yellow-600 hover:bg-yellow-50"
              aria-label="Open agent"
            >
              <MessageSquare className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-md p-2 text-stone-600 hover:bg-stone-100"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-56 flex-col bg-stone-900 text-stone-400 transition-transform duration-200",
          "max-lg:-translate-x-full max-lg:w-64",
          mobileOpen && "max-lg:translate-x-0",
          "lg:translate-x-0"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-stone-200 bg-white py-2 lg:hidden">
        {([
          { href: "/", labelKey: "home", icon: LayoutDashboard },
          { href: "/speakers", labelKey: "people", icon: Users },
          { href: "/agenda", labelKey: "event", icon: Calendar },
          { href: "/tasks", labelKey: "ops", icon: CheckSquare },
          { href: "/check-in", labelKey: "checkIn", icon: ScanLine },
        ] as const).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1 text-[10px]",
              isActive(item.href)
                ? "text-yellow-600 font-medium"
                : "text-stone-400"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span>{t(item.labelKey)}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
