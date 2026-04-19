"use client";

import { useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { EventProvider } from "@/lib/event-context";
import { Sidebar } from "@/components/sidebar";
import { ChatPanel } from "@/components/chat-panel";
import { ConfirmProvider } from "@/components/confirm-dialog";
import { applyBrandColor } from "@/lib/brand";
import Link from "next/link";
import { ArrowLeft, Calendar } from "lucide-react";

type SerializedEvent = {
  editionId: string;
  orgId: string;
  slug: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  venue: string | null;
  status: string;
};

function OrgBranding() {
  useEffect(() => {
    fetch("/api/organizations")
      .then((r) => r.json())
      .then((d) => {
        const { logoUrl, brandColor } = d.data || {};
        if (logoUrl) {
          let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
          if (!link) {
            link = document.createElement("link");
            link.rel = "icon";
            document.head.appendChild(link);
          }
          link.href = logoUrl;
        }
        if (brandColor) applyBrandColor(brandColor);
      })
      .catch(() => {});
  }, []);
  return null;
}

function formatEventDates(startDate: string | null, endDate: string | null): string {
  if (!startDate) return "Dates TBD";
  const start = new Date(startDate);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  if (!endDate) return start.toLocaleDateString("en-US", opts);
  const end = new Date(endDate);
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}–${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", opts)}`;
}

export function EventWorkspaceShell({
  event,
  children,
}: {
  event: SerializedEvent;
  children: React.ReactNode;
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const toggleChat = useCallback(() => setChatOpen((prev) => !prev), []);
  const currentPath = usePathname();

  // Close chat panel on navigation
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setChatOpen(false);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [currentPath]);

  // Sync the edition cookie so API calls (agent, etc.) use the right event
  useEffect(() => {
    document.cookie = `active-edition=${event.editionId};path=/`;
  }, [event.editionId]);

  // Cmd+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggleChat();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleChat]);

  // Hydrate dates for context
  const contextValue = {
    editionId: event.editionId,
    orgId: event.orgId,
    slug: event.slug,
    name: event.name,
    startDate: event.startDate ? new Date(event.startDate) : null,
    endDate: event.endDate ? new Date(event.endDate) : null,
    venue: event.venue,
    status: event.status,
  };

  return (
    <ConfirmProvider>
      <OrgBranding />
      <EventProvider value={contextValue}>
        <div className="min-h-screen bg-background">
          {/* Event-aware sidebar header is injected above the standard Sidebar */}
          <div className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col bg-stone-900 text-stone-400 lg:flex">
            {/* Back link + event info */}
            <div className="border-b border-stone-800 px-4 py-3 space-y-2">
              <Link
                href="/"
                className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-300 transition-colors"
              >
                <ArrowLeft className="h-3 w-3" />
                <span>Back to events</span>
              </Link>
              <div>
                <h2 className="text-sm font-medium text-white truncate">{event.name}</h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Calendar className="h-3 w-3 text-stone-500" />
                  <span className="text-[11px] text-stone-500">
                    {formatEventDates(event.startDate, event.endDate)}
                  </span>
                </div>
                {event.venue && (
                  <p className="text-[11px] text-stone-500 truncate mt-0.5">{event.venue}</p>
                )}
              </div>
            </div>
            {/* Render the standard sidebar nav below the event header */}
            <Sidebar onToggleChat={toggleChat} chatOpen={chatOpen} basePath={`/events/${event.slug}`} />
          </div>

          {/* Mobile: show standard sidebar with the header baked in */}
          <div className="lg:hidden">
            <Sidebar onToggleChat={toggleChat} chatOpen={chatOpen} basePath={`/events/${event.slug}`} />
          </div>

          <main
            className={`min-h-screen pt-14 pb-16 lg:pt-0 lg:pb-0 lg:ml-56 transition-all duration-200 ${
              chatOpen ? "lg:mr-[400px]" : ""
            }`}
          >
            <div className="mx-auto max-w-6xl px-4 py-4 lg:px-6 lg:py-6">
              {children}
            </div>
          </main>
          <ChatPanel isOpen={chatOpen} onClose={() => setChatOpen(false)} />
        </div>
      </EventProvider>
    </ConfirmProvider>
  );
}
