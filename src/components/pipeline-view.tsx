"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

type Source = "all" | "intake" | "outreach" | "sponsored";
type Stage = "all" | "lead" | "engaged" | "confirmed" | "declined";

const sourceLabels: Record<Source, string> = {
  all: "All",
  intake: "Intake",
  outreach: "Outreach",
  sponsored: "Sponsored",
};

const stageConfig: Record<Exclude<Stage, "all">, { label: string; color: string }> = {
  lead: { label: "Lead", color: "bg-stone-100 text-stone-600" },
  engaged: { label: "Engaged", color: "bg-sky-50 text-sky-700" },
  confirmed: { label: "Confirmed", color: "bg-emerald-50 text-emerald-700" },
  declined: { label: "Declined", color: "bg-red-50 text-red-600" },
};

export function StageBadge({ stage }: { stage: string }) {
  const config = stageConfig[stage as Exclude<Stage, "all">];
  if (!config) return <Badge variant="secondary">{stage}</Badge>;
  return <Badge className={config.color}>{config.label}</Badge>;
}

export function SourceBadge({ source }: { source: string }) {
  const colors: Record<string, string> = {
    intake: "bg-violet-50 text-violet-700",
    outreach: "bg-sky-50 text-sky-700",
    sponsored: "bg-yellow-50 text-yellow-700",
  };
  return <Badge className={colors[source] || "bg-stone-100 text-stone-600"}>{source}</Badge>;
}

export function PipelineFilters({
  items,
  sources,
  activeSource,
  activeStage,
  onSourceChange,
  onStageChange,
}: {
  items: Array<{ source: string; stage: string }>;
  sources: Source[];
  activeSource: Source;
  activeStage: Stage;
  onSourceChange: (s: Source) => void;
  onStageChange: (s: Stage) => void;
}) {
  const stageCounts = {
    lead: items.filter((i) => i.stage === "lead").length,
    engaged: items.filter((i) => i.stage === "engaged").length,
    confirmed: items.filter((i) => i.stage === "confirmed").length,
    declined: items.filter((i) => i.stage === "declined").length,
  };

  return (
    <div className="space-y-3 mb-4">
      {/* Source tabs */}
      <div className="flex flex-wrap gap-2">
        {sources.map((src) => (
          <Button
            key={src}
            variant={activeSource === src ? "default" : "outline"}
            size="sm"
            onClick={() => onSourceChange(src)}
            className="capitalize"
          >
            {sourceLabels[src]}
            {src !== "all" && (
              <span className="ml-1 tabular-nums">
                ({items.filter((i) => i.source === src).length})
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* Pipeline funnel */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {(["lead", "engaged", "confirmed", "declined"] as const).map((stage, i) => (
          <div key={stage} className="flex items-center shrink-0">
            <button
              onClick={() => onStageChange(activeStage === stage ? "all" : stage)}
              className={`rounded-md px-3 py-1.5 text-center min-w-[80px] transition-colors ${
                activeStage === stage ? "ring-2 ring-yellow-500" : ""
              }`}
            >
              <p className={`text-lg font-semibold tabular-nums ${
                stage === "confirmed" ? "text-emerald-600" :
                stage === "declined" ? "text-red-500" : ""
              }`}>
                {stageCounts[stage]}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stage}</p>
            </button>
            {i < 3 && <ArrowRight className="h-3 w-3 text-stone-300 shrink-0 mx-0.5" />}
          </div>
        ))}
      </div>
    </div>
  );
}

export function usePipelineFilters() {
  const [source, setSource] = useState<Source>("all");
  const [stage, setStage] = useState<Stage>("all");

  const filter = <T extends { source: string; stage: string }>(items: T[]): T[] => {
    return items
      .filter((i) => source === "all" || i.source === source)
      .filter((i) => stage === "all" || i.stage === stage);
  };

  return { source, stage, setSource, setStage, filter };
}
