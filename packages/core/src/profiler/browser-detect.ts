/**
 * Browser auto-detection for profiling.
 * Runs synchronously at profiling start.
 */
export function detectBrowserSignals(): Record<string, string> {
  if (typeof window === "undefined") return {};

  const signals: Record<string, string> = {};

  // Locale
  signals["identity.locale"] = navigator.language?.split("-")[0] || "en";

  // Timezone
  try {
    signals["identity.timezone"] = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {}

  // Platform
  const ua = navigator.userAgent || navigator.platform || "";
  if (ua.includes("Mac")) signals["context.platform"] = "macOS";
  else if (ua.includes("Win")) signals["context.platform"] = "Windows";
  else if (ua.includes("Linux")) signals["context.platform"] = "Linux";
  else if (ua.includes("Android")) signals["context.platform"] = "Android";
  else if (/iPhone|iPad/.test(ua)) signals["context.platform"] = "iOS";

  // Screen size classification
  const w = window.screen?.width || window.innerWidth;
  if (w < 768) signals["context.device"] = "mobile";
  else if (w < 1200) signals["context.device"] = "tablet";
  else signals["context.device"] = "desktop";

  // Color scheme
  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    signals["context.color_scheme"] = "dark";
  } else {
    signals["context.color_scheme"] = "light";
  }

  // Touch vs mouse
  const hasTouch = "ontouchstart" in window || (navigator.maxTouchPoints || 0) > 0;
  const hasMouse = window.matchMedia?.("(pointer: fine)").matches;
  if (hasTouch && hasMouse) signals["context.input_method"] = "hybrid";
  else if (hasTouch) signals["context.input_method"] = "touch";
  else signals["context.input_method"] = "mouse";

  // Languages (multilingual detection)
  const langs = navigator.languages;
  if (langs && langs.length > 1) {
    signals["identity.languages"] = langs
      .map((l) => l.split("-")[0])
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(", ");
  }

  // Connection speed
  const conn = (navigator as any).connection;
  if (conn?.effectiveType) {
    signals["context.connection"] = conn.effectiveType; // "4g", "3g", "2g", "slow-2g"
  }

  // Device memory
  const mem = (navigator as any).deviceMemory;
  if (mem) {
    if (mem <= 2) signals["context.device_class"] = "low-end";
    else if (mem <= 4) signals["context.device_class"] = "mid-range";
    else signals["context.device_class"] = "high-end";
  }

  return signals;
}
