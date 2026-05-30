# Contributing to rez-ui

Thanks for considering a contribution. `rez-ui` is the framework-only UI layer; please read this before opening a PR.

## Getting started

```bash
git clone https://github.com/rezprotocol/rez-ui.git
cd rez-ui
npm install
npm test
```

## Code style

This codebase is **vanilla JavaScript, ESM only**.

- ES2022+: async/await, classes, native `import` / `export`
- `#privateField` / `#privateMethod()` for private members; `_protectedMethod()` convention for protected
- **No optional chaining (`?.`)** — use explicit `if` / `===` checks
- **No empty `catch` blocks** — every caught exception must be handled or re-thrown
- No TypeScript, no Babel/SWC, no transpilation
- Tests use Node's built-in `node:test` runner

## Scope

`rez-ui` owns:
- UI host lifecycle (`createUiHost`)
- View rendering contracts and intent/event model
- Shared theme primitives, design tokens, base styles

`rez-ui` does **not** own:
- Chat application workflows (live in [`rez-chat`](https://github.com/rezprotocol/rez-chat))
- Protocol or network integration (live in [`rez-sdk`](https://github.com/rezprotocol/rez-sdk))
- Crypto, keystore, or runtime orchestration (live in [`rez-core`](https://github.com/rezprotocol/rez-core) and `rez-sdk`)

Component model and one-way data flow are documented in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Tests

```bash
npm test
```

Framework boundary and public-API tests are enforced; adding a public export requires a test.

## Pull request process

1. Fork → branch → push.
2. Open a PR against `main`.
3. Describe the change concretely (what + why; the *what* should match the diff).
4. CI runs tests.
5. Maintainer review.

## Licensing

By submitting a contribution, you agree that your contribution will be licensed under the Apache License 2.0, the license of this repository (per Section 5 of the Apache License).

## Security disclosures

Please do **not** open public issues for security vulnerabilities. See [SECURITY.md](./SECURITY.md) for the disclosure process.
