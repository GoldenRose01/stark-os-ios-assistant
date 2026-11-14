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
      cores: navigator.hardwareConcurrency || 6
    },
    apiConfig: JSON.parse(localStorage.getItem('doom_api_config') || '{}'),
    tasks: JSON.parse(
      localStorage.getItem('doom_tasks') ||
        JSON.stringify([
          { id: 't1', text: 'Configura API ChatGPT o API Gemini nella scheda Motore & APU', done: false },
          { id: 't2', text: 'Attiva il Comando Rapido Siri "Chiedi a Doom" nella scheda Siri & OTA', done: false }
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
        'Sovrano di Latveria, genio scientifico e maestro delle arti cibernetiche. L\'architettura DoomAi unisce la precisione analitica di J.A.R.V.I.S. e la rete satellitare E.D.I.T.H. sotto un unico comando neurale con esecuzione ibrida ChatGPT + Gemini + Offline APU.'
    },
    jarvis: {
      category: 'PROTOCOLLO OPERATIVO PRIMARIO (VAULT OFFLINE)',
      title: 'J.A.R.V.I.S. — Just A Rather Very Intelligent System',
      summary:
        'Modulo analitico e gestionale attivo in DoomAi. Esegue calcoli sul co-processore matematico, gestisce task e promemoria vocali, interroga ChatGPT/Gemini e risponde tramite il sintetizzatore vocale nativo di iOS.'
    },
    edith: {
      category: 'PROTOCOLLO SATELLITARE SECONDARIO (VAULT OFFLINE)',
      title: 'E.D.I.T.H. — Even Dead, I\'m The Hero',
      summary:
        'Rete satellitare ad alto contrasto (Cremisi & Oro) progettata per ricognizione rapida, telemetria neurale A18 Pro e accesso immediato ai dossier salvati localmente.'
    },
    apu: {
      category: 'ARCHITETTURA HARDWARE iPHONE 16 PRO MAX (OFFLINE)',
      title: 'Apple A18 Pro — 16-Core Neural Engine (35+ TOPS)',
      summary:
        'Il chip A18 Pro dell\'iPhone 16 Pro Max integra un Neural Engine a 16-Core capace di 35 trilioni di operazioni al secondo, permettendo a DoomAi di eseguire riconoscimento vocale italiano, sintesi vocale e calcoli completamente offline.'
    }
  };

  // DOM Elements
  const bodyEl = document.body;
  const systemHeaderTitle = document.getElementById('systemHeaderTitle');
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

  // Dynamic Viewport Calibration Engine (Adapts top-center Head & Satellite Grid to any iPhone screen)
  function calibrateDynamicViewport() {
    const vv = window.visualViewport;
    const vw = Math.round(vv ? vv.width : window.innerWidth || document.documentElement.clientWidth || 430);
    const vh = Math.round(vv ? vv.height : window.innerHeight || document.documentElement.clientHeight || 932);
    const reactorPx = Math.max(196, Math.min(256, Math.round(vw * 0.56)));
    const maskPx = Math.round(reactorPx * 0.42);

    const root = document.documentElement;
    root.style.setProperty('--vw-px', `${vw}px`);
    root.style.setProperty('--vh-px', `${vh}px`);
    root.style.setProperty('--reactor-size', `${reactorPx}px`);
    root.style.setProperty('--mask-size', `${maskPx}px`);

    if (window.scrollX !== 0) {
      window.scrollTo(0, window.scrollY);
    }
  }

  window.addEventListener('resize', calibrateDynamicViewport);
  window.addEventListener('orientationchange', () => setTimeout(calibrateDynamicViewport, 120));
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', calibrateDynamicViewport);
  }
  calibrateDynamicViewport();

  // Update Online / Offline Telemetry Indicator
  function updateConnectivityBadge() {
    state.isOnline = navigator.onLine !== false;
    if (telemetrySiri) {
      telemetrySiri.textContent = state.isOnline ? 'OTA v4.2 // LIVE' : 'OFFLINE APU';
    }
    const btnOta = document.getElementById('btnOtaReload');
    if (btnOta) {
      btnOta.textContent = state.isOnline ? 'Sync GitHub' : 'Offline';
    }
  }

  window.addEventListener('online', updateConnectivityBadge);
  window.addEventListener('offline', updateConnectivityBadge);

  // Receive callbacks from Native iOS IPA Shell (SFSpeechRecognizer, Siri URL Scheme doomai://, OTA Sync)
  window.onDoomNativeEvent = (event) => {
    if (!event || !event.type) return;
    if (event.type === 'voicePartial') {
      voiceStatusText.textContent = event.transcript || 'Acquisizione neurale in corso...';
      commandInput.value = event.transcript || '';
    } else if (event.type === 'voiceFinal') {
      state.isListening = false;
      voiceStateBadge.textContent = 'NEURAL GRID ATTIVA';
      btnToggleMic.textContent = 'Ascolto Vocale';
      btnToggleMic.classList.remove('btn-listening');
      if (event.transcript && event.transcript.trim()) {
        commandInput.value = event.transcript.trim();
        submitQuery(event.transcript.trim());
      }
    } else if (event.type === 'voiceState') {
      state.isListening = Boolean(event.isRecording);
      voiceStateBadge.textContent = state.isListening ? 'ASCOLTO SATELLITARE' : 'NEURAL GRID ATTIVA';
      btnToggleMic.textContent = state.isListening ? 'Ferma' : 'Ascolto Vocale';
      btnToggleMic.classList.toggle('btn-listening', state.isListening);
      if (event.message) voiceStatusText.textContent = event.message;
    } else if (event.type === 'otaStatus') {
      const btnOta = document.getElementById('btnOtaReload');
      if (btnOta && event.message) {
        btnOta.textContent = event.message;
        setTimeout(updateConnectivityBadge, 2800);
      }
    } else if (event.type === 'siriUrlQuery') {
      // Triggered when iOS opens doomai://ask?q=... or doomai://voice from Siri Shortcuts!
      document.querySelectorAll('.nav-tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.workspace-view').forEach((v) => v.classList.remove('active'));
      document.getElementById('tab-hud')?.classList.add('active');
      document.getElementById('view-hud')?.classList.add('active');

      if (event.mode === 'voice') {
        setTimeout(() => toggleMicrophone(), 250);
      } else if (event.query && event.query.trim()) {
        commandInput.value = event.query.trim();
        submitQuery(event.query.trim());
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
  function detectHardwareAPU() {
    const cores = navigator.hardwareConcurrency || 6;
    const isNativeIpa = Boolean(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.doomNative);
    const engineLabel = isNativeIpa ? `A18 Pro ANE (${cores} Core)` : `Neural Engine (${cores} Core)`;

    state.apuTelemetry = { engine: engineLabel, cores };
    if (telemetryApu) telemetryApu.textContent = engineLabel;
    const apuSummaryEl = document.getElementById('apuDeviceSummary');
    const metricWebGpu = document.getElementById('metricWebGpu');
    const metricCores = document.getElementById('metricCores');
    if (apuSummaryEl) apuSummaryEl.textContent = `Apple ${engineLabel}`;
    if (metricWebGpu) metricWebGpu.textContent = isNativeIpa ? 'Connesso (IPA v4)' : 'Browser Mode';
    if (metricCores) metricCores.textContent = `${cores} Core Attivi`;
    updateApiStatusBadges();
    updateConnectivityBadge();
  }

  function updateApiStatusBadges() {
    const hasOpenai = Boolean(state.apiConfig.openaiKey && state.apiConfig.openaiKey.trim());
    const hasGemini = Boolean(state.apiConfig.geminiKey && state.apiConfig.geminiKey.trim());
    const elOpenai = document.getElementById('metricChatGptState');
    const elGemini = document.getElementById('metricGeminiState');
    if (elOpenai) elOpenai.textContent = hasOpenai ? 'Attiva (OpenAI)' : 'Non inserita';
    if (elGemini) elGemini.textContent = hasGemini ? 'Attiva (Gemini)' : 'Non inserita';

    if (telemetryProvider) {
      if (hasOpenai && hasGemini) telemetryProvider.textContent = 'ChatGPT + Gemini';
      else if (hasOpenai) telemetryProvider.textContent = 'API ChatGPT';
      else if (hasGemini) telemetryProvider.textContent = 'API Gemini';
      else telemetryProvider.textContent = 'APU + Live RAG';
    }
  }

  // 2. Persona Switching
  function applyPersona(persona) {
    state.persona = persona === 'edith' ? 'edith' : 'jarvis';
    localStorage.setItem('doom_persona', state.persona);
    bodyEl.setAttribute('data-persona', state.persona);

    document.getElementById('btnPersonaJarvis').classList.toggle('active', state.persona === 'jarvis');
    document.getElementById('btnPersonaEdith').classList.toggle('active', state.persona === 'edith');

    if (state.persona === 'edith') {
      systemHeaderTitle.textContent = 'DOOM AI // E.D.I.T.H. SATELLITE NET';
      commandInput.placeholder = 'Ordina alla rete satellitare E.D.I.T.H. (ChatGPT, Gemini, APU)...';
    } else {
      systemHeaderTitle.textContent = 'DOOM AI // NEURAL SOVEREIGN';
      commandInput.placeholder = 'Ordina a DoomAi (ChatGPT, Gemini, Meteo, Dossier, Calcoli)...';
    }
    syncStateToNativeIPA();
  }

  document.getElementById('btnPersonaJarvis').addEventListener('click', () => applyPersona('jarvis'));
  document.getElementById('btnPersonaEdith').addEventListener('click', () => applyPersona('edith'));

  // OTA Instant Reload from GitHub (bypasses cache & updates local iPhone flash storage)
  const btnOtaReload = document.getElementById('btnOtaReload');
  if (btnOtaReload) {
    btnOtaReload.addEventListener('click', () => {
      if (!navigator.onLine) {
        btnOtaReload.textContent = 'Offline';
        return;
      }
      btnOtaReload.textContent = 'Sync...';
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

  // 4. TOP-CENTER CIRCULAR NEURAL SATELLITE GRID ANIMATION (60fps Canvas around Doctor Doom Head)
  const canvas = document.getElementById('reactorCanvas');
  const ctx = canvas.getContext('2d');
  let phase = 0;

  // Create 16 Orbital Neural Satellites across 3 concentric rings around the Head
  const neuralSatellites = Array.from({ length: 16 }, (_, idx) => {
    const ringIndex = idx % 3; // 0 = inner, 1 = mid, 2 = outer
    const baseRadius = ringIndex === 0 ? 142 : ringIndex === 1 ? 186 : 228;
    const direction = ringIndex === 1 ? -1 : 1;
    return {
      angle: (idx * Math.PI * 2) / 16 + (ringIndex * 0.35),
      baseRadius,
      speed: direction * (0.0055 + (idx % 5) * 0.0018),
      size: ringIndex === 2 ? 3.8 : 4.6,
      pulseOffset: idx * 0.9,
      ringIndex
    };
  });

  function renderReactor() {
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    ctx.clearRect(0, 0, w, h);

    const isEdith = state.persona === 'edith';
    const isActiveNeural = state.isListening || state.isSpeaking || state.isProcessing;
    const primaryHex = isEdith ? '#fb7185' : '#f0c138';
    const secondaryHex = isEdith ? '#f0c138' : '#38bdf8';
    const primaryRgb = isEdith ? '251, 113, 133' : '240, 193, 56';
    const secondaryRgb = isEdith ? '240, 193, 56' : '56, 189, 248';

    const speedMult = isActiveNeural ? 2.9 : 1.0;
    phase += 0.016 * speedMult;

    // A) Circular Polar Radar Grid (Concentric Orbital Rings + Radial Meridians)
    const gridRadii = [118, 144, 186, 228];
    gridRadii.forEach((r, idx) => {
      ctx.save();
      ctx.beginPath();
      if (idx % 2 === 1) {
        ctx.setLineDash([4, 8]);
      }
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${primaryRgb}, ${isActiveNeural ? 0.32 : 0.18})`;
      ctx.lineWidth = idx === 0 ? 1.8 : 1.1;
      ctx.stroke();
      ctx.restore();
    });

    // Radial Meridian Spokes (12 sectors symbolizing the circular satellite grid)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(phase * 0.12);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 112, Math.sin(a) * 112);
      ctx.lineTo(Math.cos(a) * 238, Math.sin(a) * 238);
      ctx.strokeStyle = `rgba(${primaryRgb}, 0.12)`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();

    // B) Compute Current Positions of All 16 Orbiting Neural Satellites
    const satCoords = neuralSatellites.map((sat) => {
      sat.angle += sat.speed * speedMult;
      const radialWave = Math.sin(phase * 2.2 + sat.pulseOffset) * (isActiveNeural ? 7 : 3);
      const r = sat.baseRadius + radialWave;
      return {
        x: cx + Math.cos(sat.angle) * r,
        y: cy + Math.sin(sat.angle) * r,
        size: sat.size,
        ringIndex: sat.ringIndex,
        pulse: 0.5 + 0.5 * Math.sin(phase * 3.4 + sat.pulseOffset)
      };
    });

    // C) Draw Synaptic Neural Mesh Links Between Nearby Satellites
    for (let i = 0; i < satCoords.length; i++) {
      for (let j = i + 1; j < satCoords.length; j++) {
        const a = satCoords[i];
        const b = satCoords[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.hypot(dx, dy);
        const maxDist = isActiveNeural ? 148 : 122;

        if (dist < maxDist) {
          const alpha = (1 - dist / maxDist) * (isActiveNeural ? 0.65 : 0.36);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = (i + j) % 3 === 0 ? `rgba(${secondaryRgb}, ${alpha})` : `rgba(${primaryRgb}, ${alpha})`;
          ctx.lineWidth = isActiveNeural ? 1.5 : 1.0;
          ctx.stroke();
        }
      }
    }

    // D) Draw Neural Impulse Beams from Satellites into the Central Doctor Doom Head
    satCoords.forEach((sat, idx) => {
      if (sat.pulse > (isActiveNeural ? 0.45 : 0.76)) {
        const dx = sat.x - cx;
        const dy = sat.y - cy;
        const angle = Math.atan2(dy, dx);
        const headEdgeX = cx + Math.cos(angle) * 112;
        const headEdgeY = cy + Math.sin(angle) * 112;

        ctx.beginPath();
        ctx.moveTo(sat.x, sat.y);
        ctx.lineTo(headEdgeX, headEdgeY);
        ctx.strokeStyle = idx % 2 === 0 ? `rgba(${primaryRgb}, 0.55)` : `rgba(${secondaryRgb}, 0.55)`;
        ctx.lineWidth = isActiveNeural ? 1.8 : 1.1;
        ctx.stroke();

        // Traveling synaptic packet dot along the beam
        const t = (phase * 1.9 + idx * 0.3) % 1;
        const px = sat.x + (headEdgeX - sat.x) * t;
        const py = sat.y + (headEdgeY - sat.y) * t;
        ctx.beginPath();
        ctx.arc(px, py, 2.4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
    });

    // E) Render Each Satellite Node with Orbital Glow Halo
    satCoords.forEach((sat, idx) => {
      const haloRadius = sat.size * (2.1 + sat.pulse * (isActiveNeural ? 1.8 : 0.9));
      ctx.beginPath();
      ctx.arc(sat.x, sat.y, haloRadius, 0, Math.PI * 2);
      ctx.fillStyle = idx % 3 === 0 ? `rgba(${secondaryRgb}, 0.24)` : `rgba(${primaryRgb}, 0.26)`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(sat.x, sat.y, sat.size, 0, Math.PI * 2);
      ctx.fillStyle = idx % 3 === 0 ? secondaryHex : primaryHex;
      ctx.fill();

      ctx.lineWidth = 1.2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    });

    // F) Inner Neural Crown Ring directly framing the Golden Doom Mask
    const crownRadius = 113 + Math.sin(phase * 3) * (isActiveNeural ? 5 : 2);
    ctx.beginPath();
    ctx.arc(cx, cy, crownRadius, 0, Math.PI * 2);
    ctx.strokeStyle = state.isListening ? '#f43f5e' : primaryHex;
    ctx.lineWidth = 2.8;
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
    btnToggleTts.textContent = `Voce: ${state.ttsEnabled ? 'ON' : 'OFF'}`;
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
      voiceStateBadge.textContent = 'ASCOLTO SATELLITARE';
      voiceStatusText.textContent = 'Parla ora... la griglia neurale sta acquisendo la tua voce.';
      btnToggleMic.textContent = 'Ferma';
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
      voiceStateBadge.textContent = 'NEURAL GRID ATTIVA';
      btnToggleMic.textContent = 'Ascolto Vocale';
      btnToggleMic.classList.remove('btn-listening');
    };

    recognition.onend = () => {
      state.isListening = false;
      if (!state.isProcessing) voiceStateBadge.textContent = 'NEURAL GRID ATTIVA';
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

  // Helper: Query OpenAI ChatGPT API (gpt-4o-mini)
  async function callOpenAIChatGPT(query, persona, startTime) {
    const apiKey = (state.apiConfig.openaiKey || '').trim();
    if (!apiKey) return null;
    const sys =
      persona === 'edith'
        ? 'Sei E.D.I.T.H. nel sistema neurale DoomAi su iPhone 16 Pro Max. Rispondi in italiano in modo tattico, diretto e preciso.'
        : 'Sei J.A.R.V.I.S. nel sistema sovrano DoomAi su iPhone 16 Pro Max. Rispondi in italiano con stile elegante ("Agli ordini, Signore") e completo.';
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: query }
        ],
        temperature: 0.5
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content;
    if (!reply) return null;
    return {
      ok: true,
      persona,
      speech: reply.replace(/[#*`_~>-]/g, '').slice(0, 480),
      display: reply,
      provider: 'API ChatGPT (OpenAI GPT-4o)',
      latencyMs: Date.now() - startTime,
      cards: []
    };
  }

  // Helper: Query Google Gemini API (gemini-2.5-flash)
  async function callGoogleGemini(query, persona, startTime) {
    const apiKey = (state.apiConfig.geminiKey || '').trim();
    if (!apiKey) return null;
    const sys =
      persona === 'edith'
        ? 'Sei E.D.I.T.H. nel sistema neurale DoomAi su iPhone 16 Pro Max. Rispondi in italiano in modo tattico, diretto e preciso.'
        : 'Sei J.A.R.V.I.S. nel sistema sovrano DoomAi su iPhone 16 Pro Max. Rispondi in italiano con stile elegante ("Agli ordini, Signore") e completo.';
    const gemRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sys }] },
          contents: [{ role: 'user', parts: [{ text: query }] }]
        })
      }
    );
    if (!gemRes.ok) return null;
    const gemData = await gemRes.json();
    const reply = gemData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) return null;
    return {
      ok: true,
      persona,
      speech: reply.replace(/[#*`_~>-]/g, '').slice(0, 480),
      display: reply,
      provider: 'API Gemini (Gemini 2.5 Flash)',
      latencyMs: Date.now() - startTime,
      cards: []
    };
  }

  // 7. Hybrid Online (ChatGPT + Gemini + Meteo + Wikipedia) + 100% Offline APU Engine
  async function runStandaloneOnDeviceQuery(query) {
    const startTime = Date.now();
    const persona = state.persona;
    const lower = query.toLowerCase();
    const routingMode = state.apiConfig.routingMode || 'auto';

    // A) Task / Memory Add Commands (100% Offline Ready)
    if (/^(aggiungi task|crea promemoria|ricordami di|ricordami|aggiungi nota|memorizza che|memorizza)/i.test(lower)) {
      const extracted = query
        .replace(/^(aggiungi task|crea promemoria|ricordami di|ricordami|aggiungi nota|memorizza che|memorizza)[:\s]*/i, '')
        .trim();
      const isMem = lower.includes('memorizza');
      const speech =
        persona === 'edith'
          ? `Ricevuto. Ho registrato nel database tattico locale: "${extracted}".`
          : `Agli ordini, Signore. Ho annotato "${extracted}" nella memoria neurale di DoomAi.`;
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
    if (/\b(quali sono i miei task|mostra i task|mostra i miei task|mostra promemoria|cosa devo fare|leggi memoria|cosa ricordi|briefing)\b/i.test(lower)) {
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

    // C) Local APU Math Co-Processor (100% Offline Ready, Zero eval/Function)
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

    // D) Online Modules (ChatGPT, Gemini, Open-Meteo, Wikipedia) with automatic Local Dossier Cache
    const cachedDossiers = JSON.parse(localStorage.getItem('doom_offline_cache') || '{}');

    if (navigator.onLine && routingMode !== 'offline') {
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
                  ? `Scansione satellitare su ${cityLabel}: ${c.temperature_2m} gradi Celsius, umidità ${c.relative_humidity_2m} percento, vento a ${c.wind_speed_10m} chilometri orari.`
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

      // 2. Direct API ChatGPT (OpenAI) or API Gemini (Google) based on preference
      try {
        if (routingMode === 'chatgpt') {
          const gptRes = await callOpenAIChatGPT(query, persona, startTime);
          if (gptRes) {
            cachedDossiers[lower] = gptRes;
            localStorage.setItem('doom_offline_cache', JSON.stringify(cachedDossiers));
            return gptRes;
          }
          const gemRes = await callGoogleGemini(query, persona, startTime);
          if (gemRes) {
            cachedDossiers[lower] = gemRes;
            localStorage.setItem('doom_offline_cache', JSON.stringify(cachedDossiers));
            return gemRes;
          }
        } else if (routingMode === 'gemini') {
          const gemRes = await callGoogleGemini(query, persona, startTime);
          if (gemRes) {
            cachedDossiers[lower] = gemRes;
            localStorage.setItem('doom_offline_cache', JSON.stringify(cachedDossiers));
            return gemRes;
          }
          const gptRes = await callOpenAIChatGPT(query, persona, startTime);
          if (gptRes) {
            cachedDossiers[lower] = gptRes;
            localStorage.setItem('doom_offline_cache', JSON.stringify(cachedDossiers));
            return gptRes;
          }
        } else {
          // Auto: try ChatGPT if present, then Gemini if present
          const gptRes = await callOpenAIChatGPT(query, persona, startTime);
          if (gptRes) {
            cachedDossiers[lower] = gptRes;
            localStorage.setItem('doom_offline_cache', JSON.stringify(cachedDossiers));
            return gptRes;
          }
          const gemRes = await callGoogleGemini(query, persona, startTime);
          if (gemRes) {
            cachedDossiers[lower] = gemRes;
            localStorage.setItem('doom_offline_cache', JSON.stringify(cachedDossiers));
            return gemRes;
          }
        }
      } catch (_) {}
    }

    // E) Check Built-in Offline Dossiers (Doctor Doom, Jarvis, Edith, APU)
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

    // F) Direct Wikipedia IT Live Search (when online and no API key handled it)
    if (navigator.onLine && routingMode !== 'offline') {
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
                  ? `Dossier ${summary.title} acquisito dalla rete satellitare.`
                  : `Agli ordini, Signore. Ho estratto il dossier su ${summary.title}.`;
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

    // G) Check Offline Cached Dossiers from previous searches
    if (cachedDossiers[lower]) {
      const cached = cachedDossiers[lower];
      return {
        ...cached,
        provider: `${state.apuTelemetry.engine} (Cache Offline iPhone)`,
        latencyMs: 3
      };
    }

    // H) Offline APU Local Synthesis Fallback
    const offlineStatus = navigator.onLine ? 'Online (Inserisci API ChatGPT/Gemini per risposte libere)' : 'Modalità Offline APU';
    const fallbackSpeech =
      persona === 'edith'
        ? `Rete neurale E.D.I.T.H. ha ricevuto "${query}". Per conversazioni generative illimitate inserisci la tua chiave API ChatGPT o API Gemini nella scheda Motore e APU.`
        : `Signore, ho elaborato "${query}" sull'APU del suo iPhone 16 Pro Max. Può inserire una chiave API ChatGPT o API Gemini nella scheda Motore e APU per attivare l'intelligenza generativa completa.`;
    return {
      ok: true,
      persona,
      speech: fallbackSpeech,
      display: fallbackSpeech,
      provider: `${state.apuTelemetry.engine}`,
      latencyMs: Math.max(4, Date.now() - startTime),
      cards: [
        {
          category: 'MOTORE NEURALE ON-DEVICE',
          title: `Elaborazione APU: "${query.slice(0, 38)}"`,
          summary: 'Apri la scheda "Motore & APU" in basso per inserire la tua API ChatGPT o API Gemini.',
          metrics: [
            { label: 'Stato', value: navigator.onLine ? 'Online Ready' : 'Offline APU' },
            { label: 'Dossier Salvati', value: `${Object.keys(cachedDossiers).length + 4}` }
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
      role === 'user' ? `OPERATORE // ${timeStr}` : `${provider} // ${latencyMs} ms`;

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
              <div style="font-size: 13px; color: var(--text-secondary);">${c.summary || ''}</div>
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
    voiceStateBadge.textContent = 'ATTIVITÀ NEURALE...';
    commandInput.value = '';

    appendStreamMessage({
      role: 'user',
      sender: 'ORDINE SOVRANO',
      text: query
    });

    const data = await runStandaloneOnDeviceQuery(query);

    state.isProcessing = false;
    voiceStateBadge.textContent = 'NEURAL GRID ATTIVA';

    if (data.provider && telemetryProvider) telemetryProvider.textContent = data.provider;
    if (data.latencyMs && telemetryLatency) telemetryLatency.textContent = `${data.latencyMs} ms`;

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
      latencyMs: data.latencyMs || 4
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

  // 10. Siri Deep-Link & Shortcuts Setup
  const siriWebhookPreview = document.getElementById('siriWebhookPreview');
  const btnOpenShortcutsApp = document.getElementById('btnOpenShortcutsApp');
  const btnTestSiriVoiceUrl = document.getElementById('btnTestSiriVoiceUrl');
  const btnTestSiriWebhook = document.getElementById('btnTestSiriWebhook');

  if (btnOpenShortcutsApp) {
    btnOpenShortcutsApp.addEventListener('click', () => {
      const urlToCopy = 'doomai://ask?q=';
      navigator.clipboard?.writeText(urlToCopy);
      siriWebhookPreview.textContent =
        'Copiato negli appunti: doomai://ask?q=\nApertura app Comandi Rapidi di iOS in corso...';
      if (!postToNativeBridge({ action: 'openShortcutsApp' })) {
        window.location.href = 'shortcuts://create-shortcut';
      }
    });
  }

  if (btnTestSiriVoiceUrl) {
    btnTestSiriVoiceUrl.addEventListener('click', () => {
      window.onDoomNativeEvent({ type: 'siriUrlQuery', mode: 'voice' });
    });
  }

  if (btnTestSiriWebhook) {
    btnTestSiriWebhook.addEventListener('click', async () => {
      siriWebhookPreview.textContent = '// Esecuzione test vocale Siri...';
      const json = await runStandaloneOnDeviceQuery('Chi è Dottor Destino');
      siriWebhookPreview.textContent = JSON.stringify(json, null, 2);
      speakText(json.speech);
    });
  }

  // 11. Engine & API Vault Configuration (ONLY API ChatGPT & API Gemini)
  function hydrateApiConfigForm() {
    const sel = document.getElementById('selectRoutingMode');
    const inOpenai = document.getElementById('inputOpenaiKey');
    const inGemini = document.getElementById('inputGeminiKey');
    if (sel) sel.value = state.apiConfig.routingMode || 'auto';
    if (inOpenai) inOpenai.value = state.apiConfig.openaiKey || '';
    if (inGemini) inGemini.value = state.apiConfig.geminiKey || '';
    updateApiStatusBadges();
  }

  document.getElementById('btnSaveApiConfig').addEventListener('click', () => {
    state.apiConfig = {
      routingMode: document.getElementById('selectRoutingMode').value || 'auto',
      openaiKey: document.getElementById('inputOpenaiKey').value.trim(),
      geminiKey: document.getElementById('inputGeminiKey').value.trim()
    };
    localStorage.setItem('doom_api_config', JSON.stringify(state.apiConfig));
    updateApiStatusBadges();
    syncStateToNativeIPA();
    const statusEl = document.getElementById('saveConfigStatus');
    if (statusEl) {
      statusEl.textContent = 'Chiavi API ChatGPT & Gemini salvate e sincronizzate!';
      setTimeout(() => {
        statusEl.textContent = '';
      }, 3200);
    }
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

  // Check if launched with ?q= query parameter
  function checkInitialUrlQuery() {
    try {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('q');
      if (q && q.trim()) {
        setTimeout(() => submitQuery(q.trim()), 350);
      } else if (params.get('mode') === 'voice') {
        setTimeout(() => toggleMicrophone(), 350);
      }
    } catch (_) {}
  }

  // Boot Sequence
  applyPersona(state.persona);
  btnToggleTts.textContent = `Voce: ${state.ttsEnabled ? 'ON' : 'OFF'}`;
  detectHardwareAPU();
  hydrateApiConfigForm();
  saveAndRenderTasks();
  saveAndRenderMemory();
  requestAnimationFrame(renderReactor);
  checkInitialUrlQuery();

  appendStreamMessage({
    role: 'assistant',
    sender: 'DOOM AI // NEURAL GRID v4.2',
    text:
      'Interfaccia **Neural Sovereign v4.2** attiva a pieno schermo. La **Testa d\'Oro di Doctor Doom** è ora posizionata in alto al centro circondata dalla **Griglia Circolare di 16 Satelliti Neurali** che pulsano in sincronia con la voce e il calcolo AI. Nel menu **Motore & APU** trovi ora esclusivamente gli spazi per **API ChatGPT** e **API Gemini**.',
    cards: [
      {
        category: 'AGGIORNAMENTO ARCHITETTURA v4.2',
        title: 'Griglia Satellitare Neurale + Siri URL Scheme',
        summary:
          'Risolto il blocco della cache OTA di GitHub, adattato lo schermo nativo 6.9" di iPhone 16 Pro Max senza bande nere e abilitato il protocollo doomai:// per i Comandi Rapidi Siri.',
        metrics: [
          { label: 'Satelliti Attivi', value: '16 Nodi Neurali' },
          { label: 'Motori Cloud', value: 'ChatGPT & Gemini' },
          { label: 'Ponte Siri', value: 'doomai:// Attivo' },
          { label: 'Modalità Offline', value: '100% Flash APU' }
        ]
      }
    ],
    provider: 'DoomAi Neural Grid v4.2',
    latencyMs: 3
  });
})();
