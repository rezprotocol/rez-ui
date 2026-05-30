/**
 * Keyed list patching: reconcile a parent's children to match an items array.
 * Reuses existing DOM nodes when keys match; appends/removes/moves as needed.
 */
export function patchKeyedList({ parentEl, keyFn, items = [], renderItem, existingMap = new Map() }) {
  if (!parentEl || typeof keyFn !== "function" || typeof renderItem !== "function") {
    return existingMap;
  }
  const keys = new Set();
  const newMap = new Map();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const key = String(keyFn(item, i));
    keys.add(key);
    let node = existingMap.get(key);
    if (!node || !parentEl.contains(node)) {
      node = renderItem(item, i);
    }
    newMap.set(key, node);
    if (node.parentNode !== parentEl) {
      parentEl.appendChild(node);
    } else {
      const currentIndex = Array.from(parentEl.children).indexOf(node);
      const targetIndex = i;
      if (currentIndex !== targetIndex) {
        const ref = parentEl.children[targetIndex];
        parentEl.insertBefore(node, ref || null);
      }
    }
  }

  for (const [key, node] of existingMap) {
    if (!keys.has(key) && node.parentNode === parentEl) {
      parentEl.removeChild(node);
    }
  }

  return newMap;
}
