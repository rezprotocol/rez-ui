/**
 * Pure string helpers for UI. No IO, no subscriptions.
 */
export function ellipsize(str, maxLen = 32) {
  const s = String(str ?? "").trim();
  if (s.length <= maxLen) return s;
  return s.slice(0, Math.max(0, maxLen - 1)) + "\u2026";
}

export function escapeHtml(str) {
  const s = String(str ?? "");
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
