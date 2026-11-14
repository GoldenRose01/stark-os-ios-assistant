import SwiftUI
import AppIntents
import AVFoundation
import Speech

// MARK: - Riconoscimento Vocale Nativo iOS (SFSpeechRecognizer + AVAudioEngine in Italiano)
@MainActor
final class StarkSpeechRecognizer: ObservableObject {
    @Published var isRecording = false
    @Published var transcript = ""
    @Published var statusMessage = "Tocca la Maschera d'Oro per parlare in italiano"

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
                    self.statusMessage = "Abilita Microfono e Riconoscimento Vocale nelle Impostazioni"
                    return
                }
                do {
                    try self.beginAudioSession(onFinalResult: onFinalResult)
                } catch {
                    self.statusMessage = "Errore sessione audio: \(error.localizedDescription)"
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
        self.statusMessage = "DoomAi in ascolto... parla ora"

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
        statusMessage = "Tocca la Maschera d'Oro per parlare in italiano"
    }
}

// MARK: - Vista Principale Multi-Tab Ottimizzata per iPhone 16 Pro Max (6.9" Super Retina XDR)
@available(iOS 16.0, *)
struct StarkHUDView: View {
    @StateObject private var engine = HybridAPUEngine.shared
    @StateObject private var speechRec = StarkSpeechRecognizer()
    @State private var selectedTab: Int = 0

    // Oro 24K per D.O.O.M./J.A.R.V.I.S., Oro-Cremisi per E.D.I.T.H.
    var primaryAccent: Color {
        engine.persona == "edith"
            ? Color(red: 0.96, green: 0.27, blue: 0.38)
            : Color(red: 0.93, green: 0.75, blue: 0.22)
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            StarkConsoleTabView(engine: engine, speechRec: speechRec, primaryAccent: primaryAccent)
                .tabItem {
                    Label("DoomAi HUD", systemImage: "shield.lefthalf.filled")
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
                    Label("Ponte Siri", systemImage: "waveform.badge.mic")
                }
                .tag(3)
        }
        .tint(primaryAccent)
        .preferredColorScheme(.dark)
    }
}

