import SwiftUI
import WebKit
import AppIntents
import AVFoundation
import Speech
import UIKit

// MARK: - 1. Riconoscimento Vocale Nativo iOS (SFSpeechRecognizer + AVAudioEngine)
@MainActor
final class StarkSpeechRecognizer: ObservableObject {
    @Published var isRecording = false
    @Published var transcript = ""

    private let speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "it-IT"))
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let audioEngine = AVAudioEngine()

    var onPartial: ((String) -> Void)?
    var onFinal: ((String) -> Void)?
    var onStateChange: ((Bool, String) -> Void)?

    func toggleRecording() {
        if isRecording {
            stopRecording()
        } else {
            startRecording()
        }
    }

    func startRecordingIfIdle() {
        if !isRecording {
            startRecording()
        }
    }

    private func startRecording() {
        SFSpeechRecognizer.requestAuthorization { authStatus in
            Task { @MainActor in
                guard authStatus == .authorized else {
                    self.onStateChange?(false, "Abilita Microfono e Riconoscimento Vocale nelle Impostazioni iOS")
                    return
                }
                do {
                    try self.beginAudioSession()
                } catch {
                    self.onStateChange?(false, "Errore audio: \(error.localizedDescription)")
                }
            }
        }
    }

    private func beginAudioSession() throws {
        recognitionTask?.cancel()
        recognitionTask = nil

        let audioSession = AVAudioSession.sharedInstance()
        try audioSession.setCategory(.playAndRecord, mode: .measurement, options: [.defaultToSpeaker, .allowBluetooth])
        try audioSession.setActive(true, options: .notifyOthersOnDeactivation)

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        self.recognitionRequest = request

        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)
        inputNode.removeTap(onBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
            request.append(buffer)
        }

        audioEngine.prepare()
        try audioEngine.start()

        self.transcript = ""
        self.isRecording = true
        self.onStateChange?(true, "Griglia Neurale in ascolto... parla ora")

        recognitionTask = speechRecognizer?.recognitionTask(with: request) { [weak self] result, error in
            guard let self = self else { return }
            Task { @MainActor in
                if let result = result {
                    let current = result.bestTranscription.formattedString
                    self.transcript = current
                    self.onPartial?(current)
                    if result.isFinal {
                        self.stopRecording()
                        if !current.isEmpty {
                            self.onFinal?(current)
                        }
                    }
                }
                if error != nil {
                    let finalBeforeErr = self.transcript
                    self.stopRecording()
                    if !finalBeforeErr.isEmpty {
                        self.onFinal?(finalBeforeErr)
                    }
                }
            }
        }
    }

    func stopRecording() {
        if audioEngine.isRunning {
            audioEngine.stop()
            audioEngine.inputNode.removeTap(onBus: 0)
        }
        recognitionRequest?.endAudio()
        recognitionRequest = nil
        recognitionTask = nil
        isRecording = false
        onStateChange?(false, "Tocca la Maschera d'Oro al centro per parlare")
    }
}

