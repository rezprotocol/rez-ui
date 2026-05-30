import { Component } from "./Component.js";

/**
 * Host: a Component that holds at most one child Component at a time and
 * swaps it on demand.
 *
 * Hosts express the "switch what's mounted" pattern uniformly at every level
 * of the tree: a top-level scene host, a tab host inside a scene, a pane host
 * inside a tab — all the same primitive.
 *
 * Construction:
 *   new Host({ children: { name: () => new SomeComponent({ ... }), ... } })
 *
 * Operation:
 *   host.mount(parentEl)         // attaches to DOM, no child mounted yet
 *   host.switchTo(name)          // tears down previous child, mounts named
 *   host.current()               // returns currently-mounted child name or ""
 *   host.unmount()               // tears down current child + DOM
 *
 * The factory map is the only thing the Host knows about its children.
 * When switchTo(name) is called, the Host:
 *   1. Unmounts the current child (if any).
 *   2. Looks up the factory for `name`.
 *   3. Calls the factory to construct a new Component instance.
 *   4. Mounts that Component into the host's mount point.
 *
 * The newly-mounted Component is responsible for building its own subtree,
 * subscribing to whatever stores it cares about, and tearing itself down
 * cleanly on unmount.
 */
export class Host extends Component {
  #children;
  #currentName;
  #currentChild;

  constructor({ children = {} } = {}) {
    super();
    if (!children || typeof children !== "object") {
      throw new Error("Host requires children map");
    }
    this.#children = children;
    this.#currentName = "";
    this.#currentChild = null;
  }

  mount(parentEl) {
    super.mount(parentEl);
  }

  current() {
    return this.#currentName;
  }

  switchTo(name, { force = false } = {}) {
    if (!this._rootEl) return;
    const next = String(name == null ? "" : name).trim();
    if (next === this.#currentName && !force) return;
    if (this.#currentChild && typeof this.#currentChild.unmount === "function") {
      this.#currentChild.unmount();
    }
    this.#currentChild = null;
    this.#currentName = "";
    this._rootEl.replaceChildren();
    if (!next) return;
    const factory = this.#children[next];
    if (typeof factory !== "function") return;
    const child = factory();
    if (!child || typeof child.mount !== "function") return;
    this.#currentName = next;
    this.#currentChild = child;
    child.mount(this._rootEl);
  }

  unmount() {
    if (this.#currentChild && typeof this.#currentChild.unmount === "function") {
      this.#currentChild.unmount();
    }
    this.#currentChild = null;
    this.#currentName = "";
    super.unmount();
  }
}
