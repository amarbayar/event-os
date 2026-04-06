"use client";

import { useTranslations, useMessages } from "next-intl";
import { useAiTranslation } from "@/lib/hooks/use-ai-translation";

function getNested(obj: any, path: string) {
  return path.split(".").reduce((acc, part) => acc?.[part], obj);
}

export function useI18nWithFallback(
  namespace: string,
  key: string,
  fallback: string,
) {
  const t = useTranslations(namespace);
  const messages = useMessages();

  const fullKey = `${namespace}.${key}`;
  const exists = getNested(messages, fullKey);
  if (exists) {
    return t(key);
  }
  return useAiTranslation(fallback);
}
