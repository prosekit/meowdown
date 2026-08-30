// Apple's WebKit engine: Safari on any platform, every iOS browser, and
// WKWebView hosts. Blink reports a "Google Inc." vendor, and Node's global
// `navigator` has no `vendor` at all.
export const isWebKit: boolean =
  typeof navigator !== 'undefined' &&
  navigator.vendor != null &&
  navigator.vendor.includes('Apple Computer')
