const LOCALE_MAP: Record<string, string> = {
  en: "en-US",
  mn: "mn-MN",
};

function resolveLocale(locale: string): string {
  return LOCALE_MAP[locale] || "en-US";
}

export function formatDate(
  date: Date | string,
  locale: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const defaults: Intl.DateTimeFormatOptions = {
    month: "long",
    day: "numeric",
    year: "numeric",
  };
  return new Intl.DateTimeFormat(resolveLocale(locale), options ?? defaults).format(
    new Date(date),
  );
}

export function formatTime(date: Date | string, locale: string): string {
  return new Intl.DateTimeFormat(resolveLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(date));
}
