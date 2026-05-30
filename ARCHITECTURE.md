# rez-ui Architecture (Canonical)
Status: Canonical / normative
Scope: rez-ui package ONLY (framework primitives, not the chat app)
Goal: Provide a reusable, platform-agnostic UI framework layer used by rez-chat (and other apps).

---

## 0) Non-Negotiables

1. rez-ui is a **framework package**, not an application.
2. rez-ui MUST NOT contain **chat-domain nouns** (Thread, Message, Invite, Group, Composer, etc.).
3. rez-ui MUST NOT include app-specific stores or business logic.
4. rez-ui MUST be reusable by multiple apps with different domains.
5. rez-ui MUST NOT import rez-chat (or any app package) under any path.

---

## 1) What rez-ui Owns

rez-ui owns the smallest set of primitives required to build SPAs with strict boundaries:

### 1.1 Host + Lifecycle
- UiHost: mounts/unmounts scenes, owns root mount element
- Scene base contract: composition root (no domain logic)
- View base contract: DOM ownership, subscription wiring, teardown discipline

### 1.2 DOM Utilities (Framework-level)
- DOM element helpers (create nodes, set attrs/text)
- Keyed list patching utilities
- Minimal delegated event helper (scoped to a view root)
- Optional: micro-scheduler helper (raf batching) if needed for performance

### 1.3 Theme / Styling Primitives
- Theme tokens and CSS (if any)
- Icon assets, base styles
- A stable way for apps to supply a theme override

### 1.4 Framework Utilities
- Pure helpers safe for reuse across apps:
  - string formatting / ellipsize
  - time formatting
  - small layout helpers
- These MUST remain pure (no IO, no subscriptions, no runtime state)

---

## 2) What rez-ui Does NOT Own (Forbidden)

rez-ui MUST NOT include:
- Chat scenes (Login/Main/Invite/Settings for chat)
- Chat views/components (ThreadList, MessageTimeline, Composer, etc.)
- Chat stores (ThreadStore, MessageStore, InviteStore, etc.)
- WebSocket services / API clients for chat
- Any app-level routing decisions based on domain state
- Any protocol logic (belongs in rez-core/rez-sdk)

If a filename contains: Thread / Message / Invite / Group / Composer
→ it does not belong in rez-ui.

---

## 3) Framework Contracts

### 3.1 UiHost (framework/UiHost.js)

UiHost responsibilities (ONLY):
- Hold a mount element
- Mount/unmount a Scene instance
- Provide an `emitIntent(name, payload)` callback to the currently mounted scene/views
- Optionally: switch scenes via an explicit `setScene(name)` API

UiHost must NOT:
- own domain state
- subscribe to WebSocket
- be a “store”
- implement application logic

#### Minimal interface

- `createUiHost({ mountEl, scenes, emitIntent, theme })`
  - `scenes`: map of `{ [sceneName]: () => Scene }`
  - `emitIntent`: callback injected by the app
  - `theme`: theme token object (optional)

- `host.setScene(sceneName)`
- `host.mount()`
- `host.unmount()`

### 3.2 Scene base (framework/Scene.js)

Scene is a composition root for Views.

Required interface:
- `mount(mountEl)`
- `unmount()`

Scene may:
- create and mount view trees
- subscribe to non-domain framework-level signals (rare)

Scene must NOT:
- perform networking
- hold domain truth
- parse protocol objects

### 3.3 View base (framework/View.js)

View is a DOM owner.

Required interface:
- `mount(parentEl)`
- `unmount()`
- `render(reason)` (initial render)
- optional `onExternalChange(evt)` hook (app can wire store events to it)

Hard rules:
- A View may only mutate DOM within its own root element subtree.
- A View must clean up event listeners/subscriptions on unmount.

---

## 4) DOM Patch Utilities (dom/*)

rez-ui provides small helpers used by apps:

### 4.1 Required utilities
- `Dom.h(tag, attrs, children)` → returns Element
- `Dom.setText(el, text)`
- `Dom.setAttrs(el, attrs)`
- `Dom.on(rootEl, eventName, selector, handler)` → delegated events scoped to rootEl
- `Dom.patchKeyedList({ parentEl, items, keyFn, renderItem, reuseMap })`

### 4.2 Forbidden patterns
- Framework utilities MUST NOT depend on app code.
- Framework must not assume any particular domain model.

---

## 5) Folder Layout (Required)

rez-ui must keep framework primitives in predictable places:

src/
  framework/
    UiHost.js
    Scene.js
    View.js
  dom/
    Dom.js
    patchKeyedList.js
    events.js
  theme/
    theme.js
    base.css
  util/
    StringsUi.js
    TimeUi.js

No other domain folders are allowed.

---

## 6) Boundary Guardrails (Must-Add Tests)

Add a test that fails if rez-ui imports app code:

- Any import path containing:
  - `rez-chat`
  - `apps/chat`
  - `/chat/` (app-specific)
  - any of the forbidden nouns modules

The goal is to prevent “platform creep.”

---

## 7) Acceptance Criteria

rez-ui is correct when:
1. It contains only framework primitives, dom helpers, theme, and pure utilities.
2. No file in rez-ui references chat domain nouns.
3. No file in rez-ui imports rez-chat or app code.
4. UiHost is a small host/lifecycle primitive, not a renderer for a full domain state object.
5. Apps can implement store-driven component UI using only rez-ui primitives.