// MARK: - 2. Motore Ibrido OTA GitHub (Zero-Cache API) + Memoria Flash Offline (Documents/DoomOTA/)
@available(iOS 16.0, *)
struct DoomHybridOfflineOTAWebView: UIViewRepresentable {
    @ObservedObject var engine: HybridAPUEngine
    @ObservedObject var speechRec: StarkSpeechRecognizer
    @Binding var showNativeOfflineFallback: Bool
    @Binding var pendingSiriDeepLink: URL?

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeUIView(context: Context) -> WKWebView {
        let contentController = WKUserContentController()
        contentController.add(context.coordinator, name: "doomNative")

        let config = WKWebViewConfiguration()
        config.userContentController = contentController
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.backgroundColor = .black
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.bounces = true

        let refreshControl = UIRefreshControl()
        refreshControl.tintColor = UIColor(red: 0.94, green: 0.76, blue: 0.22, alpha: 1.0)
        refreshControl.addTarget(context.coordinator, action: #selector(Coordinator.handlePullToRefresh(_:)), for: .valueChanged)
        webView.scrollView.refreshControl = refreshControl

        context.coordinator.webView = webView
        context.coordinator.bindSpeechCallbacks()
        context.coordinator.bootOfflineAndSyncGitHub()

        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        if let url = pendingSiriDeepLink {
            DispatchQueue.main.async {
                self.pendingSiriDeepLink = nil
                context.coordinator.handleIncomingSiriURL(url)
            }
        }
    }

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        var parent: DoomHybridOfflineOTAWebView
        weak var webView: WKWebView?
        private let synthesizer = AVSpeechSynthesizer()
        private let githubApiBase = "https://api.github.com/repos/GoldenRose01/stark-os-ios-assistant/contents/docs"
        private let githubPagesBase = "https://goldenrose01.github.io/stark-os-ios-assistant"
        private let githubRawBase = "https://raw.githubusercontent.com/GoldenRose01/stark-os-ios-assistant/main/docs"
        private let otaFiles = ["index.html", "index.css", "app.js", "doom-mask.png", "manifest.json"]

        init(parent: DoomHybridOfflineOTAWebView) {
            self.parent = parent
        }

        private func getLocalOTADirectory() -> URL {
            let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            let otaDir = docs.appendingPathComponent("DoomOTA", isDirectory: true)
            if !FileManager.default.fileExists(atPath: otaDir.path) {
                try? FileManager.default.createDirectory(at: otaDir, withIntermediateDirectories: true)
            }
            return otaDir
        }

        func hasCachedOfflineFiles() -> Bool {
            let indexURL = getLocalOTADirectory().appendingPathComponent("index.html")
            return FileManager.default.fileExists(atPath: indexURL.path)
        }

        func loadFromLocalFlash(bustWebKitCache: Bool = false) {
            let otaDir = getLocalOTADirectory()
            let indexURL = otaDir.appendingPathComponent("index.html")
            guard FileManager.default.fileExists(atPath: indexURL.path) else { return }

            if bustWebKitCache {
                let cacheTypes: Set<String> = [WKWebsiteDataTypeDiskCache, WKWebsiteDataTypeMemoryCache]
                WKWebsiteDataStore.default().removeData(ofTypes: cacheTypes, modifiedSince: .distantPast) { [weak self] in
                    guard let self = self else { return }
                    self.webView?.loadFileURL(indexURL, allowingReadAccessTo: otaDir)
                }
            } else {
                webView?.loadFileURL(indexURL, allowingReadAccessTo: otaDir)
            }
        }

        func bootOfflineAndSyncGitHub() {
            if hasCachedOfflineFiles() {
                loadFromLocalFlash(bustWebKitCache: false)
                Task {
                    await syncLatestFromGitHub(forceReload: true)
                }
            } else {
                Task {
                    let ok = await syncLatestFromGitHub(forceReload: true)
                    if !ok && !hasCachedOfflineFiles() {
                        parent.showNativeOfflineFallback = true
                    }
                }
            }
        }

        private func fetchFreshFileData(fileName: String, session: URLSession, ts: Int) async -> Data? {
            // 1. Primary: GitHub Contents API with raw header (0-second cache delay!)
            if let apiURL = URL(string: "\(githubApiBase)/\(fileName)?ref=main&t=\(ts)") {
                var req = URLRequest(url: apiURL)
                req.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
                req.setValue("application/vnd.github.v3.raw", forHTTPHeaderField: "Accept")
                req.setValue("no-cache", forHTTPHeaderField: "Cache-Control")
                if let (data, resp) = try? await session.data(for: req),
                   let http = resp as? HTTPURLResponse, http.statusCode == 200, !data.isEmpty {
                    return data
                }
            }

            // 2. Fallback A: GitHub Pages
            if let pagesURL = URL(string: "\(githubPagesBase)/\(fileName)?t=\(ts)") {
                var req = URLRequest(url: pagesURL)
                req.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
                if let (data, resp) = try? await session.data(for: req),
                   let http = resp as? HTTPURLResponse, http.statusCode == 200, !data.isEmpty {
                    return data
                }
            }

            // 3. Fallback B: Raw GitHub CDN
            if let rawURL = URL(string: "\(githubRawBase)/\(fileName)?t=\(ts)") {
                var req = URLRequest(url: rawURL)
                req.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
                if let (data, resp) = try? await session.data(for: req),
                   let http = resp as? HTTPURLResponse, http.statusCode == 200, !data.isEmpty {
                    return data
                }
            }

            return nil
        }

        @discardableResult
        func syncLatestFromGitHub(forceReload: Bool) async -> Bool {
            let otaDir = getLocalOTADirectory()
            let ts = Int(Date().timeIntervalSince1970)
            var successCount = 0

            let config = URLSessionConfiguration.ephemeral
            config.requestCachePolicy = .reloadIgnoringLocalAndRemoteCacheData
            config.urlCache = nil
            config.timeoutIntervalForRequest = 8
            let session = URLSession(configuration: config)

            for fileName in otaFiles {
                guard var data = await fetchFreshFileData(fileName: fileName, session: session, ts: ts) else {
                    continue
                }
                successCount += 1

                // Stamp index.html asset URLs with ?v=ts so WKWebView never uses cached CSS or JS!
                if fileName == "index.html", var htmlStr = String(data: data, encoding: .utf8) {
                    htmlStr = htmlStr.replacingOccurrences(
                        of: #"href="\.\/index\.css(\?[^"]*)?""#,
                        with: "href=\"./index.css?v=\(ts)\"",
                        options: .regularExpression
                    )
                    htmlStr = htmlStr.replacingOccurrences(
                        of: #"src="\.\/app\.js(\?[^"]*)?""#,
                        with: "src=\"./app.js?v=\(ts)\"",
                        options: .regularExpression
                    )
                    if let stampedData = htmlStr.data(using: .utf8) {
                        data = stampedData
                    }
                }

                let localURL = otaDir.appendingPathComponent(fileName)
                try? data.write(to: localURL, options: .atomic)
            }

            if successCount > 0 && hasCachedOfflineFiles() {
                loadFromLocalFlash(bustWebKitCache: true)
                try? await Task.sleep(nanoseconds: 550_000_000)
                sendEventToJS(["type": "otaStatus", "message": "Sync OK!"])
            }
            return successCount > 0
        }

        @objc func handlePullToRefresh(_ sender: UIRefreshControl) {
            Task {
                await syncLatestFromGitHub(forceReload: true)
                sender.endRefreshing()
            }
        }

        func handleIncomingSiriURL(_ url: URL) {
            let host = (url.host ?? "").lowercased()
            let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
            let qParam = components?.queryItems?.first(where: { $0.name == "q" || $0.name == "query" })?.value

            if host == "voice" || (qParam ?? "").isEmpty {
                sendEventToJS(["type": "siriUrlQuery", "mode": "voice"])
                parent.speechRec.startRecordingIfIdle()
            } else if let query = qParam, !query.isEmpty {
                sendEventToJS(["type": "siriUrlQuery", "mode": "ask", "query": query])
            }
        }

        func bindSpeechCallbacks() {
            parent.speechRec.onPartial = { [weak self] text in
                self?.sendEventToJS(["type": "voicePartial", "transcript": text])
            }
            parent.speechRec.onFinal = { [weak self] text in
                self?.sendEventToJS(["type": "voiceFinal", "transcript": text])
            }
            parent.speechRec.onStateChange = { [weak self] isRec, msg in
                self?.sendEventToJS(["type": "voiceState", "isRecording": isRec, "message": msg])
            }
        }

        func sendEventToJS(_ dict: [String: Any]) {
            guard let data = try? JSONSerialization.data(withJSONObject: dict),
                  let jsonStr = String(data: data, encoding: .utf8) else { return }
            webView?.evaluateJavaScript("window.onDoomNativeEvent && window.onDoomNativeEvent(\(jsonStr));", completionHandler: nil)
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "doomNative",
                  let body = message.body as? [String: Any],
                  let action = body["action"] as? String else { return }

            switch action {
            case "speak":
                if let text = body["text"] as? String, !text.isEmpty {
                    let persona = (body["persona"] as? String) ?? parent.engine.persona
                    synthesizer.stopSpeaking(at: .immediate)
                    let utterance = AVSpeechUtterance(string: text)
                    utterance.voice = AVSpeechSynthesisVoice(language: "it-IT")
                    utterance.rate = persona == "edith" ? 0.52 : 0.49
                    synthesizer.speak(utterance)
                }

            case "stopSpeak":
                synthesizer.stopSpeaking(at: .immediate)

            case "toggleVoice":
                parent.speechRec.toggleRecording()

            case "reloadOTA":
                Task {
                    await syncLatestFromGitHub(forceReload: true)
                }

            case "openShortcutsApp":
                if let shortcutsURL = URL(string: "shortcuts://create-shortcut") {
                    UIApplication.shared.open(shortcutsURL)
                }

            case "syncConfig":
                if let persona = body["persona"] as? String {
                    parent.engine.persona = persona
                }
                if let tts = body["ttsEnabled"] as? Bool {
                    parent.engine.ttsEnabled = tts
                }
                if let apiConfig = body["apiConfig"] as? [String: Any] {
                    if let g = apiConfig["geminiKey"] as? String { parent.engine.geminiKey = g }
                    if let o = apiConfig["openaiKey"] as? String { parent.engine.openaiKey = o }
                }

            default:
                break
            }
        }
    }
}

