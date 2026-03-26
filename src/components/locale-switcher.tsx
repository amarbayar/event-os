"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const locales = [
  { code: "en", label: "EN" },
  { code: "mn", label: "MN" },
] as const;

export function LocaleSwitcher() {
  const currentLocale = useLocale();
  const t = useTranslations("Locale");
  const [switching, setSwitching] = useState(false);

  async function switchLocale(locale: string) {
    if (locale === currentLocale || switching) return;
    setSwitching(true);

    try {
      const res = await fetch("/api/me/locale", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });

      if (!res.ok) {
        toast.error(t("changeFailed"));
        setSwitching(false);
        return;
      }

      window.location.reload();
    } catch {
      toast.error(t("changeFailed"));
      setSwitching(false);
    }
  }

  return (
    <div className="flex items-center gap-1 px-3 py-1.5">
      {locales.map((loc) => (
        <button
          key={loc.code}
          onClick={() => switchLocale(loc.code)}
          disabled={switching}
          className={cn(
            "rounded px-2 py-0.5 text-xs font-medium transition-colors",
            loc.code === currentLocale
              ? "bg-yellow-500/15 text-yellow-500"
              : "text-stone-500 hover:text-stone-300 hover:bg-white/5"
          )}
        >
          {loc.label}
        </button>
      ))}
    </div>
  );
}
