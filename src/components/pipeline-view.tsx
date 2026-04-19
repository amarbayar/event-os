"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

type Source = "all" | "intake" | "outreach" | "sponsored";
type Stage = "all" | "lead" | "engaged" | "confirmed" | "declined";

export const sourceKeys: Record<Source, string> = {
  all: "sourceAll",
  intake: "sourceIntake",
  outreach: "sourceOutreach",
  sponsored: "sourceSponsored",
};

const stageColors: Record<Exclude<Stage, "all">, string> = {
  lead: "bg-stone-100 text-stone-600",
  engaged: "bg-sky-50 text-sky-700",
  confirmed: "bg-emerald-50 text-emerald-700",
  declined: "bg-red-50 text-red-600",
};

export const stageKeys: Record<Exclude<Stage, "all">, string> = {
  lead: "stageLead",
  engaged: "stageEngaged",
  confirmed: "stageConfirmed",
  declined: "stageDeclined",
};

export function StageBadge({ stage }: { stage: string }) {
  const t = useTranslations("Pipeline");
  const color = stageColors[stage as Exclude<Stage, "all">];
  const key = stageKeys[stage as Exclude<Stage, "all">];
  if (!color || !key) return <Badge variant="secondary">{stage}</Badge>;
  return <Badge className={color}>{t(key)}</Badge>;
}

export function SourceBadge({ source }: { source: string }) {
  const t = useTranslations("Pipeline");
  const colors: Record<string, string> = {
    intake: "bg-violet-50 text-violet-700",
    outreach: "bg-sky-50 text-sky-700",
    sponsored: "bg-yellow-50 text-yellow-700",
  };
  const key = sourceKeys[source as Source];
  return <Badge className={colors[source] || "bg-stone-100 text-stone-600"}>{key ? t(key) : source}</Badge>;
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

  const t = useTranslations("Pipeline");

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
          >
            {t(sourceKeys[src])}
            {src !== "all" && (
              <span className="ml-1 tabular-nums">
                ({items.filter((i) => i.source === src).length})
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* Pipeline funnel — visual flow */}
      <div className="flex items-stretch overflow-x-auto rounded-lg border bg-white" suppressHydrationWarning>
        {(["lead", "engaged", "confirmed", "declined"] as const).map((stage, i) => {
          const isActive = activeStage === stage;
          const isAll = activeStage === "all";
          const count = stageCounts[stage];

          // Use fully static class names so Tailwind can detect them
          const activeClasses = {
            lead: "bg-stone-100 border-b-2 border-stone-500 text-stone-800",
            engaged: "bg-sky-50 border-b-2 border-sky-500 text-sky-800",
            confirmed: "bg-emerald-50 border-b-2 border-emerald-500 text-emerald-800",
            declined: "bg-red-50 border-b-2 border-red-500 text-red-700",
          }[stage];

          const countColors = {
            lead: "text-stone-700",
            engaged: "text-sky-700",
            confirmed: "text-emerald-700",
            declined: "text-red-600",
          }[stage];

          return (
            <button
              key={stage}
              onClick={() => onStageChange(isActive ? "all" : stage)}
              className={cn(
                "flex-1 min-w-[100px] px-4 py-3 text-center transition-all relative",
                "hover:bg-stone-50",
                i > 0 && "border-l border-stone-200",
                isActive
                  ? activeClasses
                  : "border-b-2 border-transparent"
              )}
            >
              <p className={cn(
                "text-xl font-bold tabular-nums",
                isActive || isAll ? countColors : "text-stone-300"
              )}>
                {count}
              </p>
              <p className={cn(
                "text-[10px] uppercase tracking-wider font-medium",
                isActive ? countColors : isAll && count > 0 ? "text-stone-500" : "text-stone-300"
              )}>
                {t(stageKeys[stage])}
              </p>
              {i < 3 && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 text-stone-200">
                  <ArrowRight className="h-3 w-3" />
                </div>
              )}
            </button>
          );
        })}
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
