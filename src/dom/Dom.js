/**
 * DOM element helpers. Pure creation and attribute/text setters.
 * No app/domain logic.
 */

export function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  if (attrs && typeof attrs === "object") {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      if (k === "className" || k === "class") {
        el.className = String(v);
      } else if (k === "style" && typeof v === "object") {
        Object.assign(el.style, v);
      } else if (typeof v === "boolean") {
        if (v) {
          el.setAttribute(k, "");
          if (k in el) {
            try {
              el[k] = true;
            } catch (_) {}
          }
        } else {
          el.removeAttribute(k);
          if (k in el) {
            try {
              el[k] = false;
            } catch (_) {}
          }
        }
      } else if (k.startsWith("on") && typeof v === "function") {
        const event = k.slice(2).toLowerCase();
        el.addEventListener(event, v);
      } else if (k === "data" && typeof v === "object") {
        for (const [dk, dv] of Object.entries(v)) {
          if (dv != null) el.setAttribute(`data-${dk}`, String(dv));
        }
      } else if (k !== "key" && typeof v !== "function") {
        el.setAttribute(k, String(v));
      }
    }
  }
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child == null) continue;
    if (typeof child === "string" || typeof child === "number") {
      el.appendChild(document.createTextNode(String(child)));
    } else if (child instanceof Node) {
      el.appendChild(child);
    }
  }
  return el;
}

export function setText(el, text) {
  if (!el) return;
  el.textContent = text == null ? "" : String(text);
}

export function setAttrs(el, attrs) {
  if (!el || !attrs || typeof attrs !== "object") return;
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === "className" || k === "class") {
      el.className = String(v);
    } else if (k === "style" && typeof v === "object") {
      Object.assign(el.style, v);
    } else if (typeof v === "boolean") {
      if (v) {
        el.setAttribute(k, "");
        if (k in el) {
          try {
            el[k] = true;
          } catch (_) {}
        }
      } else {
        el.removeAttribute(k);
        if (k in el) {
          try {
            el[k] = false;
          } catch (_) {}
        }
      }
    } else if (k !== "key") {
      el.setAttribute(k, String(v));
    }
  }
}
