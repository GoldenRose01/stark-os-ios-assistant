import AppIntents
import SwiftUI

// MARK: - 1. Intent Principale: Chiedi a DoomAi (J.A.R.V.I.S. / E.D.I.T.H.) tramite Siri
@available(iOS 16.0, macOS 13.0, watchOS 9.0, *)
struct AskStarkIntent: AppIntent {
    static var title: LocalizedStringResource = "Chiedi a DoomAi"
    static var description = IntentDescription(
        "Esegue una ricerca omnicanale, analisi su APU locale o interrogazione AI tramite DoomAi.",
        categoryName: "Intelligence & Ricerca"
    )

    static var openAppWhenRun: Bool = false

    @Parameter(
        title: "Richiesta o Bersaglio di Ricerca",
        requestValueDialog: IntentDialog("DoomAi in ascolto. Quale ricerca o operazione devo eseguire?")
    )
    var query: String

    @Parameter(title: "Protocollo Operativo", default: .jarvis)
    var persona: StarkPersonaAppEnum

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        let engine = HybridAPUEngine.shared
        let response = await engine.executeHybridQuery(
            query: query,
            persona: persona.rawValue
        )

        return .result(
            dialog: IntentDialog(stringLiteral: response.speech),
            view: StarkSiriSnippetView(response: response)
        )
    }
}

// MARK: - 2. Enum Protocollo (D.O.O.M.-J.A.R.V.I.S. vs E.D.I.T.H.)
@available(iOS 16.0, *)
enum StarkPersonaAppEnum: String, AppEnum {
    case jarvis = "jarvis"
    case edith = "edith"

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Protocollo DoomAi")
    static var caseDisplayRepresentations: [StarkPersonaAppEnum: DisplayRepresentation] = [
        .jarvis: DisplayRepresentation(
            title: "J.A.R.V.I.S.",
            subtitle: "Assetto Imperiale Oro — Analitico ed enciclopedico"
        ),
        .edith: DisplayRepresentation(
            title: "E.D.I.T.H.",
            subtitle: "Assetto Tattico Cremisi — Ricognizione rapida"
        )
    ]
}

// MARK: - 3. Registrazione Automatica Comandi Vocali Siri ("Ehi Siri...")
@available(iOS 16.0, *)
struct StarkShortcutsProvider: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: AskStarkIntent(),
            phrases: [
                "Chiedi a Doom con \(.applicationName)",
                "Chiedi a Jarvis con \(.applicationName)",
                "Protocollo Edith su \(.applicationName)",
                "Scansione tattica con \(.applicationName)"
            ],
            shortTitle: "Chiedi a DoomAi",
            systemImageName: "shield.lefthalf.filled"
        )
    }
}

// MARK: - 4. Card Dossier in Stile Oro 24K & Nero Ossidiana
@available(iOS 16.0, *)
struct StarkSiriSnippetView: View {
    let response: StarkAssistantResponse

    var accentColor: Color {
        response.persona == "edith"
            ? Color(red: 0.96, green: 0.27, blue: 0.38)
            : Color(red: 0.93, green: 0.74, blue: 0.22) // 24K Doom Gold
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Circle()
                    .fill(accentColor)
                    .frame(width: 8, height: 8)
                Text("DOOM AI // " + response.persona.uppercased() + " // " + response.provider.uppercased())
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .foregroundStyle(accentColor)
                    .lineLimit(1)
                Spacer()
                Text("\(response.latencyMs) ms")
                    .font(.system(size: 10, weight: .medium, design: .monospaced))
                    .foregroundStyle(.secondary)
            }

            Text(response.speech)
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)

            if let firstCard = response.cards.first {
                Divider().overlay(accentColor.opacity(0.25))
                VStack(alignment: .leading, spacing: 6) {
                    Text(firstCard.category)
                        .font(.system(size: 9.5, weight: .semibold, design: .monospaced))
                        .foregroundStyle(accentColor)
                    Text(firstCard.title)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.white)

                    if let metrics = firstCard.metrics, !metrics.isEmpty {
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], alignment: .leading, spacing: 8) {
                            ForEach(metrics, id: \.self) { m in
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(m.label.uppercased())
                                        .font(.system(size: 8.5, weight: .medium, design: .monospaced))
                                        .foregroundStyle(.secondary)
                                    Text(m.value)
                                        .font(.system(size: 12, weight: .semibold, design: .monospaced))
                                        .foregroundStyle(accentColor)
                                }
                            }
                        }
                        .padding(.top, 4)
                    }
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(red: 0.06, green: 0.06, blue: 0.08))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(accentColor.opacity(0.42), lineWidth: 1)
        )
    }
}