// MARK: - 3. Vista Principale Full-Screen 6.9" per iPhone 16 Pro Max (Online OTA + 100% Offline Flash & Siri Deep-Link)
@available(iOS 16.0, *)
struct StarkHUDView: View {
    @StateObject private var engine = HybridAPUEngine.shared
    @StateObject private var speechRec = StarkSpeechRecognizer()
    @State private var showNativeOfflineFallback = false
    @State private var pendingSiriDeepLink: URL? = nil
    @State private var offlineQueryText = ""
    @State private var offlineHistory: [StarkAssistantResponse] = []
    private let synthesizer = AVSpeechSynthesizer()

    var primaryAccent: Color {
        Color(red: 0.94, green: 0.76, blue: 0.22)
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea(.all)

            if !showNativeOfflineFallback {
                DoomHybridOfflineOTAWebView(
                    engine: engine,
                    speechRec: speechRec,
                    showNativeOfflineFallback: $showNativeOfflineFallback,
                    pendingSiriDeepLink: $pendingSiriDeepLink
                )
                .ignoresSafeArea(.all)
            } else {
                // Console Nativa SwiftUI Offline (se il primo avvio assoluto avviene senza rete)
                VStack(spacing: 14) {
                    HStack {
                        Image("DoomMaskLogo")
                            .resizable()
                            .scaledToFill()
                            .frame(width: 42, height: 42)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                        VStack(alignment: .leading) {
                            Text("DOOM AI // OFFLINE APU")
                                .font(.system(size: 17, weight: .bold, design: .monospaced))
                                .foregroundStyle(primaryAccent)
                            Text("A18 PRO NEURAL ENGINE ATTIVO")
                                .font(.system(size: 10, design: .monospaced))
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button("Sync GitHub") {
                            showNativeOfflineFallback = false
                        }
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(primaryAccent.opacity(0.2))
                        .foregroundStyle(primaryAccent)
                        .clipShape(Capsule())
                    }
                    .padding(.horizontal)

                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(Array(offlineHistory.enumerated()), id: \.offset) { _, resp in
                                StarkSiriSnippetView(response: resp)
                            }
                        }
                        .padding(.horizontal)
                    }

                    HStack(spacing: 10) {
                        TextField("Ordina a DoomAi Offline (calcoli, task)...", text: $offlineQueryText)
                            .textFieldStyle(.plain)
                            .padding(12)
                            .background(Color.white.opacity(0.08))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .foregroundStyle(.white)

                        Button {
                            let q = offlineQueryText
                            offlineQueryText = ""
                            Task {
                                let res = await engine.executeHybridQuery(query: q)
                                offlineHistory.insert(res, at: 0)
                                let utt = AVSpeechUtterance(string: res.speech)
                                utt.voice = AVSpeechSynthesisVoice(language: "it-IT")
                                synthesizer.speak(utt)
                            }
                        } label: {
                            Image(systemName: "arrow.up.circle.fill")
                                .font(.system(size: 34))
                                .foregroundStyle(primaryAccent)
                        }
                    }
                    .padding(.horizontal)
                    .padding(.bottom, 12)
                }
            }
        }
        .preferredColorScheme(.dark)
        .onOpenURL { incomingURL in
            pendingSiriDeepLink = incomingURL
        }
    }
}
