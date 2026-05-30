/**
 * Component: the single UI primitive.
 *
 * A Component owns a DOM mount point and its own lifecycle. It is a container
 * that holds zero or more child Components, recursively, until you reach a
 * leaf that just writes to the DOM. There is no distinction between a "scene"
 * and a "view" — every node in the tree is a Component.
 *
 * Lifecycle:
 *   1. constructor() — collect inputs, but do NOT touch the DOM yet.
 *   2. mount(parentEl) — attach to the DOM, build subtree, subscribe to stores.
 *   3. unmount() — tear down subscriptions, clear DOM, drop child Components.
 *
 * Conventions:
 *   - Subclasses override mount() to build their subtree. They typically call
 *     super.mount(parentEl) first, then read from stores and call render().
 *   - Subclasses override render() for re-renders triggered by store events.
 *   - Subclasses use _subscribe(store, handler) to register store subscriptions
 *     that are auto-cleaned on unmount.
 *   - Subclasses must unmount() any child Components they instantiate.
 */
export class Component {
  constructor() {
    this._rootEl = null;
    this._unsubscribes = [];
    this._mountVersion = 0;
  }

  mount(parentEl) {
    if (!parentEl || !(parentEl instanceof Element)) {
      throw new Error("Component.mount requires a DOM Element");
    }
    this._rootEl = parentEl;
    this._mountVersion += 1;
  }

  unmount() {
    this._mountVersion += 1;
    for (const unsub of this._unsubscribes.splice(0)) {
      try {
        if (typeof unsub === "function") unsub();
      } catch {
        // ignore unsubscribe failures
      }
    }
    if (this._rootEl) {
      this._rootEl.replaceChildren();
      this._rootEl = null;
    }
  }

  render() {
    // Override in subclass.
  }

  _subscribe(store, handler) {
    if (!store || typeof store.onChange !== "function") return () => {};
    const unsub = store.onChange(handler);
    if (typeof unsub === "function") {
      this._unsubscribes.push(unsub);
      return unsub;
    }
    return () => {};
  }

  _captureMountVersion() {
    return this._mountVersion;
  }

  _isMountVersionCurrent(version) {
    return this._rootEl instanceof Element && this._mountVersion === version;
  }
}
