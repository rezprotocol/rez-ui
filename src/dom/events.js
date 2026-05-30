/**
 * Delegated event binding scoped to a view root. Use for dynamic children.
 */
export function on(rootEl, eventName, selector, handler) {
  if (!rootEl || typeof eventName !== "string" || typeof handler !== "function") return () => {};
  const bound = (e) => {
    if (!selector) {
      handler(e);
      return;
    }
    const target = e.target instanceof Element ? e.target.closest(selector) : null;
    if (target && rootEl.contains(target)) handler(e);
  };
  rootEl.addEventListener(eventName, bound);
  return () => rootEl.removeEventListener(eventName, bound);
}
