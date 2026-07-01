# WebKit smart-dash reproduction

Reproduces the macOS WebKit "smart dash" bug: with automatic dash substitution
enabled, typing two ASCII hyphens (`--`) becomes an em dash (`—`), which corrupts
meowdown's HTML comment markers such as `<!-- {"width":100} -->`.

## Why not a Playwright test

The Playwright based browser tests (vitest, `webkit` project) cannot see this
bug, and no macOS `defaults` value or Playwright option changes that:

- The substitution is applied by WebKit's WebContent editor (its
  `AlternativeTextController` / text-checking path), not by the AppKit input
  layer. Verified by intercepting `-[WKWebView insertText:replacementRange:]`:
  the input system delivers raw `-` `-`, yet the DOM ends up with `—`.
- Playwright drives WebKit through the WebKit **automation session**, which
  injects key events without running that substitution path. Confirmed with raw
  Playwright typing (slow, deliberate) and with the WebKit-specific defaults
  (`WebAutomaticDashSubstitutionEnabled`, `WebContinuousSpellCheckingEnabled`) set
  in Playwright's `org.webkit.Playwright` domain. The WebKit automation protocol
  exposes no text-checking setting (`Page.Setting` has none).

## What this harness does

`repro.swift` drives the **system** WebKit (same engine as Safari) through a real
`WKWebView`, typing with synthesized AppKit key events sent down the responder
chain (`NSApp.sendEvent` → `keyDown:` → `interpretKeyEvents:`). That is the normal
user-typing path, so the substitution fires exactly as in Safari.

```
swift test/webkit-dash/repro.swift <url> [--expect present|absent]
```

It loads `<url>`, waits for a `.ProseMirror` editor, types `a -- b`, and reads the
result. Default expectation is `absent` (the fixed behavior): it exits non-zero
when an em dash is found, so CI is red while the bug is present and green once the
editor stops using spell checking.

The macOS setting must be enabled first (WebKit's `TextChecker` falls back to it):

```
defaults write -g NSAutomaticDashSubstitutionEnabled -bool true
```
