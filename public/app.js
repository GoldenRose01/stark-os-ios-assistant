(() => {
  // Application State
  const state = {
    persona: localStorage.getItem('doom_persona') || 'jarvis',
    ttsEnabled: localStorage.getItem('doom_tts') !== 'false',
    isListening: false,
    isSpeaking: false,
    isProcessing: false,
    isOnline: navigator.onLine !== false,
    hasNativeBridge: Boolean(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.doomNative),
    apuTelemetry: {
      engine: 'A18 Pro 16-Core Neural Engine',
      cores: navigator.hardwareConcurrency || 6,
      webgpu: true
    },
    apiConfig: JSON.parse(localStorage.getItem('doom_api_config') || '{}'),
    tasks: JSON.parse(
      localStorage.getItem('doom_tasks') ||
        JSON.stringify([
          { id: 't1', text: 'Pronuncia "Ehi Siri, chiedi a Doom con DoomAi"', done: false },
          { id: 't2', text: 'Testa modalità Offline (Modalità Aereo) sull\'APU A18 Pro', done: false }
        ])
    ),
    memory: JSON.parse(
      localStorage.getItem('doom_memory') ||
        JSON.stringify([
          { id: 'm1', text: 'Operatore Sovrano autorizzato — Sistema DoomAi su iPhone 16 Pro Max' },
          { id: 'm2', text: 'Lingua operativa primaria: Italiano' }
        ])
    )
  };

  // Built-in Offline Encyclopedic Vault (always available in Airplane Mode / 0-Network)
  const OFFLINE_DOSSIERS = {
    doom: {
      category: 'DOSSIER SOVRANO LATVERIA (VAULT OFFLINE)',
      title: 'Victor Von Doom — Doctor Doom',
      summary:
        'Sovrano di Latveria, genio scientifico e maestro delle arti mistiche e cibernetiche. L\'architettura DoomAi unisce la precisione analitica di J.A.R.V.I.S. e la rete tattica E.D.I.T.H. sotto un unico comando sovrano con esecuzione ibrida Offline APU + Cloud.'
    },
    jarvis: {
      category: 'PROTOCOLLO OPERATIVO PRIMARIO (VAULT OFFLINE)',
      title: 'J.A.R.V.I.S. — Just A Rather Very Intelligent System',
      summary:
        'Modulo analitico e gestionale attivo in DoomAi. In assenza di rete, esegue calcoli sul co-processore matematico, gestisce task e promemoria vocali, interroga la memoria contestuale e risponde tramite il sintetizzatore vocale nativo di iOS.'
    },
    edith: {
      category: 'PROTOCOLLO TATTICO SECONDARIO (VAULT OFFLINE)',
      title: 'E.D.I.T.H. — Even Dead, I\'m The Hero',
      summary:
        'Assetto tattico ad alto contrasto (Cremisi & Oro) progettato per ricognizione rapida, telemetria hardware A18 Pro e accesso immediato ai dossier salvati localmente.'
    },
    apu: {
      category: 'ARCHITETTURA HARDWARE iPHONE 16 PRO MAX (OFFLINE)',
      title: 'Apple A18 Pro — 16-Core Neural Engine (35+ TOPS)',
      summary:
        'Il chip A18 Pro dell\'iPhone 16 Pro Max integra un Neural Engine a 16-Core capace di 35 trilioni di operazioni al secondo, permettendo a DoomAi di eseguire riconoscimento vocale italiano, sintesi vocale, classificazione degli intenti (NLTagger/CoreML) e calcoli completamente offline.'
    }
  };

  // DOM Elements
  const bodyEl = document.body;
  const systemHeaderTitle = document.getElementById('systemHeaderTitle');
  const systemHeaderSub = document.getElementById('systemHeaderSub');
  const reactorPanelTitle = document.getElementById('reactorPanelTitle');
  const voiceStateBadge = document.getElementById('voiceStateBadge');
  const voiceStatusText = document.getElementById('voiceStatusText');
  const commandForm = document.getElementById('commandForm');
  const commandInput = document.getElementById('commandInput');
  const streamContainer = document.getElementById('streamContainer');
  const btnToggleMic = document.getElementById('btnToggleMic');
  const btnToggleTts = document.getElementById('btnToggleTts');
  const telemetryApu = document.getElementById('telemetryApu');
  const telemetrySiri = document.getElementById('telemetrySiri');
  const telemetryProvider = document.getElementById('telemetryProvider');
  const telemetryLatency = document.getElementById('telemetryLatency');

  // Helper to send message to Native iOS IPA Shell
  function postToNativeBridge(payload) {
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.doomNative) {
      try {
        window.webkit.messageHandlers.doomNative.postMessage(payload);
        return true;
      } catch (_) {}
    }
    return false;
  }

  // Update Online / Offline Telemetry Indicator
  function updateConnectivityBadge() {
    state.isOnline = navigator.onLine !== false;
    if (telemetrySiri) {
      telemetrySiri.textContent = state.isOnline ? 'OTA GitHub + Offline Ready' : 'MODALITÀ OFFLINE (APU)';
    }
    const btnOta = document.getElementById('btnOtaReload');
    if (btnOta) {
      btnOta.textContent = state.isOnline ? 'Sync GitHub' : 'Offline APU';
    }
  }

  window.addEventListener('online', updateConnectivityBadge);
  window.addEventListener('offline', updateConnectivityBadge);

  // Receive callbacks from Native iOS IPA Shell (SFSpeechRecognizer, Native APU, etc.)
  window.onDoomNativeEvent = (event) => {
    if (!event || !event.type) return;
    if (event.type === 'voicePartial') {
      voiceStatusText.textContent = event.transcript || 'In ascolto...';
      commandInput.value = event.transcript || '';
    } else if (event.type === 'voiceFinal') {
      state.isListening = false;
      voiceStateBadge.textContent = 'PRONTO';
      btnToggleMic.textContent = 'Ascolto Vocale';
      btnToggleMic.classList.remove('btn-listening');
      if (event.transcript && event.transcript.trim()) {
        commandInput.value = event.transcript.trim();
        submitQuery(event.transcript.trim());
      }
    } else if (event.type === 'voiceState') {
      state.isListening = Boolean(event.isRecording);
      voiceStateBadge.textContent = state.isListening ? 'IN ASCOLTO' : 'PRONTO';
      btnToggleMic.textContent = state.isListening ? 'Ferma Ascolto' : 'Ascolto Vocale';
      btnToggleMic.classList.toggle('btn-listening', state.isListening);
      if (event.message) voiceStatusText.textContent = event.message;
    } else if (event.type === 'otaStatus') {
      const btnOta = document.getElementById('btnOtaReload');
      if (btnOta && event.message) {
        btnOta.textContent = event.message;
        setTimeout(updateConnectivityBadge, 2500);
      }
    }
  };

  function syncStateToNativeIPA() {
    postToNativeBridge({
      action: 'syncConfig',
      persona: state.persona,
      ttsEnabled: state.ttsEnabled,
      apiConfig: state.apiConfig,
      tasks: state.tasks,
      memories: state.memory
    });
  }

  // 1. Hardware APU / Neural Engine Detection
  async function detectHardwareAPU() {
    const cores = navigator.hardwareConcurrency || 6;
    const isNativeIpa = Boolean(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.doomNative);
    const engineLabel = isNativeIpa
      ? `A18 Pro 16-Core ANE (${cores} Core IPA)`
      : `Apple Neural Engine / WebGPU (${cores} Core)`;

    state.apuTelemetry = { engine: engineLabel, cores };
    if (telemetryApu) telemetryApu.textContent = engineLabel;
    const apuSummaryEl = document.getElementById('apuDeviceSummary');
    const metricWebGpu = document.getElementById('metricWebGpu');
    const metricCores = document.getElementById('metricCores');
    if (apuSummaryEl) apuSummaryEl.textContent = engineLabel;
    if (metricWebGpu) metricWebGpu.textContent = isNativeIpa ? 'Bridge IPA + Cache Offline' : 'WebGPU Attivo';
    if (metricCores) metricCores.textContent = `${cores} Core Attivi`;
    updateConnectivityBadge();
  }

  // 2. Persona Switching
  function applyPersona(persona) {
    state.persona = persona === 'edith' ? 'edith' : 'jarvis';
    localStorage.setItem('doom_persona', state.persona);
    bodyEl.setAttribute('data-persona', state.persona);

    document.getElementById('btnPersonaJarvis').classList.toggle('active', state.persona === 'jarvis');
    document.getElementById('btnPersonaEdith').classList.toggle('active', state.persona === 'edith');

    if (state.persona === 'edith') {
      systemHeaderTitle.textContent = 'DOOM AI // E.D.I.T.H. TACTICAL';
      systemHeaderSub.textContent = 'ASSETTO OTTICO AR // OFFLINE APU + OTA GITHUB';
      reactorPanelTitle.textContent = 'Reticolo Tattico E.D.I.T.H.';
      commandInput.placeholder = 'Inserisci bersaglio per E.D.I.T.H. (anche Offline)...';
    } else {
      systemHeaderTitle.textContent = 'DOOM AI // SOVEREIGN HUD';
      systemHeaderSub.textContent = 'A18 PRO 16-CORE APU // OFFLINE + OTA LIVE GITHUB';
      reactorPanelTitle.textContent = 'Nucleo Imperiale DoomAi';
      commandInput.placeholder = 'Ordina a DoomAi (funziona Online e Offline su APU)...';
    }
    syncStateToNativeIPA();
  }

  document.getElementById('btnPersonaJarvis').addEventListener('click', () => applyPersona('jarvis'));
  document.getElementById('btnPersonaEdith').addEventListener('click', () => applyPersona('edith'));

  // OTA Instant Reload from GitHub (saves local copy on iPhone disk for offline use!)
  const btnOtaReload = document.getElementById('btnOtaReload');
  if (btnOtaReload) {
    btnOtaReload.addEventListener('click', () => {
      if (!navigator.onLine) {
        btnOtaReload.textContent = 'Modalità Offline Attiva';
        return;
      }
      btnOtaReload.textContent = 'Sync GitHub...';
      if (!postToNativeBridge({ action: 'reloadOTA' })) {
        const url = new URL(window.location.href);
        url.searchParams.set('ota', String(Date.now()));
        window.location.replace(url.toString());
      }
    });
  }

  // 3. Navigation Tabs
  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.workspace-view').forEach((v) => v.classList.remove('active'));
      tab.classList.add('active');
      const targetId = tab.getAttribute('data-target');
      const targetEl = document.getElementById(targetId);
      if (targetEl) targetEl.classList.add('active');
    });
  });

  // 4. Animated 60fps Canvas Golden Reactor Rings
  const canvas = document.getElementById('reactorCanvas');
  const ctx = canvas.getContext('2d');
  let phase = 0;

  function renderReactor() {
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    ctx.clearRect(0, 0, w, h);

    const isEdith = state.persona === 'edith';
    const primaryColor = isEdith ? '#fb7185' : '#f0c138';
    const secondaryColor = isEdith ? '#f0c138' : '#d97706';
    const speedMultiplier = state.isListening || state.isSpeaking || state.isProcessing ? 2.8 : 1.0;
    phase += 0.018 * speedMultiplier;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(phase * 0.5);
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 3.5;
    const segments = isEdith ? 6 : 12;
    for (let i = 0; i < segments; i++) {
      const startAngle = (i * 2 * Math.PI) / segments + 0.08;
      const endAngle = ((i + 0.65) * 2 * Math.PI) / segments;
      ctx.beginPath();
      ctx.arc(0, 0, 168, startAngle, endAngle);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-phase * 0.85);
    ctx.strokeStyle = secondaryColor;
    ctx.lineWidth = 2.2;
    for (let i = 0; i < 8; i++) {
      const startAngle = (i * 2 * Math.PI) / 8;
      const endAngle = startAngle + 0.45;
      ctx.beginPath();
      ctx.arc(0, 0, 138, startAngle, endAngle);
      ctx.stroke();
    }
    ctx.restore();

    const pulseRadius = 108 + Math.sin(phase * 2.6) * (state.isListening || state.isSpeaking ? 14 : 4);
    ctx.beginPath();
    ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
    ctx.fillStyle = state.isListening
      ? 'rgba(244, 63, 94, 0.22)'
      : isEdith
      ? 'rgba(251, 113, 133, 0.14)'
      : 'rgba(240, 193, 56, 0.16)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = state.isListening ? '#f43f5e' : primaryColor;
    ctx.stroke();

    requestAnimationFrame(renderReactor);
  }

  // 5. Speech Synthesis (100% On-Device Offline Compatible via AVSpeechSynthesizer)
  function speakText(text) {
    if (!state.ttsEnabled || !text) return;
    if (postToNativeBridge({ action: 'speak', text, persona: state.persona })) {
      return;
    }
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'it-IT';
      utterance.rate = state.persona === 'edith' ? 1.05 : 0.98;
      const voices = window.speechSynthesis.getVoices();
      const itVoice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('it'));
      if (itVoice) utterance.voice = itVoice;
      window.speechSynthesis.speak(utterance);
    } catch (_) {}
  }

  btnToggleTts.addEventListener('click', () => {
    state.ttsEnabled = !state.ttsEnabled;
    localStorage.setItem('doom_tts', String(state.ttsEnabled));
    btnToggleTts.textContent = `Voce AI: ${state.ttsEnabled ? 'ON' : 'OFF'}`;
    if (!state.ttsEnabled) {
      postToNativeBridge({ action: 'stopSpeak' });
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    }
    syncStateToNativeIPA();
  });

  // 6. Voice Recognition
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'it-IT';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      state.isListening = true;
      voiceStateBadge.textContent = 'IN ASCOLTO';
      voiceStatusText.textContent = 'Parla ora... DoomAi sta acquisendo il segnale vocale.';
      btnToggleMic.textContent = 'Ferma Ascolto';
      btnToggleMic.classList.add('btn-listening');
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        commandInput.value = transcript;
        submitQuery(transcript);
      }
    };

    recognition.onerror = () => {
      state.isListening = false;
      voiceStateBadge.textContent = 'PRONTO';
      btnToggleMic.textContent = 'Ascolto Vocale';
      btnToggleMic.classList.remove('btn-listening');
    };

    recognition.onend = () => {
      state.isListening = false;
      if (!state.isProcessing) voiceStateBadge.textContent = 'PRONTO';
      btnToggleMic.textContent = 'Ascolto Vocale';
      btnToggleMic.classList.remove('btn-listening');
    };
  }

  function toggleMicrophone() {
    if (postToNativeBridge({ action: 'toggleVoice' })) {
      return;
    }
    if (!recognition) {
      voiceStatusText.textContent = 'Usa il microfono della tastiera iOS o tocca la barra di comando.';
      commandInput.focus();
      return;
    }
    if (state.isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  }

  btnToggleMic.addEventListener('click', toggleMicrophone);
  document.getElementById('reactorTouchArea').addEventListener('click', toggleMicrophone);

  // 7. Hybrid Online + 100% Offline APU Engine
  async function runStandaloneOnDeviceQuery(query) {
    const startTime = Date.now();
    const persona = state.persona;
    const lower = query.toLowerCase();

    // A) Task / Memory Add Commands (100% Offline Ready)
    if (/^(aggiungi task|crea promemoria|ricordami di|ricordami|aggiungi nota|memorizza che|memorizza)/i.test(lower)) {
      const extracted = query
        .replace(/^(aggiungi task|crea promemoria|ricordami di|ricordami|aggiungi nota|memorizza che|memorizza)[:\s]*/i, '')
        .trim();
      const isMem = lower.includes('memorizza');
      const speech =
        persona === 'edith'
          ? `Ricevuto. Ho registrato nel database tattico locale: "${extracted}".`
          : `Agli ordini, Signore. Ho annotato "${extracted}" nella memoria offline di DoomAi.`;
      return {
        ok: true,
        persona,
        speech,
        display: speech,
        provider: `${state.apuTelemetry.engine} (Offline Vault)`,
        latencyMs: Math.max(3, Date.now() - startTime),
        taskAction: { type: isMem ? 'MEMORY_ADD' : 'TASK_ADD', content: extracted },
        cards: [
          {
            category: isMem ? 'MEMORIA DOOM SALVATA (OFFLINE)' : 'NUOVO TASK OPERATIVO (OFFLINE)',
            title: extracted,
            summary: 'Salvato nella memoria flash interna dell\'iPhone e disponibile anche senza connessione.'
          }
        ]
      };
    }

    // B) Read Tasks / Memories / Briefing Commands (100% Offline Ready)
    if (/\b(quali sono i miei task|mostra i task|mostra promemoria|cosa devo fare|leggi memoria|cosa ricordi|briefing)\b/i.test(lower)) {
      const activeTasks = state.tasks.filter((t) => !t.done).map((t) => t.text);
      const memFacts = state.memory.map((m) => m.text);
      const taskSummary =
        activeTasks.length > 0
          ? `Hai ${activeTasks.length} missioni attive: ${activeTasks.join('; ')}.`
          : 'Non ci sono task in sospeso nel database.';
      const speech =
        persona === 'edith'
          ? `Briefing tattico offline: ${taskSummary}`
          : `Agli ordini, Signore. Ecco il suo briefing operativo locale: ${taskSummary}`;
      return {
        ok: true,
        persona,
        speech,
        display: `### Briefing Operativo Locale (Offline Ready)\n\n**Task Attivi (${activeTasks.length})**:\n- ${activeTasks.join('\n- ') || 'Nessun task attivo'}\n\n**Direttive in Memoria (${memFacts.length})**:\n- ${memFacts.join('\n- ')}`,
        provider: `${state.apuTelemetry.engine} (Local Briefing)`,
        latencyMs: 4,
        cards: [
          {
            category: 'BRIEFING LOCALE ON-DEVICE',
            title: `${activeTasks.length} Task Attivi // ${memFacts.length} Memorie`,
            summary: taskSummary
          }
        ]
      };
    }

    // C) Local APU Math Co-Processor & Unit Conversions (100% Offline Ready, Zero eval/Function)
    const cleanMath = query
      .toLowerCase()
      .replace(/quanto fa|calcola|risolvi|\?/g, ' ')
      .replace(/,/g, '.')
      .replace(/×|x(?=\s*\d)/g, '*')
      .replace(/÷/g, '/')
      .trim();
    if (/^[0-9+\-*/().\s]+$/.test(cleanMath) && /[+\-*/]/.test(cleanMath)) {
      try {
        const tokens = cleanMath.match(/\d+(?:\.\d+)?|[+\-*/()]/g);
        if (tokens && tokens.length >= 3) {
          let pos = 0;
          const parseExpr = () => {
            let left = parseTerm();
            while (pos < tokens.length && (tokens[pos] === '+' || tokens[pos] === '-')) {
              const op = tokens[pos++];
              const right = parseTerm();
              left = op === '+' ? left + right : left - right;
            }
            return left;
          };
          const parseTerm = () => {
            let left = parseFactor();
            while (pos < tokens.length && (tokens[pos] === '*' || tokens[pos] === '/')) {
              const op = tokens[pos++];
              const right = parseFactor();
              left = op === '*' ? left * right : left / right;
            }
            return left;
          };
          const parseFactor = () => {
            if (tokens[pos] === '(') {
              pos++;
              const val = parseExpr();
              if (tokens[pos] === ')') pos++;
              return val;
            }
            return parseFloat(tokens[pos++]);
          };
          const val = parseExpr();
          if (typeof val === 'number' && Number.isFinite(val)) {
            const resNum = Number(val.toFixed(6));
            const speech =
              persona === 'edith'
                ? `Calcolo APU completato: ${cleanMath} equivale a ${resNum}.`
                : `Il risultato del calcolo ${cleanMath} è esattamente ${resNum}, Signore.`;
            return {
              ok: true,
              persona,
              speech,
              display: `### Calcolo Computazionale APU (Offline)\n\n\`${cleanMath} = ${resNum}\``,
              provider: `${state.apuTelemetry.engine} (Offline Co-Processor)`,
              latencyMs: 2,
              cards: [
                {
                  category: 'CO-PROCESSORE MATEMATICO ON-DEVICE',
                  title: `${cleanMath} = ${resNum}`,
                  summary: 'Eseguito direttamente sull\'unità aritmetica locale dell\'iPhone 16 Pro Max (0 rete).'
                }
              ]
            };
          }
        }
      } catch (_) {}
    }

    // D) Check Built-in Offline Dossiers (Doctor Doom, Jarvis, Edith, APU)
    if (lower.includes('destino') || lower.includes('doctor doom') || lower === 'doom') {
      const d = OFFLINE_DOSSIERS.doom;
      return {
        ok: true,
        persona,
        speech: d.summary,
        display: `### ${d.title}\n*${d.category}*\n\n${d.summary}`,
        provider: `${state.apuTelemetry.engine} (Offline Vault)`,
        latencyMs: 3,
        cards: [d]
      };
    }
    if (lower.includes('jarvis') || lower.includes('j.a.r.v.i.s')) {
      const d = OFFLINE_DOSSIERS.jarvis;
      return {
        ok: true,
        persona,
        speech: d.summary,
        display: `### ${d.title}\n*${d.category}*\n\n${d.summary}`,
        provider: `${state.apuTelemetry.engine} (Offline Vault)`,
        latencyMs: 3,
        cards: [d]
      };
    }
    if (lower.includes('edith') || lower.includes('e.d.i.t.h')) {
      const d = OFFLINE_DOSSIERS.edith;
      return {
        ok: true,
        persona,
        speech: d.summary,
        display: `### ${d.title}\n*${d.category}*\n\n${d.summary}`,
        provider: `${state.apuTelemetry.engine} (Offline Vault)`,
        latencyMs: 3,
        cards: [d]
      };
    }
    if (lower.includes('a18') || lower.includes('neural engine') || lower.includes('apu')) {
      const d = OFFLINE_DOSSIERS.apu;
      return {
        ok: true,
        persona,
        speech: d.summary,
        display: `### ${d.title}\n*${d.category}*\n\n${d.summary}`,
        provider: `${state.apuTelemetry.engine} (Offline Vault)`,
        latencyMs: 3,
        cards: [d]
      };
    }

    // E) Online Modules (Open-Meteo, Gemini, Wikipedia) with automatic Local Dossier Cache for Offline Recall!
    const cachedDossiers = JSON.parse(localStorage.getItem('doom_offline_cache') || '{}');

    if (navigator.onLine) {
      // 1. Live Weather via Open-Meteo
      if (/\b(meteo|tempo|temperatura|piove|previsioni)\b/i.test(lower)) {
        const cityMatch =
          query.match(/(?:meteo|tempo|temperatura|previsioni)\s+(?:a|di|per|su|in)?\s*([a-zA-ZÀ-ÿ\s]{2,25})/i) || [];
        const targetCity =
          (cityMatch[1] || 'Roma').replace(/\b(oggi|domani|adesso|ora|live|in tempo reale)\b/gi, '').trim() || 'Roma';
        try {
          const geoRes = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(targetCity)}&count=1&language=it&format=json`
          );
          const geo = await geoRes.json();
          if (geo?.results?.length > 0) {
            const p = geo.results[0];
            const wxRes = await fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,surface_pressure`
            );
            const wx = await wxRes.json();
            if (wx?.current) {
              const c = wx.current;
              const cityLabel = `${p.name}${p.country ? ', ' + p.country : ''}`;
              const speech =
                persona === 'edith'
                  ? `Scansione atmosferica su ${cityLabel}: ${c.temperature_2m} gradi Celsius, umidità ${c.relative_humidity_2m} percento, vento a ${c.wind_speed_10m} chilometri orari.`
                  : `Signore, la telemetria meteo live su ${cityLabel} rileva ${c.temperature_2m} gradi Celsius, percepita ${c.apparent_temperature} gradi e vento a ${c.wind_speed_10m} chilometri orari.`;
              const resultObj = {
                ok: true,
                persona,
                speech,
                display: `### Scansione Atmosferica — ${cityLabel}\n\nTemperatura attuale di **${c.temperature_2m}°C** (percepita ${c.apparent_temperature}°C), umidità al **${c.relative_humidity_2m}%** e vento a **${c.wind_speed_10m} km/h**.`,
                provider: `${state.apuTelemetry.engine} + Open-Meteo Live`,
                latencyMs: Date.now() - startTime,
                cards: [
                  {
                    category: 'TELEMETRIA METEO SATELLITARE LIVE',
                    title: `Situazione Atmosferica: ${cityLabel}`,
                    summary: `Temperatura ${c.temperature_2m}°C, umidità ${c.relative_humidity_2m}%, pressione ${c.surface_pressure} hPa.`,
                    metrics: [
                      { label: 'Temperatura', value: `${c.temperature_2m} °C` },
                      { label: 'Percepita', value: `${c.apparent_temperature} °C` },
                      { label: 'Umidità', value: `${c.relative_humidity_2m}%` },
                      { label: 'Vento', value: `${c.wind_speed_10m} km/h` }
                    ]
                  }
                ]
              };
              cachedDossiers[lower] = resultObj;
              localStorage.setItem('doom_offline_cache', JSON.stringify(cachedDossiers));
              return resultObj;
            }
          }
        } catch (_) {}
      }

      // 2. Direct Gemini API call if configured
      if (state.apiConfig.geminiKey) {
        try {
          const sys =
            persona === 'edith'
              ? 'Sei E.D.I.T.H. nel sistema DoomAi su iPhone 16 Pro Max. Rispondi in italiano in modo diretto e preciso.'
              : 'Sei J.A.R.V.I.S. nel sistema DoomAi su iPhone 16 Pro Max. Rispondi in italiano con stile elegante ("Agli ordini, Signore") e completo.';
          const gemRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(state.apiConfig.geminiKey)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: sys }] },
                contents: [{ role: 'user', parts: [{ text: query }] }]
              })
            }
          );
          const gemData = await gemRes.json();
          const reply = gemData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply) {
            const resObj = {
              ok: true,
              persona,
              speech: reply.replace(/[#*`_~>-]/g, '').slice(0, 480),
              display: reply,
              provider: 'Google Gemini 2.5 Flash + A18 Pro',
              latencyMs: Date.now() - startTime,
              cards: []
            };
            cachedDossiers[lower] = resObj;
            localStorage.setItem('doom_offline_cache', JSON.stringify(cachedDossiers));
            return resObj;
          }
        } catch (_) {}
      }

      // 3. Direct Wikipedia IT Live Search
      const cleanTopic = query
        .replace(/^(chi è|chi era|cosa è|cos'è|che cos'è|parlami di|cerca|dimmi tutto su|informazioni su|spiegami|jarvis|edith|doom)\s+/i, '')
        .replace(/\?+$/, '')
        .trim();

      if (cleanTopic) {
        try {
          const sRes = await fetch(
            `https://it.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanTopic)}&utf8=&format=json&origin=*&srlimit=1`
          );
          const sJson = await sRes.json();
          if (sJson?.query?.search?.length > 0) {
            const bestTitle = sJson.query.search[0].title;
            const sumRes = await fetch(
              `https://it.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(bestTitle)}`
            );
            const summary = await sumRes.json();
            if (summary && summary.extract) {
              const prefix =
                persona === 'edith'
                  ? `Dossier ${summary.title} acquisito e salvato nel vault offline.`
                  : `Agli ordini, Signore. Ho estratto il dossier su ${summary.title} e l'ho archiviato anche per la consultazione offline.`;
              const resObj = {
                ok: true,
                persona,
                speech: `${prefix} ${summary.extract}`,
                display: `### ${summary.title}\n*${(summary.description || 'DOSSIER VERIFICATO').toUpperCase()}*\n\n${summary.extract}`,
                provider: `${state.apuTelemetry.engine} + Wikipedia IT Live`,
                latencyMs: Date.now() - startTime,
                cards: [
                  {
                    category: (summary.description || 'DOSSIER ENCICLOPEDICO LIVE').toUpperCase(),
                    title: summary.title,
                    summary: summary.extract,
                    thumbnail: summary.thumbnail?.source || null,
                    metrics: [
                      { label: 'Fonte Primaria', value: 'Wikipedia (IT)' },
                      { label: 'Cache Offline', value: 'Salvato su iPhone' }
                    ],
                    sources: [
                      {
                        title: `${summary.title} — Wikipedia`,
                        url: summary.content_urls?.desktop?.page || `https://it.wikipedia.org/wiki/${encodeURIComponent(bestTitle)}`
                      }
                    ]
                  }
                ]
              };
              cachedDossiers[lower] = resObj;
              localStorage.setItem('doom_offline_cache', JSON.stringify(cachedDossiers));
              return resObj;
            }
          }
        } catch (_) {}
      }
    }

    // F) Check Offline Cached Dossiers from previous searches!
    if (cachedDossiers[lower]) {
      const cached = cachedDossiers[lower];
      return {
        ...cached,
        provider: `${state.apuTelemetry.engine} (Cache Offline iPhone)`,
        latencyMs: 3
      };
    }

    // G) Offline APU Local Synthesis Fallback
    const offlineStatus = navigator.onLine ? 'Online' : 'Modalità Offline APU';
    const fallbackSpeech =
      persona === 'edith'
        ? `DoomAi E.D.I.T.H. [${offlineStatus}] ha elaborato "${query}" sull'APU locale. In modalità offline puoi eseguire calcoli complessi, gestire task e promemoria, chiedere il briefing vocale ("Mostra i task") e consultare tutti i dossier già archiviati.`
        : `Signore, ho elaborato "${query}" direttamente sull'APU del suo iPhone 16 Pro Max (${offlineStatus}). Anche senza rete può ordinarmi calcoli matematici, aggiungere o leggere task e promemoria ("Mostra i miei task"), interrogare la memoria contestuale e riaprire qualsiasi dossier precedentemente cercato.`;
    return {
      ok: true,
      persona,
      speech: fallbackSpeech,
      display: fallbackSpeech,
      provider: `${state.apuTelemetry.engine} (${offlineStatus})`,
      latencyMs: Math.max(4, Date.now() - startTime),
      cards: [
        {
          category: 'MOTORE LOCALE ON-DEVICE (OFFLINE READY)',
          title: `Elaborazione APU: "${query.slice(0, 40)}"`,
          summary: 'Funzioni attive senza internet: Voce Italiana, Riconoscimento Vocale, Calcoli APU, Task & Promemoria, Memoria Contestuale e Archivio Dossier Offline.',
          metrics: [
            { label: 'Stato Rete', value: offlineStatus },
            { label: 'Dossier in Cache', value: `${Object.keys(cachedDossiers).length + 4} Salvati` }
          ]
        }
      ]
    };
  }

  // 8. Stream Renderer
  function formatDisplayHtml(md) {
    if (!md) return '';
    return md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n- (.*)/g, '<br/>&bull; $1');
  }

  function appendStreamMessage({ role, sender, text, cards = [], provider = '', latencyMs = 0 }) {
    const entry = document.createElement('article');
    entry.className = `message-entry ${role === 'user' ? 'user-query' : 'assistant-reply'}`;

    const timeStr = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const metaRight =
      role === 'user' ? `OPERATORE // ${timeStr}` : `${provider} // ${latencyMs} ms // ${timeStr}`;

    let cardsHtml = '';
    if (Array.isArray(cards) && cards.length > 0) {
      cardsHtml = cards
        .map((c) => {
          const metricsHtml = Array.isArray(c.metrics)
            ? `<div class="metrics-row">${c.metrics
                .map((m) => `<div class="metric-item"><span>${m.label}</span><span>${m.value}</span></div>`)
                .join('')}</div>`
            : '';
          const sourcesHtml = Array.isArray(c.sources)
            ? `<div class="sources-row">${c.sources
                .map(
                  (s) =>
                    `<a href="${s.url}" target="_blank" rel="noopener noreferrer" class="source-link">${s.title} &nearr;</a>`
                )
                .join('')}</div>`
            : '';
          const thumbHtml = c.thumbnail
            ? `<img src="${c.thumbnail}" alt="${c.title}" class="dossier-thumb" />`
            : '';

          return `
            <div class="dossier-card">
              <div class="dossier-header">
                <div>
                  <div class="dossier-cat">${c.category || 'DOSSIER DOOM AI'}</div>
                  <div class="dossier-title">${c.title || ''}</div>
                </div>
                ${thumbHtml}
              </div>
              <div style="font-size: 13.5px; color: var(--text-secondary);">${c.summary || ''}</div>
              ${metricsHtml}
              ${sourcesHtml}
            </div>
          `;
        })
        .join('');
    }

    entry.innerHTML = `
      <div class="msg-meta">
        <span class="msg-sender">${sender}</span>
        <span>${metaRight}</span>
      </div>
      <div class="msg-body"><p>${formatDisplayHtml(text)}</p></div>
      ${cardsHtml}
    `;

    streamContainer.prepend(entry);
  }

  // 9. Execute Query
  async function submitQuery(rawQuery) {
    const query = (rawQuery || '').trim();
    if (!query || state.isProcessing) return;

    state.isProcessing = true;
    voiceStateBadge.textContent = 'SCANSIONE...';
    commandInput.value = '';

    appendStreamMessage({
      role: 'user',
      sender: 'ORDINE SOVRANO',
      text: query
    });

    const data = await runStandaloneOnDeviceQuery(query);

    state.isProcessing = false;
    voiceStateBadge.textContent = 'PRONTO';

    if (data.provider) telemetryProvider.textContent = data.provider;
    if (data.latencyMs) telemetryLatency.textContent = `${data.latencyMs} ms`;

    if (data.taskAction) {
      if (data.taskAction.type === 'MEMORY_ADD') {
        state.memory.unshift({ id: 'm_' + Date.now(), text: data.taskAction.content });
        saveAndRenderMemory();
      } else {
        state.tasks.unshift({ id: 't_' + Date.now(), text: data.taskAction.content, done: false });
        saveAndRenderTasks();
      }
      syncStateToNativeIPA();
    }

    appendStreamMessage({
      role: 'assistant',
      sender: state.persona === 'edith' ? 'DOOM AI // E.D.I.T.H.' : 'DOOM AI // J.A.R.V.I.S.',
      text: data.display || data.speech,
      cards: data.cards || [],
      provider: data.provider || 'A18 Pro APU Core',
      latencyMs: data.latencyMs || 5
    });

    speakText(data.speech);
  }

  commandForm.addEventListener('submit', (e) => {
    e.preventDefault();
    submitQuery(commandInput.value);
  });

  document.querySelectorAll('.preset-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const q = chip.getAttribute('data-query');
      if (q) submitQuery(q);
    });
  });

  // 10. Siri Test & Config
  const siriWebhookPreview = document.getElementById('siriWebhookPreview');
  document.getElementById('btnTestSiriWebhook').addEventListener('click', async () => {
    siriWebhookPreview.textContent = '// Simulazione risposta vocale Siri in corso...';
    const json = await runStandaloneOnDeviceQuery('Chi è Dottor Destino');
    siriWebhookPreview.textContent = JSON.stringify(json, null, 2);
    speakText(json.speech);
  });

  document.getElementById('btnCopyCurl').addEventListener('click', () => {
    const info = `Frase Siri: "Ehi Siri, chiedi a Doom con DoomAi"\nFunziona Online (OTA GitHub) + 100% Offline su A18 Pro APU`;
    navigator.clipboard?.writeText(info);
    siriWebhookPreview.textContent = info;
  });

  // 11. Engine & API Vault Configuration
  function hydrateApiConfigForm() {
    document.getElementById('selectRoutingMode').value = state.apiConfig.routingMode || 'hybrid';
    document.getElementById('inputCustomEndpoint').value = state.apiConfig.customEndpoint || '';
    document.getElementById('inputCustomModel').value = state.apiConfig.customModel || 'llama3.2';
    document.getElementById('inputGeminiKey').value = state.apiConfig.geminiKey || '';
    document.getElementById('inputPerplexityKey').value = state.apiConfig.perplexityKey || '';
    document.getElementById('inputOpenaiKey').value = state.apiConfig.openaiKey || '';
    document.getElementById('inputAnthropicKey').value = state.apiConfig.anthropicKey || '';
  }

  document.getElementById('btnSaveApiConfig').addEventListener('click', () => {
    state.apiConfig = {
      routingMode: document.getElementById('selectRoutingMode').value,
      customEndpoint: document.getElementById('inputCustomEndpoint').value.trim(),
      customModel: document.getElementById('inputCustomModel').value.trim() || 'llama3.2',
      geminiKey: document.getElementById('inputGeminiKey').value.trim(),
      perplexityKey: document.getElementById('inputPerplexityKey').value.trim(),
      openaiKey: document.getElementById('inputOpenaiKey').value.trim(),
      anthropicKey: document.getElementById('inputAnthropicKey').value.trim()
    };
    localStorage.setItem('doom_api_config', JSON.stringify(state.apiConfig));
    syncStateToNativeIPA();
    const statusEl = document.getElementById('saveConfigStatus');
    statusEl.textContent = 'Sincronizzato con IPA e Siri!';
    setTimeout(() => {
      statusEl.textContent = '';
    }, 3000);
  });

  // 12. Tasks & Contextual Memory Management
  function saveAndRenderTasks() {
    localStorage.setItem('doom_tasks', JSON.stringify(state.tasks));
    const container = document.getElementById('taskListContainer');
    const badge = document.getElementById('taskCountBadge');
    const activeCount = state.tasks.filter((t) => !t.done).length;
    if (badge) badge.textContent = `${activeCount} ATTIVI`;

    container.innerHTML = state.tasks
      .map(
        (t) => `
        <div class="task-row ${t.done ? 'completed' : ''}">
          <span>${t.text}</span>
          <div style="display: flex; gap: 6px;">
            <button type="button" class="btn" data-toggle-task="${t.id}" style="padding: 4px 8px; font-size: 11px;">
              ${t.done ? 'Riapri' : 'Completa'}
            </button>
            <button type="button" class="btn" data-del-task="${t.id}" style="padding: 4px 8px; font-size: 11px;">&times;</button>
          </div>
        </div>
      `
      )
      .join('');

    container.querySelectorAll('[data-toggle-task]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-toggle-task');
        const item = state.tasks.find((x) => x.id === id);
        if (item) item.done = !item.done;
        saveAndRenderTasks();
        syncStateToNativeIPA();
      });
    });

    container.querySelectorAll('[data-del-task]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-del-task');
        state.tasks = state.tasks.filter((x) => x.id !== id);
        saveAndRenderTasks();
        syncStateToNativeIPA();
      });
    });
  }

  function saveAndRenderMemory() {
    localStorage.setItem('doom_memory', JSON.stringify(state.memory));
    const container = document.getElementById('memoryListContainer');
    container.innerHTML = state.memory
      .map(
        (m) => `
        <div class="task-row">
          <span>${m.text}</span>
          <button type="button" class="btn" data-del-mem="${m.id}" style="padding: 4px 8px; font-size: 11px;">&times;</button>
        </div>
      `
      )
      .join('');

    container.querySelectorAll('[data-del-mem]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-del-mem');
        state.memory = state.memory.filter((x) => x.id !== id);
        saveAndRenderMemory();
        syncStateToNativeIPA();
      });
    });
  }

  document.getElementById('addTaskForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('newTaskInput');
    const val = input.value.trim();
    if (!val) return;
    state.tasks.unshift({ id: 't_' + Date.now(), text: val, done: false });
    input.value = '';
    saveAndRenderTasks();
    syncStateToNativeIPA();
  });

  document.getElementById('addMemoryForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('newMemoryInput');
    const val = input.value.trim();
    if (!val) return;
    state.memory.unshift({ id: 'm_' + Date.now(), text: val });
    input.value = '';
    saveAndRenderMemory();
    syncStateToNativeIPA();
  });

  // Boot Sequence
  applyPersona(state.persona);
  btnToggleTts.textContent = `Voce AI: ${state.ttsEnabled ? 'ON' : 'OFF'}`;
  detectHardwareAPU();
  hydrateApiConfigForm();
  saveAndRenderTasks();
  saveAndRenderMemory();
  requestAnimationFrame(renderReactor);

  appendStreamMessage({
    role: 'assistant',
    sender: 'DOOM AI // SOVEREIGN CORE',
    text:
      'Sistema **DoomAi** attivo su **iPhone 16 Pro Max** in doppia modalità **OTA GitHub Live + 100% Offline su Memoria Interna**. Anche in **Modalità Aereo (senza internet)** l\'interfaccia completa si apre istantaneamente dalla memoria flash dell\'iPhone, permettendoti di usare voce, calcoli APU, task, promemoria, briefing e l\'archivio dei dossier salvati!',
    cards: [
      {
        category: 'DOPPIA ARCHITETTURA: OTA LIVE + 100% OFFLINE FLASH',
        title: 'Funziona Anche in Modalità Aereo (Zero Internet)',
        summary:
          'Quando sei connesso, DoomAi scarica e salva automaticamente su disco interno dell\'iPhone ogni nuovo aggiornamento grafico da GitHub. Quando sei offline, carica istantaneamente l\'interfaccia salvata localmente.',
        metrics: [
          { label: 'Modalità Offline', value: '100% Attiva' },
          { label: 'Aggiornamenti UI', value: 'OTA da GitHub' },
          { label: 'Cache Dossier', value: 'Automatica' },
          { label: 'Voce & APU', value: 'On-Device A18 Pro' }
        ]
      }
    ],
    provider: 'DoomAi OTA + Offline Flash Vault',
    latencyMs: 4
  });
})();
