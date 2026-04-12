"use client";

import { useTranslations } from "next-intl";
import { useAiTranslation } from "@/lib/hooks/use-ai-translation";

export function useSmartT(namespace: string) {
  const t = useTranslations(namespace);

  return (key: string, fallback: string) => {
    const hasKey = typeof t.has === "function" && t.has(key);
    if (hasKey) {
      return t(key);
    }
    return useAiTranslation(fallback);
  };
}
