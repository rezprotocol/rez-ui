# Security Policy

`rez-ui` is the shared UI framework for Rez applications. It does not handle keys, network traffic, or protocol logic — but UI bugs that lead to confused-deputy or phishing-style attacks against users are still in scope.

## Reporting a Vulnerability

**Please do not open public issues for suspected vulnerabilities.**

Use [GitHub Security Advisories](https://github.com/rezprotocol/rez-ui/security/advisories/new) to report privately. Only the reporter and the repository maintainers can view the report.

## What to expect

- **Acknowledgement** within 72 hours.
- **Initial assessment** (severity, scope, reproduction) within 7 days.
- **Fix + coordinated disclosure** within 90 days of report — sooner for high-severity issues.
- **Credit** in the security advisory and release notes if you'd like (let us know).

## Scope

In scope:
- DOM XSS / injection flaws in the framework rendering layer
- Intent / event-bus bypasses that allow unauthorized state mutation
- Confused-deputy UI patterns that mislead users about cryptographic identity

Out of scope:
- Styling bugs, theme regressions, layout glitches
- Browser-specific quirks not present in the framework's supported targets
- Issues affecting only un-tagged `main`-branch code

## Threat model and posture

Cross-package threat model and audit history live in [`rez-core`](https://github.com/rezprotocol/rez-core):
- [`docs/security.md`](https://github.com/rezprotocol/rez-core/blob/main/docs/security.md) — threat model + guarantees
- [`docs/SECURITY_POSTURE.md`](https://github.com/rezprotocol/rez-core/blob/main/docs/SECURITY_POSTURE.md) — audit history + disclosure posture
