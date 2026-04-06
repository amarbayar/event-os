"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";

const cache = new Map<string, string | Promise<string>>();

const LOCALE_TO_LANGUAGE: Record<string, string> = {
  en: "English",
  mn: "Mongolian",
};

function looksLikeMongolian(text: string) {
  return /[\u0400-\u04FF]/.test(text);
}

const ENABLED = process.env.NEXT_PUBLIC_ENABLE_AI_TRANSLATION === "true";

export function useAiTranslation(text: string) {
  const locale = useLocale();
  const [translated, setTranslated] = useState(text);

  useEffect(() => {
    setTranslated(text);
  }, [text]);

  useEffect(() => {
    if (!ENABLED || !text) return;

    const normalized = text.trim().toLowerCase();
    const cacheKey = `${locale}:${normalized}`;

    const cached = cache.get(cacheKey);

    if (cached) {
      if (typeof cached === "string") {
        setTranslated(cached);
      } else {
        cached.then(setTranslated);
      }
      return;
    }

    const isMn = looksLikeMongolian(text);

    // Skip unnecessary translation
    if ((locale === "mn" && isMn) || (locale === "en" && !isMn)) {
      setTranslated(text);
      return;
    }

    const target = LOCALE_TO_LANGUAGE[locale] || "English";

    let cancelled = false;

    const promise = fetch("/api/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, target }),
    })
      .then((res) => res.json())
      .then((data) => data.translated || text)
      .catch(() => text);

    cache.set(cacheKey, promise);

    promise.then((result) => {
      if (cancelled) return;

      cache.set(cacheKey, result);
      setTranslated(result);
    });

    return () => {
      cancelled = true;
    };
  }, [text, locale]);

  return translated;
}
