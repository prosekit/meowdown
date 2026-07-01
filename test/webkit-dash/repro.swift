// Reproduce the macOS WebKit "smart dash" substitution bug in CI.
//
// In Safari / system WebKit, when macOS automatic dash substitution is enabled,
// typing two ASCII hyphens ("--") is replaced by an em dash ("—"). Inside
// meowdown this corrupts HTML comments such as the image size marker
// `<!-- {"width":100} -->`.
//
// Playwright's WebKit build never applies this substitution: it drives the page
// through the WebKit automation session, which bypasses the WebContent editor's
// text-checking / AlternativeTextController path. No macOS `defaults` value or
// Playwright option changes that, so the bug is invisible to the Playwright
// based browser tests.
//
// This harness drives the *system* WebKit (the same engine as Safari) through a
// real WKWebView using synthesized AppKit key events sent down the responder
// chain (`NSApp.sendEvent` -> `keyDown:` -> `interpretKeyEvents:`). That is the
// normal user-typing path, so the substitution fires exactly as it does in
// Safari.
//
// Usage:
//   swift repro.swift <url> [--expect present|absent]
//
// It loads <url>, waits for a `.ProseMirror` editor, types "a -- b", then reads
// the editor text back. Default expectation is `absent` (the fixed behavior):
// the process exits non-zero when an em dash is found, so CI turns red while the
// bug is present and green once it is fixed.

import AppKit
import WebKit

let arguments = CommandLine.arguments
guard arguments.count > 1 else {
  FileHandle.standardError.write(Data("usage: swift repro.swift <url> [--expect present|absent]\n".utf8))
  exit(2)
}
let targetURL = arguments[1]
let expectPresent: Bool = {
  if let index = arguments.firstIndex(of: "--expect"), index + 1 < arguments.count {
    return arguments[index + 1] == "present"
  }
  return false
}()

let EM_DASH = "\u{2014}"

final class Reproducer: NSObject, WKNavigationDelegate {
  private var webView: WKWebView!
  private var window: NSWindow!

  func run() {
    let configuration = WKWebViewConfiguration()
    webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 1000, height: 700), configuration: configuration)
    webView.navigationDelegate = self
    window = NSWindow(
      contentRect: NSRect(x: 0, y: 0, width: 1000, height: 700),
      styleMask: [.titled],
      backing: .buffered,
      defer: false)
    window.contentView = webView
    window.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)
    webView.load(URLRequest(url: URL(string: targetURL)!))
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    waitForEditor(attempt: 0)
  }

  func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
    fail("navigation failed: \(error.localizedDescription)")
  }

  func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
    fail("provisional navigation failed: \(error.localizedDescription)")
  }

  private func waitForEditor(attempt: Int) {
    if attempt > 60 {
      fail("timed out waiting for a non-empty .ProseMirror editor")
      return
    }
    let probe = "(function(){var e=document.querySelector('.ProseMirror');return e?e.textContent.length:0})()"
    webView.evaluateJavaScript(probe) { result, _ in
      let length = (result as? Int) ?? 0
      if length > 0 {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { self.typeIntoEditor() }
      } else {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { self.waitForEditor(attempt: attempt + 1) }
      }
    }
  }

  private func sendKey(_ characters: String, _ keyCode: UInt16) {
    for phase in [NSEvent.EventType.keyDown, .keyUp] {
      guard let event = NSEvent.keyEvent(
        with: phase,
        location: .zero,
        modifierFlags: [],
        timestamp: ProcessInfo.processInfo.systemUptime,
        windowNumber: window.windowNumber,
        context: nil,
        characters: characters,
        charactersIgnoringModifiers: characters,
        isARepeat: false,
        keyCode: keyCode)
      else { continue }
      NSApp.sendEvent(event)
    }
  }

  private func typeIntoEditor() {
    let focusScript = """
    (function(){
      var editor = document.querySelector('.ProseMirror');
      editor.focus();
      var range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      var selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      return editor.getAttribute('spellcheck');
    })()
    """
    webView.evaluateJavaScript(focusScript) { result, _ in
      print("[repro] editor spellcheck attribute = \(String(describing: result))")
      self.window.makeFirstResponder(self.webView)
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
        // Start a fresh paragraph, then type "a -- b".
        self.sendKey("\r", 36)
        self.sendKey("a", 0)
        self.sendKey(" ", 49)
        self.sendKey("-", 27)
        self.sendKey("-", 27)
        self.sendKey(" ", 49)
        self.sendKey("b", 11)
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { self.readResult() }
      }
    }
  }

  private func readResult() {
    webView.evaluateJavaScript("document.querySelector('.ProseMirror').textContent") { result, _ in
      let text = (result as? String) ?? ""
      let hasEmDash = text.contains(EM_DASH)
      print("[repro] typed \"a -- b\"; em dash present = \(hasEmDash)")
      print("[repro] editor text tail = \(String(text.suffix(60)).debugDescription)")
      self.finish(hasEmDash: hasEmDash)
    }
  }

  private func finish(hasEmDash: Bool) {
    let passed = hasEmDash == expectPresent
    if passed {
      print("[repro] PASS (expected em dash \(expectPresent ? "present" : "absent"))")
    } else if hasEmDash {
      print("[repro] FAIL: bug reproduced. \"--\" became an em dash in system WebKit.")
    } else {
      print("[repro] FAIL: expected the smart-dash substitution but it did not occur.")
    }
    exit(passed ? 0 : 1)
  }

  private func fail(_ message: String) {
    FileHandle.standardError.write(Data("[repro] ERROR: \(message)\n".utf8))
    exit(3)
  }
}

let application = NSApplication.shared
application.setActivationPolicy(.regular)
let reproducer = Reproducer()
reproducer.run()
DispatchQueue.main.asyncAfter(deadline: .now() + 30) {
  FileHandle.standardError.write(Data("[repro] ERROR: global timeout\n".utf8))
  exit(3)
}
application.run()
