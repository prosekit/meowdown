// Apple's WebKit engine: Safari on any platform, every iOS browser, and
// WKWebView hosts. Blink reports a "Google Inc." vendor.
export const isWebKit: boolean =
  typeof navigator !== 'undefined' && navigator.vendor.includes('Apple Computer')
