"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Calendar,
  Mic2,
  Building2,
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
  Send,
  CheckSquare,
  Ticket,
  ChevronDown,
  MessageSquare,
} from "lucide-react";
import { useState, useEffect } from "react";

type NavGroup = {
  label: string;
  items: { href: string; label: string; icon: React.ElementType }[];
};

const navGroups: NavGroup[] = [
  {
    label: "People",
    items: [
      { href: "/speakers", label: "Speakers", icon: Mic2 },
      { href: "/sponsors", label: "Sponsors", icon: Building2 },
      { href: "/volunteers", label: "Volunteers", icon: HandHelping },
      { href: "/media", label: "Media", icon: Tv },
      { href: "/outreach", label: "Outreach", icon: Send },
    ],
  },
  {
    label: "Event",
    items: [
      { href: "/agenda", label: "Agenda", icon: Calendar },
      { href: "/venue", label: "Venue", icon: MapPin },
      { href: "/booths", label: "Booths", icon: Store },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/tasks", label: "Tasks", icon: CheckSquare },
      { href: "/marketing", label: "Marketing", icon: Megaphone },
      { href: "/attendees", label: "Attendees", icon: Users },
      { href: "/invitations", label: "Invitations", icon: Ticket },
    ],
  },
];

const topItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
];

const bottomItems = [
  { href: "/check-in", label: "Check-in", icon: ScanLine },
];

export function Sidebar({ onToggleChat }: { onToggleChat?: () => void }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(["People", "Event", "Operations"])
  );

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Auto-expand the group that contains the active page
  useEffect(() => {
    for (const group of navGroups) {
      if (group.items.some((item) => pathname === item.href || pathname.startsWith(item.href + "/"))) {
        setExpandedGroups((prev) => new Set([...prev, group.label]));
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

  const navLink = (item: { href: string; label: string; icon: React.ElementType }, indent = false) => (
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
      <span>{item.label}</span>
    </Link>
  );

  const sidebarContent = (
    <>
      {/* Brand */}
      <div className="flex h-14 items-center border-b border-stone-800 px-4">
        <span className="text-lg font-bold tracking-tight text-white">
          Event OS
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {/* Top items */}
        {topItems.map((item) => navLink(item))}

        {/* Agent chat trigger */}
        {onToggleChat && (
          <button
            onClick={onToggleChat}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-sm text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20 transition-colors"
          >
            <MessageSquare className="h-4 w-4 shrink-0" />
            <span className="font-medium">Agent</span>
          </button>
        )}

        {/* Grouped sections */}
        {navGroups.map((group) => {
          const isExpanded = expandedGroups.has(group.label);
          const hasActive = group.items.some((item) => isActive(item.href));

          return (
            <div key={group.label} className="pt-2">
              <button
                onClick={() => toggleGroup(group.label)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors",
                  hasActive
                    ? "text-stone-200"
                    : "text-stone-500 hover:text-stone-300"
                )}
              >
                <span>{group.label}</span>
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
        {bottomItems.map((item) => navLink(item))}
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
          <span>Settings</span>
        </Link>
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
        {[
          { href: "/", label: "Home", icon: LayoutDashboard },
          { href: "/speakers", label: "People", icon: Users },
          { href: "/agenda", label: "Event", icon: Calendar },
          { href: "/tasks", label: "Ops", icon: CheckSquare },
          { href: "/check-in", label: "Check-in", icon: ScanLine },
        ].map((item) => (
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
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
