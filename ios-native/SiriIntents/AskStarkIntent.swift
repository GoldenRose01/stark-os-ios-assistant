import AppIntents
import SwiftUI

// MARK: - 1. Intent Principale: Chiedi a J.A.R.V.I.S. / E.D.I.T.H. tramite Siri
@available(iOS 16.0, macOS 13.0, watchOS 9.0, *)
struct AskStarkIntent: AppIntent {
    static var title: LocalizedStringResource = "Chiedi a J.A.R.V.I.S. o E.D.I.T.H."
    static var description = IntentDescription(
        "Esegue una ricerca omnicanale, analisi su APU locale o interrogazione AI tramite il protocollo Stark.",
        categoryName: "Intelligence & Ricerca"
    )

    static var openAppWhenRun: Bool = false

    @Parameter(
        title: "Richiesta o Bersaglio di Ricerca",
        requestValueDialog: IntentDialog("Agli ordini, Signore. Quale ricerca o operazione devo eseguire?")
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

// MARK: - 2. Enum Protocollo (J.A.R.V.I.S. vs E.D.I.T.H.)
@available(iOS 16.0, *)
enum StarkPersonaAppEnum: String, AppEnum {
    case jarvis = "jarvis"
    case edith = "edith"

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Protocollo AI")
    static var caseDisplayRepresentations: [StarkPersonaAppEnum: DisplayRepresentation] = [
        .jarvis: DisplayRepresentation(
            title: "J.A.R.V.I.S.",
            subtitle: "Analitico, enciclopedico e gestione globale"
        ),
        .edith: DisplayRepresentation(
            title: "E.D.I.T.H.",
            subtitle: "Ricognizione tattica AR e sintesi rapida"
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
                "Chiedi a Jarvis con \(.applicationName)",
                "Protocollo Edith su \(.applicationName)",
                "Interroga Stark con \(.applicationName)",
                "Scansione tattica con \(.applicationName)"
            ],
            shortTitle: "Chiedi a Jarvis / Edith",
            systemImageName: "waveform.circle.fill"
        )
    }
}

// MARK: - 4. Snippet HUD Visualizzato direttamente dentro l'interfaccia di Siri
@available(iOS 16.0, *)
struct StarkSiriSnippetView: View {
    let response: StarkAssistantResponse

    var accentColor: Color {
        response.persona == "edith"
            ? Color(red: 0.96, green: 0.25, blue: 0.37)
            : Color(red: 0.16, green: 0.78, blue: 0.96)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Circle()
                    .fill(accentColor)
                    .frame(width: 8, height: 8)
                Text(response.persona.uppercased() + " // " + response.provider.uppercased())
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .foregroundStyle(accentColor)
                Spacer()
                Text("\(response.latencyMs) ms")
                    .font(.system(size: 10, weight: .medium, design: .monospaced))
                    .foregroundStyle(.secondary)
            }

            Text(response.speech)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(.primary)
                .lineLimit(5)

            if let firstCard = response.cards.first {
                Divider()
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(firstCard.category)
                            .font(.system(size: 9, weight: .semibold, design: .monospaced))
                            .foregroundStyle(.secondary)
                        Text(firstCard.title)
                            .font(.system(size: 12, weight: .bold))
                    }
                    Spacer()
                }
            }
        }
        .padding(14)
        .background(Color.black.opacity(0.88))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}
