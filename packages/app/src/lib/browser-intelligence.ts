/**
 * Browser Intelligence — extracts user context from browser APIs without AI.
 * Used to pre-fill, auto-select, or suggest answers during profiling.
 */

export interface BrowserContext {
  /** Detected language code (e.g., "pl", "en", "de") */
  language: string;
  /** Full locale (e.g., "pl-PL", "en-US") */
  locale: string;
  /** Suggested timezone region based on Intl API */
  timezoneRegion: string | null;
  /** Raw IANA timezone (e.g., "Europe/Warsaw") */
  timezone: string;
  /** Suggested location option value */
  locationOption: string | null;
  /** Suggested language option value */
  languageOption: string | null;
  /** Hour format preference (12h vs 24h) */
  hour12: boolean;
  /** Currency guess from locale */
  currency: string | null;
  /** Platform (mobile/desktop) */
  platform: "mobile" | "desktop";
  /** Screen size category */
  screenSize: "small" | "medium" | "large";
}

/**
 * Detect user context from browser APIs.
 * No network calls, no permissions needed — pure client-side.
 */
export function detectBrowserContext(): BrowserContext {
  const lang = navigator.language || "en";
  const langCode = lang.split("-")[0].toLowerCase();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  return {
    language: langCode,
    locale: lang,
    timezone,
    timezoneRegion: guessTimezoneRegion(timezone),
    locationOption: guessLocationOption(timezone),
    languageOption: guessLanguageOption(langCode),
    hour12: detect12HourFormat(lang),
    currency: guessCurrency(lang),
    platform: detectPlatform(),
    screenSize: detectScreenSize(),
  };
}

function guessTimezoneRegion(tz: string): string | null {
  if (tz.startsWith("Europe/")) {
    const centralEU = ["Warsaw", "Prague", "Budapest", "Bratislava", "Vienna", "Zagreb", "Ljubljana", "Bucharest", "Sofia"];
    const city = tz.split("/")[1];
    if (centralEU.some(c => city?.includes(c))) return "CET";
    return "WET/CET";
  }
  if (tz.startsWith("America/")) {
    const eastern = ["New_York", "Toronto", "Montreal", "Detroit", "Miami", "Boston"];
    const western = ["Los_Angeles", "San_Francisco", "Seattle", "Vancouver", "Portland"];
    const city = tz.split("/")[1];
    if (eastern.some(c => city?.includes(c))) return "ET";
    if (western.some(c => city?.includes(c))) return "PT";
    return "CT"; // Central as fallback
  }
  if (tz.startsWith("Asia/") || tz.startsWith("Australia/") || tz.startsWith("Pacific/")) return "APAC";
  return null;
}

function guessLocationOption(tz: string): string | null {
  if (tz.startsWith("Europe/")) {
    const centralEU = ["Warsaw", "Prague", "Budapest", "Bratislava", "Vienna", "Zagreb", "Ljubljana", "Bucharest", "Sofia"];
    const city = tz.split("/")[1];
    if (centralEU.some(c => city?.includes(c))) return "europe_central";
    return "europe_west";
  }
  if (tz.startsWith("America/")) {
    const eastern = ["New_York", "Toronto", "Montreal", "Detroit", "Miami", "Boston", "Philadelphia", "Washington"];
    const city = tz.split("/")[1];
    if (eastern.some(c => city?.includes(c))) return "us_east";
    return "us_west";
  }
  if (tz.startsWith("Asia/") || tz.startsWith("Australia/") || tz.startsWith("Pacific/")) return "asia_pacific";
  return "other";
}

function guessLanguageOption(lang: string): string | null {
  const supported = ["en", "pl", "de", "es", "fr"];
  if (supported.includes(lang)) return lang;
  return null;
}

function detect12HourFormat(locale: string): boolean {
  try {
    const formatted = new Intl.DateTimeFormat(locale, { hour: "numeric" }).format(new Date());
    return /AM|PM/i.test(formatted);
  } catch {
    return false;
  }
}

function guessCurrency(locale: string): string | null {
  const map: Record<string, string> = {
    "pl": "PLN", "de": "EUR", "fr": "EUR", "es": "EUR", "it": "EUR",
    "nl": "EUR", "pt": "EUR", "en-US": "USD", "en-GB": "GBP",
    "ja": "JPY", "ko": "KRW", "zh": "CNY",
  };
  return map[locale] || map[locale.split("-")[0]] || null;
}

function detectPlatform(): "mobile" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? "mobile" : "desktop";
}

function detectScreenSize(): "small" | "medium" | "large" {
  if (typeof window === "undefined") return "large";
  const w = window.innerWidth;
  if (w < 640) return "small";
  if (w < 1024) return "medium";
  return "large";
}

/**
 * Get smart default/suggestion for a question based on browser context.
 * Returns { autoSelect: string } if we should auto-select an option,
 * or { suggest: string } if we should highlight/suggest but not auto-select.
 */
export function getSmartDefault(
  questionId: string,
  ctx: BrowserContext
): { autoSelect?: string; suggest?: string; placeholder?: string } | null {
  switch (questionId) {
    case "t0_q02": // Language
      if (ctx.languageOption) return { suggest: ctx.languageOption };
      return null;

    case "t0_q03": // Location
      if (ctx.locationOption) return { suggest: ctx.locationOption };
      return null;

    case "t0_q03a": // Timezone (open text follow-up)
      return { placeholder: ctx.timezone };

    default:
      return null;
  }
}
