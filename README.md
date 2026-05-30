# rez-ui

Framework-only UI package for Rez apps.

## Scope

`rez-ui` owns reusable UI primitives:
- UI host lifecycle (`createUiHost`)
- view rendering contracts
- theme/assets/styles

`rez-ui` does **not** own:
- chat app workflows
- protocol/network integration
- crypto/keystore/runtime orchestration

## Public API

The framework's two main exports are `Host` (the top-level scene container) and `Component` (the base class every view extends).

```js
import { Host, Component } from "rez-ui/framework";
import { h } from "rez-ui";

// Mount a Host with a named-children map. Each child is a factory that
// builds a Component subtree on demand.
const host = new Host({
  children: {
    login: () => new LoginScene({ bus }),
    main:  () => new MainScene({ bus }),
  },
});

host.mount(document.getElementById("app"));
host.switchTo("login");
// ...
host.unmount();
```

The `h(tag, attrs, children)` hyperscript helper builds DOM nodes; views typically compose UI via `h(...)` returns from a `render()` method.

## Scripts

- `npm test` - framework boundary/API tests
- `npm run build` - build framework demo bundle
- `npm run dev` - run local Vite dev server

---

## Documentation

| Doc | Contents |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Component model, rendering, one-way data flow, intent/event model |
| [branding/README.md](./branding/README.md) | Design system: color palette, typography, theme primitives |

---

## Related projects

- [**rez-core**](https://github.com/rezprotocol/rez-core) — cryptographic primitives + protocol records
- [**rez-sdk**](https://github.com/rezprotocol/rez-sdk) — client SDK
- [**rez-node**](https://github.com/rezprotocol/rez-node) — relay node runtime
- [**rez-chat**](https://github.com/rezprotocol/rez-chat) — reference desktop chat application built on rez-ui

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Security disclosures: see [SECURITY.md](./SECURITY.md).

## License

Apache 2.0. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
