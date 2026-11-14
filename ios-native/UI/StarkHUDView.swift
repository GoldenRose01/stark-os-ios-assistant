import SwiftUI
import AppIntents
import AVFoundation
import Speech

// MARK: - Riconoscimento Vocale Nativo iOS (SFSpeechRecognizer + AVAudioEngine in Italiano)
@MainActor
final class StarkSpeechRecognizer: ObservableObject {
    @Published var isRecording = false
    @Published var transcript = ""
    @Published var statusMessage = "Tocca il Reattore per parlare in italiano"

    private let speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "it-IT"))
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let audioEngine = AVAudioEngine()

    func toggleRecording(onFinalResult: @escaping (String) -> Void) {
        if isRecording {
            stopRecording()
        } else {
            startRecording(onFinalResult: onFinalResult)
        }
    }

    private func startRecording(onFinalResult: @escaping (String) -> Void) {
        SFSpeechRecognizer.requestAuthorization { authStatus in
            Task { @MainActor in
                guard authStatus == .authorized else {
                    self.statusMessage = "Permesso microfono/voce richiesto nelle Impostazioni iOS"
                    return
                }
                do {
                    try self.beginAudioSession(onFinalResult: onFinalResult)
                } catch {
                    self.statusMessage = "Impossibile avviare la sessione audio: \(error.localizedDescription)"
                }
            }
        }
    }

    private func beginAudioSession(onFinalResult: @escaping (String) -> Void) throws {
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
        self.statusMessage = "In ascolto... parla ora"

        recognitionTask = speechRecognizer?.recognitionTask(with: request) { [weak self] result, error in
            guard let self = self else { return }
            Task { @MainActor in
                if let result = result {
                    self.transcript = result.bestTranscription.formattedString
                    if result.isFinal {
                        let finalStr = self.transcript
                        self.stopRecording()
                        if !finalStr.isEmpty {
                            onFinalResult(finalStr)
                        }
                    }
                }
                if error != nil {
                    self.stopRecording()
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
        statusMessage = "Tocca il Reattore per parlare in italiano"
    }
}

// MARK: - Vista Principale Multi-Tab dell'App Nativa iOS
@available(iOS 16.0, *)
struct StarkHUDView: View {
    @StateObject private var engine = HybridAPUEngine.shared
    @StateObject private var speechRec = StarkSpeechRecognizer()
    @State private var selectedTab: Int = 0

    var primaryAccent: Color {
        engine.persona == "edith"
            ? Color(red: 0.98, green: 0.35, blue: 0.45)
            : Color(red: 0.13, green: 0.83, blue: 0.93)
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            StarkConsoleTabView(engine: engine, speechRec: speechRec, primaryAccent: primaryAccent)
                .tabItem {
                    Label("HUD Console", systemImage: "waveform.circle.fill")
                }
                .tag(0)

            StarkAIEngineTabView(engine: engine, primaryAccent: primaryAccent)
                .tabItem {
                    Label("Motore & APU", systemImage: "cpu.fill")
                }
                .tag(1)

            StarkTasksMemoryTabView(engine: engine, primaryAccent: primaryAccent)
                .tabItem {
                    Label("Task & Memoria", systemImage: "checklist")
                }
                .tag(2)

            StarkSiriGuideTabView(engine: engine, primaryAccent: primaryAccent)
                .tabItem {
                    Label("Ponte Siri", systemImage: "mic.badge.plus")
                }
                .tag(3)
        }
        .tint(primaryAccent)
    }
}

// MARK: - TAB 1: Console Tattica HUD + Reattore Vocale + Dossier Live
@available(iOS 16.0, *)
struct StarkConsoleTabView: View {
    @ObservedObject var engine: HybridAPUEngine
    @ObservedObject var speechRec: StarkSpeechRecognizer
    let primaryAccent: Color

    @State private var queryText: String = ""
    @State private var history: [StarkAssistantResponse] = []
    @State private var isProcessing: Bool = false
    @State private var ringRotation: Double = 0
    @State private var pulseScale: CGFloat = 1.0

    private let synthesizer = AVSpeechSynthesizer()

    private let presets = [
        "Meteo Roma live",
        "Meteo Milano",
        "Chi era Nikola Tesla",
        "Cos'è un buco nero",
        "Calcola 1450 * 18.5",
        "Ricordami briefing alle 18:00"
    ]

    var body: some View {
        ZStack {
            Color(red: 0.03, green: 0.05, blue: 0.09).ignoresSafeArea()

            VStack(spacing: 12) {
                // Top Header Bar
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(engine.persona == "edith" ? "E.D.I.T.H. // TACTICAL HUD" : "J.A.R.V.I.S. // MARK VII")
                            .font(.system(size: 16, weight: .bold, design: .monospaced))
                            .foregroundStyle(primaryAccent)
                        Text("ON-DEVICE APPLE NEURAL ENGINE + SIRI")
                            .font(.system(size: 10, weight: .medium, design: .monospaced))
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Picker("Protocollo", selection: $engine.persona) {
                        Text("J.A.R.V.I.S.").tag("jarvis")
                        Text("E.D.I.T.H.").tag("edith")
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 165)
                }
                .padding(.horizontal)
                .padding(.top, 6)

                // Reattore Vocale Interattivo
                VStack(spacing: 6) {
                    Button {
                        speechRec.toggleRecording { recognizedText in
                            queryText = recognizedText
                            Task { await executeSearch(recognizedText) }
                        }
                    } label: {
                        ZStack {
                            Circle()
                                .stroke(
                                    primaryAccent.opacity(0.35),
                                    style: StrokeStyle(lineWidth: 3, dash: engine.persona == "edith" ? [14, 8] : [22, 6])
                                )
                                .frame(width: 122, height: 122)
                                .rotationEffect(.degrees(ringRotation))

                            Circle()
                                .stroke(primaryAccent.opacity(0.55), lineWidth: 2)
                                .frame(width: 94, height: 94)
                                .scaleEffect(pulseScale)

                            Circle()
                                .fill(speechRec.isRecording ? Color.red.opacity(0.28) : primaryAccent.opacity(0.16))
                                .frame(width: 76, height: 76)

                            VStack(spacing: 2) {
                                Image(systemName: speechRec.isRecording ? "stop.fill" : (isProcessing ? "waveform" : "mic.fill"))
                                    .font(.system(size: 24, weight: .bold))
                                    .foregroundStyle(speechRec.isRecording ? .red : primaryAccent)
                                Text(speechRec.isRecording ? "STOP" : (isProcessing ? "SCAN" : engine.persona.uppercased()))
                                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                                    .foregroundStyle(.white)
                            }
                        }
                    }
                    .buttonStyle(.plain)

                    Text(speechRec.isRecording ? (speechRec.transcript.isEmpty ? "Parla ora..." : speechRec.transcript) : speechRec.statusMessage)
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                .onAppear {
                    withAnimation(.linear(duration: 12).repeatForever(autoreverses: false)) {
                        ringRotation = 360
                    }
                    withAnimation(.easeInOut(duration: 1.6).repeatForever(autoreverses: true)) {
                        pulseScale = 1.12
                    }
                }

                // Chip Scansioni Rapide
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(presets, id: \.self) { item in
                            Button {
                                Task { await executeSearch(item) }
                            } label: {
                                Text(item)
                                    .font(.system(size: 11, weight: .medium, design: .monospaced))
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(Color.white.opacity(0.06))
                                    .foregroundStyle(primaryAccent)
                                    .clipShape(Capsule())
                                    .overlay(Capsule().stroke(primaryAccent.opacity(0.3), lineWidth: 1))
                            }
                        }
                    }
                    .padding(.horizontal)
                }

                // Flusso Risposte e Dossier
                ScrollView {
                    LazyVStack(spacing: 12) {
                        if history.isEmpty {
                            StarkSiriSnippetView(
                                response: StarkAssistantResponse(
                                    ok: true,
                                    persona: engine.persona,
                                    speech: "Bentornato, Signore. Tutti i sistemi nativi iOS sull'Apple Neural Engine sono operativi. Tocca il Reattore per parlare o scegli una scansione rapida.",
                                    display: "Bentornato, Signore. Tutti i sistemi nativi iOS sull'Apple Neural Engine sono operativi.",
                                    provider: "Apple Neural Engine 16-Core",
                                    latencyMs: 6,
                                    cards: [
                                        StarkCardItem(
                                            type: "status",
                                            category: "STATO SISTEMA NATIVO iOS",
                                            title: "App Nativa StarkOS Pronta",
                                            summary: "Riconoscimento vocale italiano, Wikipedia live, Open-Meteo, Co-Processore matematico e Siri AppIntents attivi.",
                                            metrics: [
                                                StarkMetric(label: "Engine", value: "CoreML + ANE"),
                                                StarkMetric(label: "Siri", value: "AppIntents Attivo")
                                            ],
                                            sourceURL: nil
                                        )
                                    ]
                                )
                            )
                        } else {
                            ForEach(Array(history.enumerated()), id: \.offset) { _, item in
                                StarkSiriSnippetView(response: item)
                            }
                        }
                    }
                    .padding(.horizontal)
                }

                // Barra di Comando Testuale / Vocale
                HStack(spacing: 10) {
                    TextField("Chiedi qualsiasi cosa a \(engine.persona.uppercased())...", text: $queryText)
                        .textFieldStyle(.plain)
                        .padding(11)
                        .background(Color.white.opacity(0.08))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .foregroundStyle(.white)
                        .submitLabel(.send)
                        .onSubmit {
                            Task { await executeSearch(queryText) }
                        }

                    Button {
                        Task { await executeSearch(queryText) }
                    } label: {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.system(size: 32))
                            .foregroundStyle(primaryAccent)
                    }
                    .disabled(queryText.trimmingCharacters(in: .whitespaces).isEmpty || isProcessing)
                }
                .padding(.horizontal)
                .padding(.bottom, 8)
            }
        }
    }

    private func executeSearch(_ raw: String) async {
        let q = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return }
        if speechRec.isRecording {
            speechRec.stopRecording()
        }
        isProcessing = true
        queryText = ""

        let response = await engine.executeHybridQuery(query: q, persona: engine.persona)
        history.insert(response, at: 0)
        isProcessing = false

        if engine.ttsEnabled {
            synthesizer.stopSpeaking(at: .immediate)
            let utterance = AVSpeechUtterance(string: response.speech)
            utterance.voice = AVSpeechSynthesisVoice(language: "it-IT")
            utterance.rate = engine.persona == "edith" ? 0.52 : 0.49
            synthesizer.speak(utterance)
        }
    }
}

