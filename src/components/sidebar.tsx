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
  PanelLeftClose,
  PanelLeft,
  Menu,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/speakers", label: "Speakers", icon: Mic2 },
  { href: "/sponsors", label: "Sponsors", icon: Building2 },
  { href: "/attendees", label: "Attendees", icon: Users },
  { href: "/check-in", label: "Check-in", icon: ScanLine },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-stone-200 bg-white px-4 lg:hidden">
        <span className="text-lg font-bold tracking-tight">Event OS</span>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-md p-2 text-stone-600 hover:bg-stone-100"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — hidden on mobile, slide-out when open */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col bg-stone-900 text-stone-400 transition-all duration-200",
          // Mobile: off-screen right by default, slide in when open
          "max-lg:-translate-x-full max-lg:w-64",
          mobileOpen && "max-lg:translate-x-0",
          // Desktop collapse behavior
          "lg:translate-x-0",
          collapsed ? "lg:w-14" : "lg:w-56"
        )}
      >
        {/* Brand */}
        <div
          className={cn(
            "flex h-14 items-center border-b border-stone-800 px-4",
            collapsed && "lg:justify-center lg:px-0"
          )}
        >
          {collapsed ? (
            <span className="hidden lg:block text-lg font-bold text-yellow-500">E</span>
          ) : null}
          <span className={cn(
            "text-lg font-bold tracking-tight text-white",
            collapsed && "lg:hidden"
          )}>
            Event OS
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-2 py-3">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  collapsed && "lg:justify-center lg:px-0",
                  isActive
                    ? "bg-yellow-500/15 font-medium text-yellow-500"
                    : "hover:bg-white/5 hover:text-white"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className={cn(collapsed && "lg:hidden")}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-stone-800 px-2 py-3 space-y-1">
          <Link
            href="/settings"
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-white/5 hover:text-white",
              collapsed && "lg:justify-center lg:px-0",
              pathname === "/settings" &&
                "bg-yellow-500/15 font-medium text-yellow-500"
            )}
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span className={cn(collapsed && "lg:hidden")}>Settings</span>
          </Link>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "hidden lg:flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-white/5 hover:text-white",
              collapsed && "justify-center px-0"
            )}
          >
            {collapsed ? (
              <PanelLeft className="h-4 w-4 shrink-0" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4 shrink-0" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav — quick access to key pages */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-stone-200 bg-white py-2 lg:hidden">
        {navItems.slice(0, 5).map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1 text-[10px]",
                isActive
                  ? "text-yellow-600 font-medium"
                  : "text-stone-400"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
