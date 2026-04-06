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

export function useAiTranslation(text: string) {
  const locale = useLocale();
  const [translated, setTranslated] = useState(text);

  useEffect(() => {
    console.log("🔁 Reset text:", text);
    setTranslated(text);
  }, [text]);

  useEffect(() => {
    if (!text) {
      console.log("⛔ No text provided");
      return;
    }

    const cacheKey = `${locale}:${text.trim().toLowerCase()}`;
    console.log("🌍 Locale:", locale);
    console.log("📝 Input text:", text);
    console.log("🗂 Cache key:", cacheKey);

    const cached = cache.get(cacheKey);

    if (cached) {
      console.log("⚡ Cache hit:", cached);

      if (typeof cached === "string") {
        setTranslated(cached);
      } else {
        cached.then((res) => {
          console.log("⏳ Cache promise resolved:", res);
          setTranslated(res);
        });
      }
      return;
    }

    const isMn = looksLikeMongolian(text);
    console.log("🔎 Detected Mongolian:", isMn);

    if ((locale === "mn" && isMn) || (locale === "en" && !isMn)) {
      console.log("✅ No translation needed");
      setTranslated(text);
      return;
    }

    const target = LOCALE_TO_LANGUAGE[locale] || "English";
    console.log("🎯 Target language:", target);

    let cancelled = false;

    console.log("🚀 Sending request to /api/translate...");

    const promise = fetch("/api/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, target }),
    })
      .then((res) => {
        console.log("📡 Response status:", res.status);
        return res.json();
      })
      .then((data) => {
        console.log("📦 API response:", data);
        return data.translated || text;
      })
      .catch((err) => {
        console.error("❌ Fetch error:", err);
        return text;
      });

    cache.set(cacheKey, promise);

    promise.then((result) => {
      if (cancelled) {
        console.log("🚫 Cancelled request");
        return;
      }

      console.log("✅ Final translated result:", result);

      cache.set(cacheKey, result);
      setTranslated(result);
    });

    return () => {
      cancelled = true;
    };
  }, [text, locale]);

  return translated;
}
