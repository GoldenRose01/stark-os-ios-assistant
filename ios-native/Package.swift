// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "StarkOSAssistant",
    platforms: [
        .iOS(.v16),
        .macOS(.v13)
    ],
    products: [
        .library(
            name: "StarkOSAssistant",
            targets: ["StarkOSAssistant"]
        )
    ],
    targets: [
        .target(
            name: "StarkOSAssistant",
            path: ".",
            sources: [
                "StarkOSApp.swift",
                "SiriIntents/AskStarkIntent.swift",
                "Engine/HybridAPUEngine.swift",
                "UI/StarkHUDView.swift"
            ]
        )
    ]
)
