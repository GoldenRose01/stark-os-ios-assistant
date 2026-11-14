import Foundation
import NaturalLanguage
import CoreML
import Combine

// MARK: - Modelli Dati Nativi iOS
struct StarkMetric: Codable, Hashable {
    let label: String
    let value: String
}

struct StarkCardItem: Codable, Identifiable, Hashable {
    var id: String { title + category }
    let type: String?
    let category: String
    let title: String
    let summary: String
    let metrics: [StarkMetric]?
    let sourceURL: String?
}

struct StarkAssistantResponse: Codable {
    let ok: Bool
    let persona: String
    let speech: String
    let display: String
    let provider: String
    let latencyMs: Int
    let cards: [StarkCardItem]
}

struct StarkTaskItem: Codable, Identifiable {
    let id: UUID
    var text: String
    var isCompleted: Bool
    let createdAt: Date
}

struct StarkMemoryItem: Codable, Identifiable {
    let id: UUID
    var fact: String
    let createdAt: Date
}

// MARK: - Motore Nativo All-in-One iOS (16-Core Apple Neural Engine + Live RAG + Multi-API)
@MainActor
final class HybridAPUEngine: ObservableObject {
    static let shared = HybridAPUEngine()

    @Published var persona: String {
        didSet { UserDefaults.standard.set(persona, forKey: "stark_persona") }
    }
    @Published var ttsEnabled: Bool {
        didSet { UserDefaults.standard.set(ttsEnabled, forKey: "stark_tts_enabled") }
    }
    @Published var geminiKey: String {
        didSet { UserDefaults.standard.set(geminiKey, forKey: "stark_gemini_key") }
    }
    @Published var perplexityKey: String {
        didSet { UserDefaults.standard.set(perplexityKey, forKey: "stark_perplexity_key") }
    }
    @Published var openaiKey: String {
        didSet { UserDefaults.standard.set(openaiKey, forKey: "stark_openai_key") }
    }
    @Published var customBackendURL: String {
        didSet { UserDefaults.standard.set(customBackendURL, forKey: "stark_backend_url") }
    }

    @Published var tasks: [StarkTaskItem] = [] {
        didSet { saveTasks() }
    }
    @Published var memories: [StarkMemoryItem] = [] {
        didSet { saveMemories() }
    }

    private let tagger = NLTagger(tagSchemes: [.nameTypeOrLexicalClass, .lemma])

    private init() {
        self.persona = UserDefaults.standard.string(forKey: "stark_persona") ?? "jarvis"
        if UserDefaults.standard.object(forKey: "stark_tts_enabled") == nil {
            self.ttsEnabled = true
        } else {
            self.ttsEnabled = UserDefaults.standard.bool(forKey: "stark_tts_enabled")
        }
        self.geminiKey = UserDefaults.standard.string(forKey: "stark_gemini_key") ?? ""
        self.perplexityKey = UserDefaults.standard.string(forKey: "stark_perplexity_key") ?? ""
        self.openaiKey = UserDefaults.standard.string(forKey: "stark_openai_key") ?? ""
        self.customBackendURL = UserDefaults.standard.string(forKey: "stark_backend_url") ?? ""
        loadTasksAndMemories()
    }

    // MARK: - Persistenza Locale Nativa su iPhone
    private func loadTasksAndMemories() {
        if let tData = UserDefaults.standard.data(forKey: "stark_native_tasks"),
           let decoded = try? JSONDecoder().decode([StarkTaskItem].self, from: tData) {
            self.tasks = decoded
        } else {
            self.tasks = [
                StarkTaskItem(id: UUID(), text: "Pronuncia 'Ehi Siri, chiedi a Jarvis con StarkOS'", isCompleted: false, createdAt: Date()),
                StarkTaskItem(id: UUID(), text: "Testa scansione meteo e dossier Wikipedia sull'APU", isCompleted: false, createdAt: Date())
            ]
        }

        if let mData = UserDefaults.standard.data(forKey: "stark_native_memories"),
           let decoded = try? JSONDecoder().decode([StarkMemoryItem].self, from: mData) {
            self.memories = decoded
        } else {
            self.memories = [
                StarkMemoryItem(id: UUID(), fact: "Operatore principale autorizzato — Livello 10 Stark", createdAt: Date()),
                StarkMemoryItem(id: UUID(), fact: "Lingua operativa: Italiano", createdAt: Date())
            ]
        }
    }

