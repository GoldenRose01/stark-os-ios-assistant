# STARK OS — J.A.R.V.I.S. & E.D.I.T.H. AI Assistant (iOS Siri + APU + Windows Cloud Build)

Assistente AI All-in-One ispirato a **J.A.R.V.I.S.** ed **E.D.I.T.H.**, progettato per **iOS (Siri Shortcuts & AppIntents)** con pre-elaborazione sull'**APU / Apple Neural Engine (CoreML + NLTagger)**, ricerca live (**Wikipedia IT/EN**, **Open-Meteo**, **Co-Processore Matematico**) e router **Multi-API** (Backend Custom / Ollama, Gemini, Perplexity, OpenAI, Claude).

---

## Come installare l'App Nativa iOS (`.ipa`) su iPhone usando SOLO un PC Windows (Zero-Mac)

Poiché hai un **PC Windows** e un **iPhone**, questo repository include un workflow automatico **GitHub Actions (`.github/workflows/build-ios-ipa.yml`)** che usa un Mac virtuale nel cloud di GitHub per compilare il codice Swift 6 (`ios-native/`) e generare il file installabile **`StarkOS-iOS.ipa`**.

### Passo 1 — Scarica `StarkOS-iOS.ipa` da GitHub Actions
1. Apri questo repository su GitHub e clicca sulla scheda **Actions** in alto.
2. Seleziona il workflow **Build Native iOS App (.ipa) for Windows Sideload** (parte in automatico ad ogni push oppure cliccando su **Run workflow**).
3. Al termine della compilazione (circa 1–2 minuti), scorri in basso nella sezione **Artifacts** e clicca su **`StarkOS-iOS-IPA`** per scaricare il file `.zip` contenente **`StarkOS-iOS.ipa`** sul tuo PC Windows.

### Passo 2 — Installa `StarkOS-iOS.ipa` su iPhone da Windows con Sideloadly (Gratuito)
1. Sul tuo PC Windows, assicurati di avere installato **iTunes** e **iCloud** (versioni ufficiali Apple non-Microsoft Store) e scarica **[Sideloadly](https://sideloadly.io/)** (oppure **AltStore / SideStore**).
2. Collega il tuo **iPhone** al PC Windows tramite cavo USB e seleziona *"Autorizza questo computer"* sullo schermo dell'iPhone.
3. Apri **Sideloadly** su Windows:
   - Trascina il file **`StarkOS-iOS.ipa`** nel riquadro IPA di Sideloadly.
   - Inserisci il tuo normale indirizzo **Apple ID** (funziona con qualsiasi Apple ID gratuito, non serve l'abbonamento sviluppatore da 99€).
   - Clicca su **Start**: Sideloadly firmerà l'app col tuo certificato gratuito e la installerà direttamente sulla Home del tuo iPhone!
4. **Abilita la Modalità Sviluppatore / Autorizza il profilo su iPhone**:
   - Su iPhone vai in **Impostazioni → Generale → Gestione VPN e dispositivi** → tocca il tuo Apple ID e premi **Autorizza**.
   - Se usi iOS 16/17/18+, vai in **Impostazioni → Privacy e sicurezza → Modalità sviluppatore** e attivala.

### Passo 3 — Usa *"Ehi Siri, chiedi a Jarvis"* sul tuo iPhone
1. Apri l'app **STARK AI** appena installata sull'iPhone: al primo avvio `StarkShortcutsProvider` registra automaticamente i comandi vocali nel sistema iOS.
2. Ora puoi dire in qualsiasi momento:
   - ***"Ehi Siri, chiedi a Jarvis con StarkOS"***
   - ***"Ehi Siri, protocollo Edith su StarkOS"***
3. L'app funziona **anche senza server esterno** (in modalità Standalone direttamente sull'APU dell'iPhone + ricerca diretta Wikipedia IT), oppure collegata al server `server.js` sul tuo PC Windows!

---

## (Opzionale) Avviare anche il Backend Custom + Web App HUD sul tuo PC Windows

Se vuoi usare anche il backend completo con **Open-Meteo live**, **Multi-API Router** e la **Web App HUD** tramite il Wi-Fi di casa:

1. Sul tuo PC Windows apri **PowerShell** o **Prompt dei comandi** nella cartella del progetto:
   ```powershell
   node server.js
   ```
2. Scopri l'indirizzo IP Wi-Fi del tuo PC Windows scrivendo:
   ```powershell
   ipconfig
   ```
   *(Cerca `Indirizzo IPv4`, ad esempio `192.168.1.50`)*.
3. Dal tuo **iPhone** (collegato allo stesso Wi-Fi):
   - Apri Safari su `http://192.168.1.50:3000` per usare la Web App HUD completa.
   - Oppure imposta `http://192.168.1.50:3000/api/siri` come URL del backend nell'app o in **Comandi Rapidi (Shortcuts)**.
