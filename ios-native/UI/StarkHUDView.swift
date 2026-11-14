import SwiftUI
import WebKit
import AppIntents
import AVFoundation
import Speech

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

// MARK: - 2. Guscio Nativo OTA GitHub (WKWebView Full-Screen + Bridge Hardware doomNative)
@available(iOS 16.0, *)
struct DoomGitHubOTAWebView: UIViewRepresentable {
    let remoteURLString: String
    @ObservedObject var engine: HybridAPUEngine
    @ObservedObject var speechRec: StarkSpeechRecognizer
    @Binding var loadFailedOffline: Bool

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

        // Pull-to-refresh nativo iOS per ricaricare istantaneamente l'interfaccia da GitHub
        let refreshControl = UIRefreshControl()
        refreshControl.tintColor = UIColor(red: 0.94, green: 0.76, blue: 0.22, alpha: 1.0)
        refreshControl.addTarget(context.coordinator, action: #selector(Coordinator.handlePullToRefresh(_:)), for: .valueChanged)
        webView.scrollView.refreshControl = refreshControl

        context.coordinator.webView = webView
        context.coordinator.bindSpeechCallbacks()
        context.coordinator.loadFreshFromGitHub()

        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        var parent: DoomGitHubOTAWebView
        weak var webView: WKWebView?
        private let synthesizer = AVSpeechSynthesizer()

        init(parent: DoomGitHubOTAWebView) {
            self.parent = parent
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

        func loadFreshFromGitHub() {
            let ts = Int(Date().timeIntervalSince1970)
            guard let url = URL(string: "\(parent.remoteURLString)?ota=\(ts)") else { return }
            let req = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalAndRemoteCacheData, timeoutInterval: 12)
            webView?.load(req)
        }

        @objc func handlePullToRefresh(_ sender: UIRefreshControl) {
            loadFreshFromGitHub()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.9) {
                sender.endRefreshing()
            }
        }

        func sendEventToJS(_ dict: [String: Any]) {
            guard let data = try? JSONSerialization.data(withJSONObject: dict),
                  let jsonStr = String(data: data, encoding: .utf8) else { return }
            webView?.evaluateJavaScript("window.onDoomNativeEvent && window.onDoomNativeEvent(\(jsonStr));", completionHandler: nil)
        }

        // Gestione messaggi provenienti dall'interfaccia caricata da GitHub
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
                loadFreshFromGitHub()

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

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            parent.loadFailedOffline = true
        }
    }
}

// MARK: - 3. Vista Principale dell'App Nativa DoomAi (Carica UI da GitHub a Schermo Intero 6.9")
@available(iOS 16.0, *)
struct StarkHUDView: View {
    @StateObject private var engine = HybridAPUEngine.shared
    @StateObject private var speechRec = StarkSpeechRecognizer()
    @State private var loadFailedOffline = false

    // URL Live GitHub Pages del tuo repository (ogni push su GitHub aggiorna istantaneamente l'app!)
    private let githubLiveURL = "https://goldenrose01.github.io/stark-os-ios-assistant/"

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea(.all)

            if !loadFailedOffline {
                DoomGitHubOTAWebView(
                    remoteURLString: githubLiveURL,
                    engine: engine,
                    speechRec: speechRec,
                    loadFailedOffline: $loadFailedOffline
                )
                .ignoresSafeArea(.all)
            } else {
                // Fallback Offline Nativo se l'iPhone è senza connessione Internet
                VStack(spacing: 18) {
                    Image("DoomMaskLogo")
                        .resizable()
                        .scaledToFill()
                        .frame(width: 110, height: 110)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(Color(red: 0.94, green: 0.76, blue: 0.22), lineWidth: 2.5))

                    Text("DOOM AI // MODALITÀ OFFLINE APU")
                        .font(.system(size: 17, weight: .bold, design: .monospaced))
                        .foregroundStyle(Color(red: 0.94, green: 0.76, blue: 0.22))

                    Text("Connessione assente per scaricare l'interfaccia live da GitHub. Verifica il Wi-Fi/5G e premi Riconnetti.")
                        .font(.system(size: 13))
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 28)

                    Button {
                        loadFailedOffline = false
                    } label: {
                        Text("Riconnetti a GitHub Live")
                            .font(.system(size: 14, weight: .bold, design: .monospaced))
                            .padding(.horizontal, 20)
                            .padding(.vertical, 12)
                            .background(Color(red: 0.94, green: 0.76, blue: 0.22))
                            .foregroundStyle(.black)
                            .clipShape(Capsule())
                    }
                }
            }
        }
        .preferredColorScheme(.dark)
    }
}
