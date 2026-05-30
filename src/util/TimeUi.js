/**
 * Pure time-formatting helpers for UI. No IO, no subscriptions.
 */
export function formatTime(ms) {
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatRelative(ms, nowMs = Date.now()) {
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms);
  const now = new Date(nowMs);
  const today = now.toDateString();
  const then = d.toDateString();
  if (then === today) return formatTime(ms);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (then === yesterday.toDateString()) return "YESTERDAY";
  const diffDays = Math.floor((nowMs - ms) / 86400000);
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" }).toUpperCase();
  return d.toLocaleDateString([], { month: "short", day: "numeric" }).toUpperCase();
}