// MARK: - TAB 1: Console Tattica Full-Screen iPhone 16 Pro Max
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
        GeometryReader { geo in
            let isProMax = geo.size.height >= 740
            let reactorOuterSize: CGFloat = isProMax ? 168 : 134
            let reactorInnerSize: CGFloat = isProMax ? 116 : 92

            ZStack {
                // Sfondo Nero Puro OLED per iPhone 16 Pro Max
                Color.black.ignoresSafeArea()

                VStack(spacing: isProMax ? 16 : 12) {
                    // Header Superiore con Icona Maschera d'Oro
                    HStack(spacing: 12) {
                        Image("DoomMaskLogo")
                            .resizable()
                            .scaledToFill()
                            .frame(width: 42, height: 42)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .stroke(primaryAccent.opacity(0.65), lineWidth: 1.2)
                            )

                        VStack(alignment: .leading, spacing: 2) {
                            Text("DOOM AI")
                                .font(.system(size: 19, weight: .heavy, design: .monospaced))
                                .foregroundStyle(primaryAccent)
                            Text("A18 PRO 16-CORE APU // \(engine.persona.uppercased())")
                                .font(.system(size: 10, weight: .semibold, design: .monospaced))
                                .foregroundStyle(.secondary)
                        }

                        Spacer()

                        Picker("Assetto", selection: $engine.persona) {
                            Text("J.A.R.V.I.S.").tag("jarvis")
                            Text("E.D.I.T.H.").tag("edith")
                        }
                        .pickerStyle(.segmented)
                        .frame(width: 156)
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, 8)

                    // Reattore Centrale con Maschera d'Oro Interattiva
                    VStack(spacing: 8) {
                        Button {
                            speechRec.toggleRecording { recognizedText in
                                queryText = recognizedText
                                Task { await executeSearch(recognizedText) }
                            }
                        } label: {
                            ZStack {
                                // Anello Tattico Esterno Rotante in Oro
                                Circle()
                                    .stroke(
                                        primaryAccent.opacity(0.45),
                                        style: StrokeStyle(lineWidth: 3, dash: engine.persona == "edith" ? [14, 8] : [26, 8])
                                    )
                                    .frame(width: reactorOuterSize, height: reactorOuterSize)
                                    .rotationEffect(.degrees(ringRotation))

                                // Anello Pulsante Intermedio
                                Circle()
                                    .stroke(
                                        speechRec.isRecording ? Color.red : primaryAccent.opacity(0.75),
                                        lineWidth: 2.2
                                    )
                                    .frame(width: reactorInnerSize + 18, height: reactorInnerSize + 18)
                                    .scaleEffect(pulseScale)

                                // Maschera d'Oro Centrale
                                Image("DoomMaskLogo")
                                    .resizable()
                                    .scaledToFill()
                                    .frame(width: reactorInnerSize, height: reactorInnerSize)
                                    .clipShape(Circle())
                                    .overlay(
                                        Circle()
                                            .stroke(primaryAccent, lineWidth: 2.5)
                                    )
                                    .shadow(color: primaryAccent.opacity(0.45), radius: 14)

                                // Indicatore Stato Sovrapposto in Basso sul Reattore
                                VStack {
                                    Spacer()
                                    HStack(spacing: 5) {
                                        Image(systemName: speechRec.isRecording ? "stop.fill" : (isProcessing ? "waveform" : "mic.fill"))
                                            .font(.system(size: 11, weight: .bold))
                                        Text(speechRec.isRecording ? "IN ASCOLTO" : (isProcessing ? "SCANSIONE..." : "PARLA"))
                                            .font(.system(size: 10, weight: .heavy, design: .monospaced))
                                    }
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 4)
                                    .background(Color.black.opacity(0.88))
                                    .foregroundStyle(speechRec.isRecording ? Color.red : primaryAccent)
                                    .clipShape(Capsule())
                                    .overlay(Capsule().stroke(primaryAccent.opacity(0.6), lineWidth: 1))
                                }
                                .frame(height: reactorOuterSize + 8)
                            }
                        }
                        .buttonStyle(.plain)

                        Text(speechRec.isRecording ? (speechRec.transcript.isEmpty ? "Parla ora..." : speechRec.transcript) : speechRec.statusMessage)
                            .font(.system(size: 12, weight: .medium, design: .monospaced))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                            .padding(.horizontal, 18)
                    }
                    .onAppear {
                        withAnimation(.linear(duration: 14).repeatForever(autoreverses: false)) {
                            ringRotation = 360
                        }
                        withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
                            pulseScale = 1.10
                        }
                    }

                    // Chip Scansioni Rapide
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 9) {
                            ForEach(presets, id: \.self) { item in
                                Button {
                                    Task { await executeSearch(item) }
                                } label: {
                                    Text(item)
                                        .font(.system(size: 12, weight: .semibold, design: .monospaced))
                                        .padding(.horizontal, 13)
                                        .padding(.vertical, 8)
                                        .background(Color(red: 0.08, green: 0.08, blue: 0.10))
                                        .foregroundStyle(primaryAccent)
                                        .clipShape(Capsule())
                                        .overlay(Capsule().stroke(primaryAccent.opacity(0.38), lineWidth: 1))
                                }
                            }
                        }
                        .padding(.horizontal, 18)
                    }

                    // Flusso Dossier Full-Width Adattivo
                    ScrollView {
                        LazyVStack(spacing: 14) {
                            if history.isEmpty {
                                StarkSiriSnippetView(
                                    response: StarkAssistantResponse(
                                        ok: true,
                                        persona: engine.persona,
                                        speech: "Sistema DoomAi attivo a schermo intero su iPhone 16 Pro Max. Il Neural Engine a 16-Core, il riconoscimento vocale italiano e i moduli di ricerca live sono pronti. Tocca la Maschera d'Oro per parlare o seleziona un comando rapido.",
                                        display: "Sistema DoomAi attivo a schermo intero su iPhone 16 Pro Max.",
                                        provider: "A18 Pro Neural Engine 16-Core",
                                        latencyMs: 5,
                                        cards: [
                                            StarkCardItem(
                                                type: "status",
                                                category: "ASSETTO IMPERIALE DOOM AI // FULL SCREEN",
                                                title: "Calibrato per Display 6.9\" Super Retina XDR",
                                                summary: "Ricerca enciclopedica live, meteo satellitare Open-Meteo, calcoli su APU locale, Task/Memoria e Siri AppIntents operativi.",
                                                metrics: [
                                                    StarkMetric(label: "Display", value: "Full-Screen OLED"),
                                                    StarkMetric(label: "APU", value: "16-Core ANE"),
                                                    StarkMetric(label: "Voce", value: "Italiano Live"),
                                                    StarkMetric(label: "Siri", value: "AppIntents Ready")
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
                        .padding(.horizontal, 18)
                        .padding(.bottom, 8)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)

                    // Barra di Comando Inferiore ancorata sopra la TabBar
                    HStack(spacing: 10) {
                        TextField("Ordina a DoomAi (\(engine.persona.uppercased()))...", text: $queryText)
                            .textFieldStyle(.plain)
                            .font(.system(size: 15))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 12)
                            .background(Color(red: 0.09, green: 0.09, blue: 0.12))
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .stroke(primaryAccent.opacity(0.35), lineWidth: 1)
                            )
                            .foregroundStyle(.white)
                            .submitLabel(.send)
                            .onSubmit {
                                Task { await executeSearch(queryText) }
                            }

                        Button {
                            Task { await executeSearch(queryText) }
                        } label: {
                            Image(systemName: "arrow.up.circle.fill")
                                .font(.system(size: 36))
                                .foregroundStyle(primaryAccent)
                        }
                        .disabled(queryText.trimmingCharacters(in: .whitespaces).isEmpty || isProcessing)
                    }
                    .padding(.horizontal, 18)
                    .padding(.bottom, 10)
                }
                .frame(width: geo.size.width, height: geo.size.height)
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
                Section("Telemetria Hardware APU iPhone 16 Pro Max") {
                    HStack {
                        Text("Acceleratore Locale")
                        Spacer()
                        Text("A18 Pro Neural Engine")
                            .font(.system(size: 12, weight: .semibold, design: .monospaced))
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
                    footer: Text("Le chiavi restano salvate esclusivamente nella memoria locale del tuo iPhone. Anche senza chiavi, DoomAi esegue ricerche live su Wikipedia, Open-Meteo e calcoli sull'APU.")
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
            .navigationTitle("Motore DoomAi & APU")
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
                    header: Text("Memoria Contestuale DoomAi"),
                    footer: Text("Questi fatti vengono ricordati da DoomAi nelle risposte vocali e su Siri.")
                ) {
                    HStack {
                        TextField("Memorizza preferenza o direttiva...", text: $newMemoryText)
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
                        Text("COMANDI VOCALI SIRI REGISTRATI IN DOOM AI")
                            .font(.system(size: 12, weight: .bold, design: .monospaced))
                            .foregroundStyle(primaryAccent)

                        Text("DoomAi integra il framework nativo Apple AppIntents. Puoi attivare l'assistente in qualsiasi momento dicendo a voce:")
                            .font(.system(size: 14))
                            .foregroundStyle(.secondary)

                        VStack(alignment: .leading, spacing: 10) {
                            Label("\"Ehi Siri, chiedi a Doom con DoomAi\"", systemImage: "shield.lefthalf.filled")
                            Label("\"Ehi Siri, chiedi a Jarvis con DoomAi\"", systemImage: "waveform")
                            Label("\"Ehi Siri, protocollo Edith su DoomAi\"", systemImage: "eyeglasses")
                        }
                        .font(.system(size: 14, weight: .semibold, design: .monospaced))
                        .foregroundStyle(primaryAccent)
                        .padding(.top, 4)
                    }
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(red: 0.07, green: 0.07, blue: 0.09))
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(primaryAccent.opacity(0.35), lineWidth: 1)
                    )
                }
                .padding()
            }
            .navigationTitle("Ponte Siri DoomAi")
        }
    }
}
