import test from "node:test";
import assert from "node:assert/strict";
import { Component, Host } from "../src/framework/index.js";

class FakeElement {
  constructor() {
    this.lastHtml = "";
    this.children = [];
  }
  replaceChildren(...children) {
    this.children = children;
    if (children.length === 0) this.lastHtml = "";
  }
  set innerHTML(value) {
    this.lastHtml = String(value || "");
  }
  get innerHTML() {
    return this.lastHtml;
  }
}

globalThis.Element = FakeElement;

class CountChild extends Component {
  constructor({ count }) {
    super();
    this.count = count;
    this.mounted = false;
  }
  mount(parentEl) {
    super.mount(parentEl);
    parentEl.innerHTML = "count:" + this.count;
    this.mounted = true;
  }
  unmount() {
    this.mounted = false;
    super.unmount();
  }
}

test("Component mounts, sets root, unmounts cleanly", () => {
  const el = new FakeElement();
  const comp = new CountChild({ count: 3 });
  comp.mount(el);
  assert.equal(comp.mounted, true);
  assert.equal(el.innerHTML, "count:3");
  comp.unmount();
  assert.equal(comp.mounted, false);
  assert.equal(el.innerHTML, "");
});

test("Component requires a real Element on mount", () => {
  const comp = new Component();
  assert.throws(() => comp.mount(null), /requires a DOM Element/);
  assert.throws(() => comp.mount({}), /requires a DOM Element/);
});

test("Component _subscribe registers and auto-cleans on unmount", () => {
  const el = new FakeElement();
  const calls = [];
  const fakeStore = {
    onChange(handler) {
      calls.push("subscribed");
      return () => calls.push("unsubscribed");
    },
  };
  const comp = new Component();
  comp.mount(el);
  comp._subscribe(fakeStore, () => {});
  assert.deepEqual(calls, ["subscribed"]);
  comp.unmount();
  assert.deepEqual(calls, ["subscribed", "unsubscribed"]);
});

test("Host mounts a named child and swaps cleanly", () => {
  const el = new FakeElement();
  const host = new Host({
    children: {
      a: () => new CountChild({ count: 1 }),
      b: () => new CountChild({ count: 2 }),
    },
  });
  host.mount(el);
  assert.equal(host.current(), "");

  host.switchTo("a");
  assert.equal(host.current(), "a");
  assert.equal(el.innerHTML, "count:1");

  host.switchTo("b");
  assert.equal(host.current(), "b");
  assert.equal(el.innerHTML, "count:2");

  host.switchTo("");
  assert.equal(host.current(), "");
  assert.equal(el.innerHTML, "");
});

test("Host.switchTo to same name is a no-op", () => {
  const el = new FakeElement();
  let constructed = 0;
  const host = new Host({
    children: {
      a: () => {
        constructed += 1;
        return new CountChild({ count: 1 });
      },
    },
  });
  host.mount(el);
  host.switchTo("a");
  host.switchTo("a");
  host.switchTo("a");
  assert.equal(constructed, 1);
});

test("Host.switchTo to unknown name leaves nothing mounted", () => {
  const el = new FakeElement();
  const host = new Host({
    children: { a: () => new CountChild({ count: 1 }) },
  });
  host.mount(el);
  host.switchTo("a");
  host.switchTo("nonexistent");
  assert.equal(host.current(), "");
  assert.equal(el.innerHTML, "");
});

test("Host.unmount tears down current child", () => {
  const el = new FakeElement();
  const child = new CountChild({ count: 5 });
  const host = new Host({
    children: { a: () => child },
  });
  host.mount(el);
  host.switchTo("a");
  assert.equal(child.mounted, true);
  host.unmount();
  assert.equal(child.mounted, false);
  assert.equal(host.current(), "");
});
