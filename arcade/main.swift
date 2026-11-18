// Contrasteroids for an arcade cabinet: the web game fullscreen in WebKit,
// played from a panel whose encoder sends keystrokes. Loads the live site with
// ?arcade, which maps the panel's buttons (src/input.js). The middle mouse
// button (a cabinet's "exit" button on the X-Arcade's mouse interface) quits,
// and so does five minutes without input, so the frontend's attract mode
// comes back. Override the page with `-url <address>` or
// `defaults write co.dgrlabs.contrasteroids-arcade url <address>`.

import Cocoa
import WebKit

let defaultURL = "https://dgrlabs.co/contrasteroids/?arcade"
let idleQuit: TimeInterval = 300

final class KeyWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}

final class App: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKScriptMessageHandler {
    var window: KeyWindow!
    var web: WKWebView!
    var url: URL!
    var lastInput = Date()

    func applicationDidFinishLaunching(_ note: Notification) {
        let address = UserDefaults.standard.string(forKey: "url") ?? defaultURL
        guard let u = URL(string: address) else { NSLog("Contrasteroids: bad url %@", address); exit(1) }
        url = u

        let config = WKWebViewConfiguration()
        config.mediaTypesRequiringUserActionForPlayback = []
        // Frame rate to the log every 10 s: `log stream --predicate 'process == "Contrasteroids"'`.
        let fps = """
        (() => { let n = 0, t = performance.now();
          const tick = (now) => { n++; if (now - t >= 10000) {
            window.webkit.messageHandlers.arcade.postMessage({ fps: Math.round(n * 1000 / (now - t)) });
            n = 0; t = now; } requestAnimationFrame(tick); };
          requestAnimationFrame(tick); })();
        """
        config.userContentController.addUserScript(
            WKUserScript(source: fps, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        config.userContentController.add(self, name: "arcade")

        let frame = NSScreen.main?.frame ?? NSRect(x: 0, y: 0, width: 1920, height: 1080)
        window = KeyWindow(contentRect: frame, styleMask: [.borderless], backing: .buffered, defer: false)
        window.backgroundColor = .black
        web = WKWebView(frame: frame, configuration: config)
        web.navigationDelegate = self
        web.setValue(false, forKey: "drawsBackground")
        window.contentView = web

        NSApp.presentationOptions = [.hideDock, .hideMenuBar]
        window.setFrame(frame, display: true)
        window.makeKeyAndOrderFront(nil)
        window.makeFirstResponder(web)
        NSApp.activate(ignoringOtherApps: true)
        NSCursor.hide()

        NSEvent.addLocalMonitorForEvents(matching: [.keyDown, .keyUp, .flagsChanged, .otherMouseDown]) { [weak self] e in
            self?.lastInput = Date()
            if e.type == .otherMouseDown && e.buttonNumber == 2 {
                NSApp.terminate(nil)
                return nil
            }
            return e
        }
        Timer.scheduledTimer(withTimeInterval: 15, repeats: true) { [weak self] _ in
            guard let self else { return }
            if Date().timeIntervalSince(self.lastInput) > idleQuit {
                NSLog("Contrasteroids: idle, quitting")
                NSApp.terminate(nil)
            }
        }
        web.load(URLRequest(url: url))
    }

    // Offline or the site is down: keep retrying on a black screen.
    func webView(_ w: WKWebView, didFailProvisionalNavigation n: WKNavigation!, withError err: Error) { retry(err) }
    func webView(_ w: WKWebView, didFail n: WKNavigation!, withError err: Error) { retry(err) }
    func retry(_ err: Error) {
        NSLog("Contrasteroids: load failed (%@), retrying", err.localizedDescription)
        DispatchQueue.main.asyncAfter(deadline: .now() + 5) { [weak self] in
            guard let self else { return }
            self.web.load(URLRequest(url: self.url))
        }
    }

    // WebKit's content process can die (GPU reset, memory); reload rather than sit blank.
    func webViewWebContentProcessDidTerminate(_ w: WKWebView) {
        NSLog("Contrasteroids: web content process ended, reloading")
        w.load(URLRequest(url: url))
    }

    func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) {
        if let body = m.body as? [String: Any], let fps = body["fps"] { NSLog("Contrasteroids: fps %@", "\(fps)") }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ app: NSApplication) -> Bool { true }
}

let app = NSApplication.shared
app.setActivationPolicy(.regular)
let menu = NSMenu()
let appItem = NSMenuItem()
menu.addItem(appItem)
let appMenu = NSMenu()
appMenu.addItem(withTitle: "Quit Contrasteroids", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
appItem.submenu = appMenu
app.mainMenu = menu
let delegate = App()
app.delegate = delegate
app.run()
