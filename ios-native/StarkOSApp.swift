import SwiftUI
import AppIntents

@available(iOS 16.0, *)
@main
struct StarkOSApp: App {
    init() {
        // Registra automaticamente i comandi vocali "Ehi Siri, chiedi a Jarvis / Edith" all'avvio
        StarkShortcutsProvider.updateAppShortcutParameters()
    }

    var body: some Scene {
        WindowGroup {
            StarkHUDView()
                .preferredColorScheme(.dark)
        }
    }
}
