"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEventContext } from "@/lib/event-context";
import { EventDetailsTab } from "./event-details-tab";
import { AgendaConfigTab } from "./agenda-config-tab";
import { ChecklistsTab } from "./checklists-tab";
import { DangerZoneTab } from "./danger-zone-tab";
import { LocaleSwitcher } from "@/components/locale-switcher";

type Tab = "details" | "agenda" | "checklists" | "danger";

export default function EventSettingsPage() {
  const event = useEventContext();
  const [tab, setTab] = useState<Tab>("details");

  const tabs: { key: Tab; label: string }[] = [
    { key: "details", label: "Event Details" },
    { key: "agenda", label: "Agenda" },
    { key: "checklists", label: "Checklists" },
    { key: "danger", label: "Danger Zone" },
  ];

  return (
    <div>
      <Link
        href={`/events/${event.slug}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
      </Link>
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Event Settings
        </h1>
        <p className="text-sm text-muted-foreground">{event.name}</p>
      </div>

      <div className="flex gap-1 border-b mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap",
              tab === t.key
                ? "border-yellow-500 text-yellow-700"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "details" && (
        <>
          <EventDetailsTab />
          <div className="mt-8 pt-6 border-t">
            <h3 className="text-sm font-medium mb-2">Language</h3>
            <p className="text-xs text-muted-foreground mb-3">Choose your preferred interface language</p>
            <LocaleSwitcher variant="settings" />
          </div>
        </>
      )}
      {tab === "agenda" && <AgendaConfigTab />}
      {tab === "checklists" && <ChecklistsTab />}
      {tab === "danger" && <DangerZoneTab />}
    </div>
  );
}
