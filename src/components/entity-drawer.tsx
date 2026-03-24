"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { X, Maximize2, Minimize2, GripVertical } from "lucide-react";

type DrawerSize = "narrow" | "wide" | "full";

type DrawerSection = {
  label: string;
  content: React.ReactNode;
};

type EntityDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  sections: DrawerSection[];
  onSave?: () => void;
  saving?: boolean;
};

const sizeWidths: Record<DrawerSize, string> = {
  narrow: "w-[400px]",
  wide: "w-[640px]",
  full: "w-full",
};

export function EntityDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  sections,
  onSave,
  saving,
}: EntityDrawerProps) {
  const [size, setSize] = useState<DrawerSize>("wide");
  const [activeTab, setActiveTab] = useState(0);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }
  }, [isOpen, onClose]);

  // Reset tab when drawer opens
  useEffect(() => {
    if (isOpen) setActiveTab(0);
  }, [isOpen]);

  const cycleSize = useCallback(() => {
    setSize((prev) =>
      prev === "narrow" ? "wide" : prev === "wide" ? "full" : "narrow"
    );
  }, []);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 transition-colors",
          size === "full" ? "bg-black/50" : "bg-black/20"
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex flex-col bg-white shadow-2xl transition-all duration-200 border-l border-stone-200",
          sizeWidths[size],
          "max-lg:w-full" // full-screen on mobile always
        )}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-stone-200 px-4 shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="font-medium text-sm truncate">{title}</h2>
            {subtitle && (
              <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={cycleSize}
              className="hidden lg:flex rounded p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
              title={`Switch to ${size === "narrow" ? "wide" : size === "wide" ? "full-screen" : "narrow"}`}
            >
              {size === "full" ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
            {onSave && (
              <Button size="sm" onClick={onSave} disabled={saving} className="h-8">
                {saving ? "Saving..." : "Save"}
              </Button>
            )}
            <button
              onClick={onClose}
              className="rounded p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        {sections.length > 1 && (
          <div className="flex border-b border-stone-200 px-4 shrink-0 overflow-x-auto">
            {sections.map((section, i) => (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                className={cn(
                  "px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap",
                  activeTab === i
                    ? "border-yellow-500 text-yellow-700"
                    : "border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300"
                )}
              >
                {section.label}
              </button>
            ))}
          </div>
        )}

        {/* Content — all tabs rendered, only active visible (preserves form state) */}
        <div className="flex-1 overflow-y-auto">
          {sections.map((section, i) => (
            <div key={i} className={cn("p-4", activeTab !== i && "hidden")}>
              {section.content}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