// MARK: - TAB 2: Configurazione Motore AI, APU & Vault API Key
@available(iOS 16.0, *)
struct StarkAIEngineTabView: View {
    @ObservedObject var engine: HybridAPUEngine
    let primaryAccent: Color

    var body: some View {
        NavigationStack {
            Form {
                Section("Telemetria Hardware APU iPhone") {
                    HStack {
                        Text("Acceleratore Locale")
                        Spacer()
                        Text("Apple Neural Engine (CoreML .all)")
                            .font(.system(size: 12, design: .monospaced))
                            .foregroundStyle(primaryAccent)
                    }
                    HStack {
                        Text("Core Attivi Dispositivo")
                        Spacer()
                        Text("\(ProcessInfo.processInfo.activeProcessorCount) Core")
                            .font(.system(size: 12, design: .monospaced))
                    }
                    Toggle("Sintesi Vocale Italiana (TTS)", isOn: $engine.ttsEnabled)
                }

                Section(
                    header: Text("Vault Chiavi API Cloud (Opzionali)"),
                    footer: Text("Le chiavi restano salvate esclusivamente nella memoria locale del tuo iPhone. Anche senza chiavi, l'app esegue ricerche live su Wikipedia, Open-Meteo e calcoli sull'APU.")
                ) {
                    SecureField("Google Gemini API Key (AIza...)", text: $engine.geminiKey)
                    SecureField("Perplexity Sonar API Key (pplx-...)", text: $engine.perplexityKey)
                    SecureField("OpenAI API Key (sk-...)", text: $engine.openaiKey)
                }

                Section("Backend Custom (Opzionale)") {
                    TextField("URL Server (es. http://192.168.1.50:3000/api/siri)", text: $engine.customBackendURL)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                }
            }
            .navigationTitle("Motore AI & APU")
        }
    }
}