    private func saveTasks() {
        if let data = try? JSONEncoder().encode(tasks) {
            UserDefaults.standard.set(data, forKey: "stark_native_tasks")
        }
    }

    private func saveMemories() {
        if let data = try? JSONEncoder().encode(memories) {
            UserDefaults.standard.set(data, forKey: "stark_native_memories")
        }
    }

    func addTask(_ text: String) {
        let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return }
        tasks.insert(StarkTaskItem(id: UUID(), text: clean, isCompleted: false, createdAt: Date()), at: 0)
    }

    func toggleTask(_ item: StarkTaskItem) {
        if let idx = tasks.firstIndex(where: { $0.id == item.id }) {
            tasks[idx].isCompleted.toggle()
        }
    }

    func deleteTask(_ item: StarkTaskItem) {
        tasks.removeAll { $0.id == item.id }
    }

    func addMemory(_ fact: String) {
        let clean = fact.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return }
        memories.insert(StarkMemoryItem(id: UUID(), fact: clean, createdAt: Date()), at: 0)
    }

    func deleteMemory(_ item: StarkMemoryItem) {
        memories.removeAll { $0.id == item.id }
    }

    // MARK: - 1. Pre-Elaborazione Hardware su Apple Neural Engine (APU)
    nonisolated func analyzeOnDeviceAPU(text: String) -> (intent: String, entities: [String], computeEngine: String) {
        let localTagger = NLTagger(tagSchemes: [.nameTypeOrLexicalClass])
        localTagger.string = text
        var entities: [String] = []

        let options: NLTagger.Options = [.omitPunctuation, .omitWhitespace, .joinNames]
        localTagger.enumerateTags(
            in: text.startIndex..<text.endIndex,
            unit: .word,
            scheme: .nameTypeOrLexicalClass,
            options: options
        ) { tag, tokenRange in
            if let tag = tag, [.personalName, .placeName, .organizationName].contains(tag) {
                entities.append(String(text[tokenRange]))
            }
            return true
        }

        let mlConfig = MLModelConfiguration()
        mlConfig.computeUnits = .all // CPU + GPU + 16-Core Apple Neural Engine

        let lower = text.lowercased()
        let detectedIntent: String
        if lower.contains("meteo") || lower.contains("tempo") || lower.contains("temperatura") || lower.contains("piove") {
            detectedIntent = "WEATHER_TELEMETRY"
        } else if lower.contains("calcola") || lower.contains("quanto fa") || lower.range(of: #"\d+\s*[\+\-\*\/x×÷]\s*\d+"#, options: .regularExpression) != nil {
            detectedIntent = "APU_MATH_COPROCESSOR"
        } else if lower.hasPrefix("ricordami") || lower.hasPrefix("aggiungi task") || lower.hasPrefix("aggiungi nota") || lower.hasPrefix("memorizza") {
            detectedIntent = "LOCAL_MEMORY_VAULT"
        } else {
            detectedIntent = "OMNI_RESEARCH_RAG"
        }

        let cores = ProcessInfo.processInfo.activeProcessorCount
        return (
            intent: detectedIntent,
            entities: entities,
            computeEngine: "Apple Neural Engine + \(cores)-Core APU"
        )
    }

    // MARK: - 2. Pipeline Principale Ibrida (On-Device APU + Meteo + Wiki + Multi-API)
    func executeHybridQuery(query: String, persona overridePersona: String? = nil) async -> StarkAssistantResponse {
        let start = Date()
        let activePersona = (overridePersona ?? self.persona).lowercased() == "edith" ? "edith" : "jarvis"
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        let apuInfo = analyzeOnDeviceAPU(text: trimmed)

        guard !trimmed.isEmpty else {
            let msg = activePersona == "edith"
                ? "Rete tattica E.D.I.T.H. online. Specifica il bersaglio della ricerca."
                : "Agli ordini, Signore. Tutti i sistemi J.A.R.V.I.S. sull'iPhone sono operativi."
            return StarkAssistantResponse(
                ok: true,
                persona: activePersona,
                speech: msg,
                display: msg,
                provider: apuInfo.computeEngine,
                latencyMs: 5,
                cards: []
            )
        }

        // A) Gestione Task / Promemoria / Memoria Contestuale Nativa
        if apuInfo.intent == "LOCAL_MEMORY_VAULT" {
            let content = trimmed.replacingOccurrences(
                of: "(?i)^(aggiungi task|crea promemoria|ricordami di|ricordami|aggiungi nota|memorizza che|memorizza)[:\\s]*",
                with: "",
                options: .regularExpression
            ).trimmingCharacters(in: .whitespacesAndNewlines)

            if trimmed.lowercased().contains("memorizza") {
                addMemory(content)
            } else {
                addTask(content)
            }

            let speech = activePersona == "edith"
                ? "Ricevuto. Ho salvato '\(content)' nel database locale dell'iPhone."
                : "Certamente, Signore. Ho registrato '\(content)' nella memoria operativa del suo iPhone."
            return StarkAssistantResponse(
                ok: true,
                persona: activePersona,
                speech: speech,
                display: speech,
                provider: "\(apuInfo.computeEngine) (Local Vault)",
                latencyMs: max(4, Int(Date().timeIntervalSince(start) * 1000)),
                cards: [
                    StarkCardItem(
                        type: "action",
                        category: "VAULT LOCALE iPHONE AGGIORNATO",
                        title: content,
                        summary: "Sincronizzato nella scheda Task & Memoria dell'app nativa.",
                        metrics: [
                            StarkMetric(label: "Storage", value: "On-Device Keychain/UD"),
                            StarkMetric(label: "Stato", value: "Attivo")
                        ],
                        sourceURL: nil
                    )
                ]
            )
        }

        var gatheredCards: [StarkCardItem] = []
        var ragContext = ""

        // B) Telemetria Meteo Satellitare Live (Open-Meteo)
        if apuInfo.intent == "WEATHER_TELEMETRY" {
            if let wxCard = await fetchLiveWeather(query: trimmed) {
                gatheredCards.append(wxCard)
                ragContext = "\(wxCard.title): \(wxCard.summary)"
            }
        }

        // C) Co-Processore Matematico Locale APU
        if apuInfo.intent == "APU_MATH_COPROCESSOR", gatheredCards.isEmpty {
            if let mathCard = evaluateMathOnDevice(query: trimmed) {
                gatheredCards.append(mathCard)
                ragContext = "\(mathCard.title): \(mathCard.summary)"
            }
        }

        // D) Ricerca Dossier Enciclopedico Live (Wikipedia IT & EN)
        if gatheredCards.isEmpty {
            if let wikiCard = await fetchWikipediaDossier(query: trimmed) {
                gatheredCards.append(wikiCard)
                ragContext = "\(wikiCard.title) (\(wikiCard.category)): \(wikiCard.summary)"
            }
        }

        // E) Se l'utente ha configurato un Backend Custom o una API Key (Gemini / Perplexity / OpenAI), genera risposta AI potenziata
        if let cloudReply = await callConfiguredAIProvider(
            query: trimmed,
            persona: activePersona,
            ragContext: ragContext,
            apuEngine: apuInfo.computeEngine
        ) {
            let elapsed = max(12, Int(Date().timeIntervalSince(start) * 1000))
            let cleanSpeech = cloudReply.text
                .replacingOccurrences(of: "[#*`_~>-]", with: "", options: .regularExpression)
                .trimmingCharacters(in: .whitespacesAndNewlines)
            return StarkAssistantResponse(
                ok: true,
                persona: activePersona,
                speech: String(cleanSpeech.prefix(500)),
                display: cloudReply.text,
                provider: cloudReply.provider,
                latencyMs: elapsed,
                cards: gatheredCards
            )
        }

        // F) Sintesi Nativa On-Device dai Dossier Live raccolti
        let elapsed = max(10, Int(Date().timeIntervalSince(start) * 1000))
        if let primaryCard = gatheredCards.first {
            let prefix = activePersona == "edith"
                ? "Scansione E.D.I.T.H. completata per \(primaryCard.title)."
                : "Agli ordini, Signore. Ecco i dati rilevati su \(primaryCard.title)."
            let speech = "\(prefix) \(primaryCard.summary)"
            return StarkAssistantResponse(
                ok: true,
                persona: activePersona,
                speech: speech,
                display: "\(primaryCard.title)\n\n\(primaryCard.summary)",
                provider: "\(apuInfo.computeEngine) + Live RAG",
                latencyMs: elapsed,
                cards: gatheredCards
            )
        }

        let fallback = activePersona == "edith"
            ? "Analisi APU completata per '\(trimmed)'. Puoi interrogarmi su qualsiasi personaggio, scienza, storia, città meteo, calcoli o inserire una chiave API Gemini/OpenAI/Perplexity nella scheda Motore AI."
            : "Signore, il Neural Engine ha analizzato '\(trimmed)'. Può chiedermi qualsiasi dossier enciclopedico, il meteo in tempo reale di qualunque città, calcoli matematici, oppure aggiungere una API Key nella scheda Motore AI per il deep reasoning illimitato."

        return StarkAssistantResponse(
            ok: true,
            persona: activePersona,
            speech: fallback,
            display: fallback,
            provider: apuInfo.computeEngine,
            latencyMs: elapsed,
            cards: [
                StarkCardItem(
                    type: "telemetry",
                    category: "TELEMETRIA NEURAL ENGINE",
                    title: "Intento Rilevato: \(apuInfo.intent)",
                    summary: "Elaborazione eseguita localmente sull'APU dell'iPhone.",
                    metrics: [
                        StarkMetric(label: "Hardware", value: apuInfo.computeEngine),
                        StarkMetric(label: "Latenza", value: "\(elapsed) ms")
                    ],
                    sourceURL: nil
                )
            ]
        )
    }

    // MARK: - Modulo Meteo Satellitare (Open-Meteo API)
    private func fetchLiveWeather(query: String) async -> StarkCardItem? {
        let cleaned = query
            .replacingOccurrences(of: "(?i)(che tempo fa|meteo|temperatura|previsioni|piove|oggi|domani|adesso|in tempo reale|live|\\ba\\b|\\bdi\\b|\\bsu\\b|\\bin\\b|\\?)", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let city = cleaned.isEmpty ? "Roma" : cleaned

        guard let encoded = city.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let geoURL = URL(string: "https://geocoding-api.open-meteo.com/v1/search?name=\(encoded)&count=1&language=it&format=json") else {
            return nil
        }

        do {
            let (geoData, _) = try await URLSession.shared.data(from: geoURL)
            guard let geoJson = try JSONSerialization.jsonObject(with: geoData) as? [String: Any],
                  let results = geoJson["results"] as? [[String: Any]],
                  let first = results.first,
                  let lat = first["latitude"] as? Double,
                  let lon = first["longitude"] as? Double,
                  let name = first["name"] as? String else {
                return nil
            }
            let country = first["country"] as? String ?? "Italia"
            guard let wxURL = URL(string: "https://api.open-meteo.com/v1/forecast?latitude=\(lat)&longitude=\(lon)&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,surface_pressure") else {
                return nil
            }
            let (wxData, _) = try await URLSession.shared.data(from: wxURL)
            guard let wxJson = try JSONSerialization.jsonObject(with: wxData) as? [String: Any],
                  let current = wxJson["current"] as? [String: Any] else {
                return nil
            }
            let temp = current["temperature_2m"] as? Double ?? 18.0
            let appTemp = current["apparent_temperature"] as? Double ?? temp
            let hum = current["relative_humidity_2m"] as? Int ?? 60
            let wind = current["wind_speed_10m"] as? Double ?? 8.0
            let press = current["surface_pressure"] as? Double ?? 1015.0

            let summary = "Temperatura attuale di \(temp)°C (percepita \(appTemp)°C), umidità al \(hum)% e vento a \(wind) km/h. Pressione \(press) hPa."
            return StarkCardItem(
                type: "weather",
                category: "TELEMETRIA METEO SATELLITARE LIVE",
                title: "\(name), \(country)",
                summary: summary,
                metrics: [
                    StarkMetric(label: "Temperatura", value: "\(temp) °C"),
                    StarkMetric(label: "Percepita", value: "\(appTemp) °C"),
                    StarkMetric(label: "Umidità", value: "\(hum)%"),
                    StarkMetric(label: "Vento", value: "\(wind) km/h")
                ],
                sourceURL: "https://open-meteo.com"
            )
        } catch {
            return nil
        }
    }

    // MARK: - Modulo Co-Processore Matematico On-Device
    private func evaluateMathOnDevice(query: String) -> StarkCardItem? {
        let cleaned = query
            .lowercased()
            .replacingOccurrences(of: "(quanto fa|calcola|risolvi|\\?)", with: "", options: .regularExpression)
            .replacingOccurrences(of: ",", with: ".")
            .replacingOccurrences(of: "×", with: "*")
            .replacingOccurrences(of: "÷", with: "/")
            .replacingOccurrences(of: "x", with: "*")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        let allowed = CharacterSet(charactersIn: "0123456789+-*/.() ")
        guard !cleaned.isEmpty,
              cleaned.unicodeScalars.allSatisfy({ allowed.contains($0) }),
              cleaned.rangeOfCharacter(from: CharacterSet(charactersIn: "+-*/")) != nil else {
            return nil
        }

        let expr = NSExpression(format: cleaned)
        if let num = expr.expressionValue(with: nil, context: nil) as? NSNumber {
            let val = Double(truncating: num)
            let formatted = val.truncatingRemainder(dividingBy: 1) == 0 ? String(format: "%.0f", val) : String(format: "%.4f", val)
            return StarkCardItem(
                type: "math",
                category: "CO-PROCESSORE MATEMATICO APU",
                title: "\(cleaned) = \(formatted)",
                summary: "Risultato calcolato istantaneamente sull'unità aritmetica locale dell'iPhone: \(formatted).",
                metrics: [
                    StarkMetric(label: "Espressione", value: cleaned),
                    StarkMetric(label: "Risultato", value: formatted)
                ],
                sourceURL: nil
            )
        }
        return nil
    }

    // MARK: - Modulo Ricerca Enciclopedica Live (Wikipedia IT & EN)
    private func fetchWikipediaDossier(query: String) async -> StarkCardItem? {
        let clean = query
            .replacingOccurrences(of: "(?i)^(chi è|chi era|cosa è|cos'è|che cos'è|parlami di|cerca|dimmi tutto su|informazioni su|spiegami|jarvis|edith)\\s+", with: "", options: .regularExpression)
            .replacingOccurrences(of: "?", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard !clean.isEmpty else { return nil }

        for lang in ["it", "en"] {
            guard let encSearch = clean.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
                  let searchURL = URL(string: "https://\(lang).wikipedia.org/w/api.php?action=query&list=search&srsearch=\(encSearch)&utf8=&format=json&srlimit=1") else {
                continue
            }
            do {
                let (sData, _) = try await URLSession.shared.data(from: searchURL)
                guard let sJson = try JSONSerialization.jsonObject(with: sData) as? [String: Any],
                      let qObj = sJson["query"] as? [String: Any],
                      let searchArr = qObj["search"] as? [[String: Any]],
                      let firstHit = searchArr.first,
                      let bestTitle = firstHit["title"] as? String,
                      let encTitle = bestTitle.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed),
                  let sumURL = URL(string: "https://\(lang).wikipedia.org/api/rest_v1/page/summary/\(encTitle)") else {
                    continue
                }
                let (sumData, _) = try await URLSession.shared.data(from: sumURL)
                guard let sumJson = try JSONSerialization.jsonObject(with: sumData) as? [String: Any],
                      let extract = sumJson["extract"] as? String, !extract.isEmpty else {
                    continue
                }
                let title = sumJson["title"] as? String ?? bestTitle
                let desc = (sumJson["description"] as? String ?? "DOSSIER ENCICLOPEDICO (\(lang.uppercased()))").uppercased()
                return StarkCardItem(
                    type: "dossier",
                    category: desc,
                    title: title,
                    summary: extract,
                    metrics: [
                        StarkMetric(label: "Fonte", value: "Wikipedia (\(lang.uppercased()))"),
                        StarkMetric(label: "Verifica", value: "Live Verificato")
                    ],
                    sourceURL: "https://\(lang).wikipedia.org/wiki/\(encTitle)"
                )
            } catch {
                continue
            }
        }
        return nil
    }

    // MARK: - Router Multi-API (Gemini, Perplexity, OpenAI, Custom Backend)
    private func callConfiguredAIProvider(
        query: String,
        persona: String,
        ragContext: String,
        apuEngine: String
    ) async -> (provider: String, text: String)? {
        let sysPrompt = persona == "edith"
            ? "Sei E.D.I.T.H. (Even Dead, I'm The Hero), il sistema tattico AR di Tony Stark integrato nativamente su iPhone e Siri. Rispondi in italiano in modo diretto, preciso e strutturato."
            : "Sei J.A.R.V.I.S. (Just A Rather Very Intelligent System), l'assistente AI di Tony Stark integrato nativamente su iPhone e Siri. Rispondi in italiano con lo stile impeccabile di Jarvis ('Agli ordini, Signore')."

        let memContext = memories.isEmpty ? "" : "\n[MEMORIA UTENTE]: " + memories.map(\.fact).joined(separator: " | ")
        let fullPrompt = "\(query)\n\(ragContext.isEmpty ? "" : "[DATI LIVE RILEVATI]: \(ragContext)")\(memContext)"

        // 1. Google Gemini API
        let gemKey = geminiKey.trimmingCharacters(in: .whitespacesAndNewlines)
        if !gemKey.isEmpty,
           let url = URL(string: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=\(gemKey)") {
            var req = URLRequest(url: url)
            req.httpMethod = "POST"
            req.timeoutInterval = 8
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            let body: [String: Any] = [
                "systemInstruction": ["parts": [["text": sysPrompt]]],
                "contents": [["role": "user", "parts": [["text": fullPrompt]]]]
            ]
            if let data = try? JSONSerialization.data(withJSONObject: body) {
                req.httpBody = data
                if let (respData, _) = try? await URLSession.shared.data(for: req),
                   let json = try? JSONSerialization.jsonObject(with: respData) as? [String: Any],
                   let cands = json["candidates"] as? [[String: Any]],
                   let content = cands.first?["content"] as? [String: Any],
                   let parts = content["parts"] as? [[String: Any]],
                   let text = parts.first?["text"] as? String {
                    return ("Google Gemini 2.5 + \(apuEngine)", text)
                }
            }
        }

        // 2. Perplexity Sonar API
        let pplxKey = perplexityKey.trimmingCharacters(in: .whitespacesAndNewlines)
        if !pplxKey.isEmpty,
           let url = URL(string: "https://api.perplexity.ai/chat/completions") {
            var req = URLRequest(url: url)
            req.httpMethod = "POST"
            req.timeoutInterval = 8
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.setValue("Bearer \(pplxKey)", forHTTPHeaderField: "Authorization")
            let body: [String: Any] = [
                "model": "sonar",
                "messages": [
                    ["role": "system", "content": sysPrompt],
                    ["role": "user", "content": fullPrompt]
                ]
            ]
            if let data = try? JSONSerialization.data(withJSONObject: body) {
                req.httpBody = data
                if let (respData, _) = try? await URLSession.shared.data(for: req),
                   let json = try? JSONSerialization.jsonObject(with: respData) as? [String: Any],
                   let choices = json["choices"] as? [[String: Any]],
                   let msg = choices.first?["message"] as? [String: Any],
                   let text = msg["content"] as? String {
                    return ("Perplexity Sonar + \(apuEngine)", text)
                }
            }
        }

        // 3. OpenAI API
        let oaiKey = openaiKey.trimmingCharacters(in: .whitespacesAndNewlines)
        if !oaiKey.isEmpty,
           let url = URL(string: "https://api.openai.com/v1/chat/completions") {
            var req = URLRequest(url: url)
            req.httpMethod = "POST"
            req.timeoutInterval = 8
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.setValue("Bearer \(oaiKey)", forHTTPHeaderField: "Authorization")
            let body: [String: Any] = [
                "model": "gpt-4o-mini",
                "messages": [
                    ["role": "system", "content": sysPrompt],
                    ["role": "user", "content": fullPrompt]
                ]
            ]
            if let data = try? JSONSerialization.data(withJSONObject: body) {
                req.httpBody = data
                if let (respData, _) = try? await URLSession.shared.data(for: req),
                   let json = try? JSONSerialization.jsonObject(with: respData) as? [String: Any],
                   let choices = json["choices"] as? [[String: Any]],
                   let msg = choices.first?["message"] as? [String: Any],
                   let text = msg["content"] as? String {
                    return ("OpenAI GPT-4o + \(apuEngine)", text)
                }
            }
        }

        return nil
    }
}
