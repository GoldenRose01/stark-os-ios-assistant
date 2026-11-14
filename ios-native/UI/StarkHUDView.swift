import SwiftUI
import WebKit
import AppIntents
import AVFoundation
import Speech

// MARK: - 1. Riconoscimento Vocale Nativo iOS (SFSpeechRecognizer + AVAudioEngine — Supporta Offline On-Device)
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
        self.onStateChange?(true, "DoomAi in ascolto... parla ora")

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
        onStateChange?(false, "Tocca la Maschera d'Oro per parlare in italiano")
    }
}

// MARK: - 2. Motore Ibrido OTA GitHub + Memoria Flash Offline (Documents/DoomOTA/)
@available(iOS 16.0, *)
struct DoomHybridOfflineOTAWebView: UIViewRepresentable {
    @ObservedObject var engine: HybridAPUEngine
    @ObservedObject var speechRec: StarkSpeechRecognizer

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

        // Pull-to-refresh nativo per scaricare gli aggiornamenti da GitHub e salvarli nella Flash Offline
        let refreshControl = UIRefreshControl()
        refreshControl.tintColor = UIColor(red: 0.94, green: 0.76, blue: 0.22, alpha: 1.0)
        refreshControl.addTarget(context.coordinator, action: #selector(Coordinator.handlePullToRefresh(_:)), for: .valueChanged)
        webView.scrollView.refreshControl = refreshControl

        context.coordinator.webView = webView
        context.coordinator.bindSpeechCallbacks()
        context.coordinator.bootOfflineAndSyncGitHub()

        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        var parent: DoomHybridOfflineOTAWebView
        weak var webView: WKWebView?
        private let synthesizer = AVSpeechSynthesizer()
        private let githubRawBase = "https://raw.githubusercontent.com/GoldenRose01/stark-os-ios-assistant/main/docs"
        private let otaFiles = ["index.html", "index.css", "app.js", "manifest.json"]

        init(parent: DoomHybridOfflineOTAWebView) {
            self.parent = parent
        }

        // Restituisce la cartella persistente Documents/DoomOTA/ nella memoria Flash dell'iPhone
        private func getLocalOTADirectory() -> URL {
            let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            let otaDir = docs.appendingPathComponent("DoomOTA", isDirectory: true)
            if !FileManager.default.fileExists(atPath: otaDir.path) {
                try? FileManager.default.createDirectory(at: otaDir, withIntermediateDirectories: true)
            }
            return otaDir
        }

        // Inizializza la memoria Flash Offline copiando i file da OfflineUI/ dentro il bundle dell'IPA
        private func ensureOfflineFlashSeeded() {
            let otaDir = getLocalOTADirectory()
            let fm = FileManager.default
            guard let bundleOfflineDir = Bundle.main.resourceURL?.appendingPathComponent("OfflineUI") else { return }

            for fileName in ["index.html", "index.css", "app.js", "doom-mask.png", "manifest.json"] {
                let destURL = otaDir.appendingPathComponent(fileName)
                let srcURL = bundleOfflineDir.appendingPathComponent(fileName)
                if !fm.fileExists(atPath: destURL.path), fm.fileExists(atPath: srcURL.path) {
                    try? fm.copyItem(at: srcURL, to: destURL)
                }
            }
        }

        // Carica l'interfaccia istantaneamente dalla memoria Flash interna dell'iPhone (100% Offline Ready)
        func loadFromLocalFlash() {
            ensureOfflineFlashSeeded()
            let otaDir = getLocalOTADirectory()
            let indexURL = otaDir.appendingPathComponent("index.html")
            if FileManager.default.fileExists(atPath: indexURL.path) {
                webView?.loadFileURL(indexURL, allowingReadAccessTo: otaDir)
            } else if let bundleIndex = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "OfflineUI"),
                      let bundleDir = Bundle.main.resourceURL?.appendingPathComponent("OfflineUI") {
                webView?.loadFileURL(bundleIndex, allowingReadAccessTo: bundleDir)
            }
        }

        // Avvio Ibrido: 1) Apre subito l'interfaccia Offline dalla Flash in 0.05s, 2) Se c'è rete sincronizza in background da GitHub
        func bootOfflineAndSyncGitHub() {
            loadFromLocalFlash()
            Task {
                await syncLatestFromGitHub(forceReload: false)
            }
        }

        // Scarica gli ultimi file da GitHub e li salva permanentemente nella memoria Flash Offline dell'iPhone
        func syncLatestFromGitHub(forceReload: Bool) async {
            ensureOfflineFlashSeeded()
            let otaDir = getLocalOTADirectory()
            let ts = Int(Date().timeIntervalSince1970)
            var updatedAnyFile = false

            let config = URLSessionConfiguration.ephemeral
            config.timeoutIntervalForRequest = 7
            let session = URLSession(configuration: config)

            for fileName in otaFiles {
                guard let remoteURL = URL(string: "\(githubRawBase)/\(fileName)?t=\(ts)") else { continue }
                do {
                    let (data, response) = try await session.data(from: remoteURL)
                    guard let httpResp = response as? HTTPURLResponse, httpResp.statusCode == 200, !data.isEmpty else {
                        continue
                    }
                    let localURL = otaDir.appendingPathComponent(fileName)
                    let existingData = try? Data(contentsOf: localURL)
                    if existingData != data {
                        try data.write(to: localURL, options: .atomic)
                        updatedAnyFile = true
                    }
                } catch {
                    // Se siamo offline, mantiene intatti i file già salvati nella memoria Flash!
                }
            }

            if updatedAnyFile || forceReload {
                loadFromLocalFlash()
                try? await Task.sleep(nanoseconds: 400_000_000)
                sendEventToJS(["type": "otaStatus", "message": updatedAnyFile ? "Aggiornato da GitHub!" : "Già all'ultima versione"])
            }
        }

        @objc func handlePullToRefresh(_ sender: UIRefreshControl) {
            Task {
                await syncLatestFromGitHub(forceReload: true)
                sender.endRefreshing()
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

            case "syncConfig":
                if let persona = body["persona"] as? String {
                    parent.engine.persona = persona
                }
                if let tts = body["ttsEnabled"] as? Bool {
                    parent.engine.ttsEnabled = tts
                }
                if let apiConfig = body["apiConfig"] as? [String: Any] {
                    if let g = apiConfig["geminiKey"] as? String { parent.engine.geminiKey = g }
                    if let p = apiConfig["perplexityKey"] as? String { parent.engine.perplexityKey = p }
                    if let o = apiConfig["openaiKey"] as? String { parent.engine.openaiKey = o }
                    if let c = apiConfig["customEndpoint"] as? String { parent.engine.customBackendURL = c }
                }

            default:
                break
            }
        }
    }
}

// MARK: - 3. Vista Principale Full-Screen 6.9" per iPhone 16 Pro Max (Online OTA + 100% Offline Flash)
@available(iOS 16.0, *)
struct StarkHUDView: View {
    @StateObject private var engine = HybridAPUEngine.shared
    @StateObject private var speechRec = StarkSpeechRecognizer()

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea(.all)

            DoomHybridOfflineOTAWebView(
                engine: engine,
                speechRec: speechRec
            )
            .ignoresSafeArea(.all)
        }
        .preferredColorScheme(.dark)
    }
}
