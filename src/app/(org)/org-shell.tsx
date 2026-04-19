/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Settings, User, LogOut, KeyRound } from "lucide-react";
import { applyBrandColor } from "@/lib/brand";

type OrgData = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  brandColor: string | null;
};

export function OrgShell({
  org,
  userName,
  userEmail,
  userRole,
  children,
}: {
  org: OrgData;
  userName: string;
  userEmail: string;
  userRole: string;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (org.brandColor) applyBrandColor(org.brandColor);
    if (org.logoUrl) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = org.logoUrl;
    }
  }, [org.brandColor, org.logoUrl]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const initials = userName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const isAdmin = userRole === "owner" || userRole === "admin";
  const roleLabel = userRole.charAt(0).toUpperCase() + userRole.slice(1);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 lg:px-6">
          {/* Left: Org identity */}
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            {org.logoUrl ? (
              <img
                src={org.logoUrl}
                alt={org.name}
                className="h-8 w-8 rounded-md object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
                {org.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className="text-sm font-semibold text-stone-900">{org.name}</span>
          </Link>

          {/* Right: Settings + Avatar dropdown */}
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link
                href="/settings"
                className="rounded-md p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-700 transition-colors"
                aria-label="Settings"
              >
                <Settings className="h-4 w-4" />
              </Link>
            )}

            {/* Avatar with dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-xs font-medium text-stone-600 hover:bg-stone-200 transition-colors"
              >
                {initials || <User className="h-4 w-4" />}
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-1 w-64 rounded-lg border bg-white shadow-lg py-1 z-50">
                  {/* User info */}
                  <div className="px-4 py-3 border-b">
                    <p className="text-sm font-medium text-stone-900">{userName}</p>
                    <p className="text-xs text-stone-500">{userEmail}</p>
                    <span className="inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-stone-100 text-stone-600">
                      {roleLabel}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="py-1">
                    <Link
                      href="/change-password"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
                      onClick={() => setMenuOpen(false)}
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      Change password
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/settings"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
                        onClick={() => setMenuOpen(false)}
                      >
                        <Settings className="h-3.5 w-3.5" />
                        Organization settings
                      </Link>
                    )}
                  </div>

                  {/* Sign out */}
                  <div className="border-t py-1">
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        window.location.href = "/api/auth/signout";
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
        {children}
      </main>
    </div>
  );
}
