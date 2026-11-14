import SwiftUI
import AppIntents
import AVFoundation

@available(iOS 16.0, *)
struct StarkHUDView: View {
    @State private var persona: String = "jarvis"
    @State private var queryText: String = ""
    @State private var lastResponse: StarkAssistantResponse?
    @State private var isProcessing: Bool = false
    @State private var pulseScale: CGFloat = 1.0

    private let synthesizer = AVSpeechSynthesizer()

    var primaryAccent: Color {
        persona == "edith"
            ? Color(red: 0.96, green: 0.25, blue: 0.37)
            : Color(red: 0.16, green: 0.78, blue: 0.96)
    }

    var body: some View {
        ZStack {
            Color(red: 0.03, green: 0.05, blue: 0.08).ignoresSafeArea()

            VStack(spacing: 20) {
                // Header & Switcher J.A.R.V.I.S. / E.D.I.T.H.
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(persona == "edith" ? "E.D.I.T.H. TACTICAL NET" : "J.A.R.V.I.S. MARK VII")
                            .font(.system(size: 16, weight: .bold, design: .monospaced))
                            .foregroundStyle(primaryAccent)
                        Text("APU 16-CORE ANE // SIRI BRIDGE ONLINE")
                            .font(.system(size: 10, weight: .medium, design: .monospaced))
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Picker("Protocollo", selection: $persona) {
                        Text("J.A.R.V.I.S.").tag("jarvis")
                        Text("E.D.I.T.H.").tag("edith")
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 170)
                }
                .padding(.horizontal)

                // Siri Native Tip Banner
                SiriTipView(intent: AskStarkIntent())
                    .padding(.horizontal)

                // Reattore Vocale Animato
                ZStack {
                    Circle()
                        .stroke(primaryAccent.opacity(0.35), lineWidth: 2)
                        .frame(width: 140, height: 140)
                        .scaleEffect(pulseScale)
                        .animation(.easeInOut(duration: 1.8).repeatForever(autoreverses: true), value: pulseScale)

                    Circle()
                        .fill(primaryAccent.opacity(0.15))
                        .frame(width: 105, height: 105)

                    Image(systemName: isProcessing ? "waveform" : "mic.fill")
                        .font(.system(size: 32, weight: .bold))
                        .foregroundStyle(primaryAccent)
                }
                .onAppear { pulseScale = 1.16 }

                // Output Dossier HUD
                ScrollView {
                    if let resp = lastResponse {
                        StarkSiriSnippetView(response: resp)
                            .padding(.horizontal)
                    } else {
                        Text("Pronuncia \"Ehi Siri, chiedi a Jarvis\" oppure inserisci un comando tattico qui sotto.")
                            .font(.system(size: 13, design: .monospaced))
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(24)
                    }
                }

                // Barra di Comando
                HStack(spacing: 12) {
                    TextField("Chiedi qualsiasi cosa a \(persona.uppercased())...", text: $queryText)
                        .textFieldStyle(.plain)
                        .padding(12)
                        .background(Color.white.opacity(0.06))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .foregroundStyle(.white)

                    Button {
                        Task { await sendQuery() }
                    } label: {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.system(size: 32))
                            .foregroundStyle(primaryAccent)
                    }
                    .disabled(queryText.trimmingCharacters(in: .whitespaces).isEmpty || isProcessing)
                }
                .padding(.horizontal)
                .padding(.bottom, 12)
            }
        }
    }

    private func sendQuery() async {
        let q = queryText.trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else { return }
        isProcessing = true
        queryText = ""

        let response = await HybridAPUEngine.shared.executeHybridQuery(query: q, persona: persona)
        lastResponse = response
        isProcessing = false

        let utterance = AVSpeechUtterance(string: response.speech)
        utterance.voice = AVSpeechSynthesisVoice(language: "it-IT")
        utterance.rate = persona == "edith" ? 0.53 : 0.49
        synthesizer.speak(utterance)
    }
}