// MARK: - TAB 3: Task Operativi & Memoria Contestuale
@available(iOS 16.0, *)
struct StarkTasksMemoryTabView: View {
    @ObservedObject var engine: HybridAPUEngine
    let primaryAccent: Color

    @State private var newTaskText = ""
    @State private var newMemoryText = ""

    var body: some View {
        NavigationStack {
            List {
                Section("Nuovo Task o Promemoria") {
                    HStack {
                        TextField("Aggiungi missione o promemoria...", text: $newTaskText)
                        Button("Aggiungi") {
                            engine.addTask(newTaskText)
                            newTaskText = ""
                        }
                        .disabled(newTaskText.trimmingCharacters(in: .whitespaces).isEmpty)
                    }

                    ForEach(engine.tasks) { item in
                        HStack {
                            Image(systemName: item.isCompleted ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(item.isCompleted ? .green : primaryAccent)
                                .onTapGesture { engine.toggleTask(item) }
                            Text(item.text)
                                .strikethrough(item.isCompleted)
                            Spacer()
                        }
                        .swipeActions {
                            Button(role: .destructive) {
                                engine.deleteTask(item)
                            } label: {
                                Label("Elimina", systemImage: "trash")
                            }
                        }
                    }
                }

                Section(
                    header: Text("Memoria Contestuale J.A.R.V.I.S. / E.D.I.T.H."),
                    footer: Text("Questi fatti vengono ricordati dall'assistente nelle risposte vocali e su Siri.")
                ) {
                    HStack {
                        TextField("Memorizza preferenza o dato...", text: $newMemoryText)
                        Button("Salva") {
                            engine.addMemory(newMemoryText)
                            newMemoryText = ""
                        }
                        .disabled(newMemoryText.trimmingCharacters(in: .whitespaces).isEmpty)
                    }

                    ForEach(engine.memories) { mem in
                        Text(mem.fact)
                            .font(.system(size: 13))
                            .swipeActions {
                                Button(role: .destructive) {
                                    engine.deleteMemory(mem)
                                } label: {
                                    Label("Elimina", systemImage: "trash")
                                }
                            }
                    }
                }
            }
            .navigationTitle("Task & Memoria")
        }
    }
}

// MARK: - TAB 4: Ponte Vocale Nativo Siri (AppIntents)
@available(iOS 16.0, *)
struct StarkSiriGuideTabView: View {
    @ObservedObject var engine: HybridAPUEngine
    let primaryAccent: Color

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    SiriTipView(intent: AskStarkIntent())

                    VStack(alignment: .leading, spacing: 10) {
                        Text("COMANDI VOCALI SIRI REGISTRATI")
                            .font(.system(size: 12, weight: .bold, design: .monospaced))
                            .foregroundStyle(primaryAccent)

                        Text("Questa app integra il framework nativo Apple AppIntents. Puoi attivare l'assistente in qualsiasi momento dicendo a voce:")
                            .font(.system(size: 14))
                            .foregroundStyle(.secondary)

                        VStack(alignment: .leading, spacing: 8) {
                            Label("\"Ehi Siri, chiedi a Jarvis con StarkOS\"", systemImage: "waveform")
                            Label("\"Ehi Siri, protocollo Edith su StarkOS\"", systemImage: "eyeglasses")
                            Label("\"Ehi Siri, interroga Stark con StarkOS\"", systemImage: "bolt.circle")
                        }
                        .font(.system(size: 14, weight: .semibold, design: .monospaced))
                        .padding(.top, 4)
                    }
                    .padding()
                    .background(Color.white.opacity(0.06))
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                }
                .padding()
            }
            .navigationTitle("Ponte Siri iOS")
        }
    }
}
