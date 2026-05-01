"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { GeneralTab } from "./general-tab";
import { BrandingTab } from "./branding-tab";
import { TeamTab } from "./team-tab";
import { AiModelTab } from "./ai-model-tab";
import { MessagingTab } from "./messaging-tab";
import { TracksTab } from "./tracks-tab";
import { DangerZoneTab } from "./danger-zone-tab";

type Tab = "general" | "branding" | "team" | "tracks" | "ai" | "messaging" | "danger";

export default function OrgSettingsPage() {
  const [tab, setTab] = useState<Tab>("general");

  const tabs: { key: Tab; label: string }[] = [
    { key: "general", label: "General" },
    { key: "branding", label: "Branding" },
    { key: "team", label: "Team" },
    { key: "tracks", label: "Tracks" },
    { key: "ai", label: "AI Model" },
    { key: "messaging", label: "Messaging" },
    { key: "danger", label: "Danger Zone" },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to events
      </Link>
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Organization Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your organization, team, and integrations
        </p>
      </div>

      {/* Tab navigation */}
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

      {tab === "general" && <GeneralTab />}
      {tab === "branding" && <BrandingTab />}
      {tab === "team" && <TeamTab />}
      {tab === "tracks" && <TracksTab />}
      {tab === "ai" && <AiModelTab />}
      {tab === "messaging" && <MessagingTab />}
      {tab === "danger" && <DangerZoneTab />}
    </div>
  );
}
