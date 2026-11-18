(() => {
  // Application State
  const state = {
    persona: localStorage.getItem('doom_persona') || 'doom',
    ttsEnabled: localStorage.getItem('doom_tts') !== 'false',
    isListening: false,
    isSpeaking: false,
    isProcessing: false,
    isOnline: navigator.onLine !== false,
    requestCount: 0,
    apuTelemetry: {
      engine: 'A18 Pro · 35 TOPS',
      cores: navigator.hardwareConcurrency || 6
    },
    apiConfig: JSON.parse(localStorage.getItem('doom_api_config') || '{}'),
    tasks: JSON.parse(
      localStorage.getItem('doom_tasks') ||
        JSON.stringify([
          { id: 't1', text: 'Configura API ChatGPT o API Gemini nella scheda Motore', done: false },
          { id: 't2', text: 'Attiva Siri Vocale 1-Click nella scheda Siri', done: false }
        ])
    ),
    memory: JSON.parse(
      localStorage.getItem('doom_memory') ||
        JSON.stringify([
          { id: 'm1', text: 'Operatore autorizzato — Lingua operativa: Italiano' }
        ])
    )
  };

  // Built-in Offline Vault
  const OFFLINE_DOSSIERS = {
    doom: {
      category: 'SISTEMA ALL-IN-ONE (OFFLINE)',
      title: 'D.O.O.M. — Nucleo Centrale AIO',
      summary:
        'Assistente completo All-In-One: coordina ricerche, analisi, task, memoria e risposte multimodali sia online che offline.'
    },
    jarvis: {
      category: 'MODULO TECNICO (OFFLINE)',
      title: 'J.A.R.V.I.S. — Task Tecniche & Ingegneria',
      summary:
        'Specializzato in task tecniche, calcoli avanzati, programmazione, automazione e diagnostica di sistema.'
    },
    edith: {
      category: 'MODULO CREATIVO (OFFLINE)',
      title: 'E.D.I.T.H. — Foto, Video & Generazione',
      summary:
        'Specializzata in direzione visiva, prompt per generazione immagini/video, editing multimediale e analisi creativa.'
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
  const telemetryLatency = document.getElementById('telemetryLatency');

  function postToNativeBridge(payload) {
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.doomNative) {
      try {
        window.webkit.messageHandlers.doomNative.postMessage(payload);
        return true;
      } catch (_) {}
    }
    return false;
  }

  // Dynamic Viewport & Font/Head Calibration (visibly distinct scales!)
  function calibrateDynamicViewport() {
    const vv = window.visualViewport;
    const vw = Math.round(vv ? vv.width : window.innerWidth || document.documentElement.clientWidth || 430);
    const vh = Math.round(vv ? vv.height : window.innerHeight || document.documentElement.clientHeight || 932);

    const layoutCfg = JSON.parse(localStorage.getItem('doom_grid_layout_v1') || '{}');
    const headScale = layoutCfg.headScale || 'md';
    const fontScale = layoutCfg.fontScale || 'md';

    const headRatio = headScale === 'sm' ? 0.33 : headScale === 'lg' ? 0.58 : 0.44;
    const reactorPx = Math.max(132, Math.min(268, Math.round(vw * headRatio)));
    const maskPx = Math.round(reactorPx * 0.46);
    const fontMul = fontScale === 'sm' ? '0.84' : fontScale === 'lg' ? '1.22' : '1.0';

    const root = document.documentElement;
    root.style.setProperty('--vw-px', `${vw}px`);
    root.style.setProperty('--vh-px', `${vh}px`);
    root.style.setProperty('--reactor-size', `${reactorPx}px`);
    root.style.setProperty('--mask-size', `${maskPx}px`);
    root.style.setProperty('--font-scale', fontMul);

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

  function updateConnectivityBadge() {
    state.isOnline = navigator.onLine !== false;
    const btnOta = document.getElementById('btnOtaReload');
    if (btnOta) {
      btnOta.textContent = state.isOnline ? 'Aggiorna UI' : 'Offline';
    }
  }

  window.addEventListener('online', updateConnectivityBadge);
  window.addEventListener('offline', updateConnectivityBadge);

  // Native Callbacks
  window.onDoomNativeEvent = (event) => {
    if (!event || !event.type) return;
    if (event.type === 'voicePartial') {
      voiceStatusText.textContent = event.transcript || 'Acquisizione vocale in corso...';
      commandInput.value = event.transcript || '';
    } else if (event.type === 'voiceFinal') {
      state.isListening = false;
      updatePersonaBadge();
      btnToggleMic.textContent = 'Ascolto Vocale';
      btnToggleMic.classList.remove('btn-listening');
      if (event.transcript && event.transcript.trim()) {
        commandInput.value = event.transcript.trim();
        submitQuery(event.transcript.trim());
      }
    } else if (event.type === 'voiceState') {
      state.isListening = Boolean(event.isRecording);
      if (state.isListening) {
        voiceStateBadge.textContent = 'IN ASCOLTO';
      } else {
        updatePersonaBadge();
      }
      btnToggleMic.textContent = state.isListening ? 'Ferma' : 'Ascolto Vocale';
      btnToggleMic.classList.toggle('btn-listening', state.isListening);
      if (event.message) voiceStatusText.textContent = event.message;
    } else if (event.type === 'otaStatus') {
      const btnOta = document.getElementById('btnOtaReload');
      if (btnOta && event.message) {
        btnOta.textContent = event.message;
        setTimeout(updateConnectivityBadge, 2500);
      }
    } else if (event.type === 'siriUrlQuery') {
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

  function syncStateToNative() {
    postToNativeBridge({
      action: 'syncConfig',
      persona: state.persona,
      ttsEnabled: state.ttsEnabled,
      apiConfig: state.apiConfig,
      tasks: state.tasks,
      memories: state.memory
    });
  }

  // 1. Hardware & Technical API Limits Detection
  function detectHardwareAPU() {
    const cores = navigator.hardwareConcurrency || 6;
    state.apuTelemetry = { engine: `A18 Pro · 35 TOPS`, cores };
    if (telemetryApu) telemetryApu.textContent = `A18 Pro · ${cores} Core`;
    const apuSummaryEl = document.getElementById('apuDeviceSummary');
    const metricCores = document.getElementById('metricCores');
    if (apuSummaryEl) apuSummaryEl.textContent = `Apple A18 Pro 16-Core Neural Engine (${cores} Core)`;
    if (metricCores) metricCores.textContent = `${cores} Core Attivi`;
    updateApiStatusBadges();
    updateConnectivityBadge();
  }

  function updateApiStatusBadges() {
    const hasOpenai = Boolean(state.apiConfig.openaiKey && state.apiConfig.openaiKey.trim());
    const hasGemini = Boolean(state.apiConfig.geminiKey && state.apiConfig.geminiKey.trim());

    const elOpenaiLimit = document.getElementById('techChatGptLimit');
    const elGeminiLimit = document.getElementById('techGeminiLimit');
    if (elOpenaiLimit) {
      elOpenaiLimit.textContent = hasOpenai ? 'Attiva · 500 RPM / 200k TPM' : 'Non configurata · 500 RPM';
    }
    if (elGeminiLimit) {
      elGeminiLimit.textContent = hasGemini ? 'Attiva · 15 RPM / 1M TPM' : 'Non configurata · 15 RPM';
    }
  }

  // 2. 3-Way Persona Switching (D.O.O.M. Green AIO | J.A.R.V.I.S. Gold Tech | E.D.I.T.H. Violet-Pink Media)
  function updatePersonaBadge() {
    if (state.persona === 'jarvis') {
      voiceStateBadge.textContent = 'J.A.R.V.I.S. // TECH';
    } else if (state.persona === 'edith') {
      voiceStateBadge.textContent = 'E.D.I.T.H. // MEDIA';
    } else {
      voiceStateBadge.textContent = 'D.O.O.M. // AIO';
    }
  }

  function applyPersona(persona) {
    state.persona = ['doom', 'jarvis', 'edith'].includes(persona) ? persona : 'doom';
    localStorage.setItem('doom_persona', state.persona);
    bodyEl.setAttribute('data-persona', state.persona);

    document.getElementById('btnPersonaDoom')?.classList.toggle('active', state.persona === 'doom');
    document.getElementById('btnPersonaJarvis')?.classList.toggle('active', state.persona === 'jarvis');
    document.getElementById('btnPersonaEdith')?.classList.toggle('active', state.persona === 'edith');

    updatePersonaBadge();

    if (state.persona === 'jarvis') {
      systemHeaderTitle.textContent = 'J.A.R.V.I.S. // TASK TECNICHE';
      commandInput.placeholder = 'Ai tuoi ordini, chiedimi qualsiasi cosa';
    } else if (state.persona === 'edith') {
      systemHeaderTitle.textContent = 'E.D.I.T.H. // FOTO, VIDEO & GEN';
      commandInput.placeholder = 'Ai tuoi ordini, chiedimi qualsiasi cosa';
    } else {
      systemHeaderTitle.textContent = 'D.O.O.M. // ALL-IN-ONE';
      commandInput.placeholder = 'Ai tuoi ordini, chiedimi qualsiasi cosa';
    }
    syncStateToNative();
  }

  document.getElementById('btnPersonaDoom')?.addEventListener('click', () => applyPersona('doom'));
  document.getElementById('btnPersonaJarvis')?.addEventListener('click', () => applyPersona('jarvis'));
  document.getElementById('btnPersonaEdith')?.addEventListener('click', () => applyPersona('edith'));

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

  // 4. 3D GYROSCOPE & PC MOUSE DOOM HEAD + QUASI-RANDOM MULTI-COLOR 3D SATELLITES
  const canvasBack = document.getElementById('reactorCanvasBack');
  const canvasFront = document.getElementById('reactorCanvasFront');
  const ctxBack = canvasBack ? canvasBack.getContext('2d') : null;
  const ctxFront = canvasFront ? canvasFront.getContext('2d') : null;
  const headCoreEl = document.getElementById('reactorHeadCore');
  const headShadowEl = document.getElementById('reactorHeadShadow');
  const headSheenEl = document.getElementById('reactorSpecularSheen');

  const gyro = { targetX: 0, targetY: 0, currX: 0, currY: 0, enabled: false };

  function handleDeviceOrientation(e) {
    if (typeof e.gamma !== 'number' || typeof e.beta !== 'number') return;
    gyro.targetX = Math.max(-13, Math.min(13, e.gamma * 0.42));
    gyro.targetY = Math.max(-13, Math.min(13, (e.beta - 42) * 0.35));
    gyro.enabled = true;
  }

  function initGyroscope3DHead() {
    if (window.DeviceOrientationEvent) {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        document.getElementById('reactorTouchArea')?.addEventListener(
          'click',
          () => {
            DeviceOrientationEvent.requestPermission()
              .then((res) => {
                if (res === 'granted') {
                  window.addEventListener('deviceorientation', handleDeviceOrientation, true);
                }
              })
              .catch(() => {});
          },
          { once: true }
        );
      } else {
        window.addEventListener('deviceorientation', handleDeviceOrientation, true);
      }
    }

    // PC / Desktop Mouse 3D Parallax
    window.addEventListener('mousemove', (e) => {
      if (gyro.enabled) return;
      const nx = (e.clientX / (window.innerWidth || 1) - 0.5) * 2;
      const ny = (e.clientY / (window.innerHeight || 1) - 0.5) * 2;
      gyro.targetX = nx * 13;
      gyro.targetY = ny * 11;
    });

    document.addEventListener('mouseleave', () => {
      if (!gyro.enabled) {
        gyro.targetX = 0;
        gyro.targetY = 0;
      }
    });
  }
  initGyroscope3DHead();

  let phase = 0;

  const SATELLITE_PALETTE = [
    { hex: '#10b981', rgb: '16, 185, 129' },  // Emerald
    { hex: '#f0c138', rgb: '240, 193, 56' },  // 24K Gold
    { hex: '#38bdf8', rgb: '56, 189, 248' },  // Cyan
    { hex: '#d946ef', rgb: '217, 70, 239' },  // Violet-Pink
    { hex: '#c084fc', rgb: '192, 132, 252' }, // Lavender
    { hex: '#fb7185', rgb: '251, 113, 133' }, // Rose
    { hex: '#22d3ee', rgb: '34, 211, 238' }   // Electric Aqua
  ];

  // 18 Satellites each with quasi-random inclination, precession, eccentricity & distinct color
  const satellites3D = Array.from({ length: 18 }, (_, idx) => {
    const seed1 = Math.sin(idx * 12.9898) * 43758.5453;
    const r1 = seed1 - Math.floor(seed1);
    const seed2 = Math.sin(idx * 78.233) * 19341.123;
    const r2 = seed2 - Math.floor(seed2);
    const color = SATELLITE_PALETTE[idx % SATELLITE_PALETTE.length];

    return {
      angle: r1 * Math.PI * 2,
      speed: (idx % 2 === 0 ? 1 : -1) * (0.012 + r2 * 0.015),
      tilt: (r1 - 0.5) * Math.PI * 1.15,
      tiltSpeed: (r2 - 0.5) * 0.0045,
      rx: 138 + r1 * 88,
      ry: 52 + r2 * 62,
      size: 6.0 + (idx % 3) * 1.4,
      color
    };
  });

  function render3DFaceSatellites() {
    if (!canvasBack || !canvasFront || !ctxBack || !ctxFront) return;

    // Smoothly interpolate 3D gyroscope head tilt (plus subtle idle float when flat)
    const idleX = gyro.enabled ? 0 : Math.sin(phase * 0.7) * 3.5;
    const idleY = gyro.enabled ? 0 : Math.cos(phase * 0.5) * 3.0;
    gyro.currX += (gyro.targetX + idleX - gyro.currX) * 0.14;
    gyro.currY += (gyro.targetY + idleY - gyro.currY) * 0.14;

    if (headCoreEl) {
      headCoreEl.style.transform = `perspective(520px) rotateX(${(-gyro.currY).toFixed(2)}deg) rotateY(${gyro.currX.toFixed(2)}deg)`;
    }
    if (headShadowEl) {
      headShadowEl.style.transform = `translate(${(-gyro.currX * 0.75).toFixed(1)}px, ${(6 - gyro.currY * 0.65).toFixed(1)}px)`;
    }
    if (headSheenEl) {
      const sx = 50 + gyro.currX * 2.2;
      const sy = 40 + gyro.currY * 2.2;
      headSheenEl.style.background = `radial-gradient(circle at ${sx.toFixed(0)}% ${sy.toFixed(0)}%, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.06) 38%, transparent 72%)`;
    }

    const w = canvasBack.width;
    const h = canvasBack.height;
    const cx = w / 2;
    const cy = h / 2;

    ctxBack.clearRect(0, 0, w, h);
    ctxFront.clearRect(0, 0, w, h);

    const isActive = state.isListening || state.isSpeaking || state.isProcessing;
    const speedMult = isActive ? 2.5 : 1.0;
    phase += 0.02 * speedMult;

    // Update quasi-random precessing 3D positions
    const projected = satellites3D.map((sat) => {
      sat.angle += sat.speed * speedMult;
      sat.tilt += sat.tiltSpeed * speedMult;

      const localX = Math.cos(sat.angle) * sat.rx;
      const localY = Math.sin(sat.angle) * sat.ry;
      const zDepth = Math.sin(sat.angle); // < 0 behind head, >= 0 over face

      const cosT = Math.cos(sat.tilt);
      const sinT = Math.sin(sat.tilt);
      const x = cx + localX * cosT - localY * sinT;
      const y = cy + localX * sinT + localY * cosT;
      const depthScale = 0.72 + (zDepth + 1) * 0.34;

      return { x, y, zDepth, size: sat.size * depthScale, color: sat.color };
    });

    // Subtle orbital rings
    for (let i = 0; i < 6; i++) {
      const sat = satellites3D[i * 3];
      ctxBack.save();
      ctxBack.translate(cx, cy);
      ctxBack.rotate(sat.tilt);
      ctxBack.beginPath();
      ctxBack.ellipse(0, 0, sat.rx, sat.ry, 0, 0, Math.PI * 2);
      ctxBack.strokeStyle = `rgba(${sat.color.rgb}, 0.24)`;
      ctxBack.lineWidth = 1.4;
      ctxBack.stroke();
      ctxBack.restore();
    }

    // Proximity Synaptic Links whenever any two satellites get close!
    const maxLinkDist = isActive ? 175 : 148;
    for (let i = 0; i < projected.length; i++) {
      for (let j = i + 1; j < projected.length; j++) {
        const a = projected[i];
        const b = projected[j];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist < maxLinkDist) {
          const proximity = 1 - dist / maxLinkDist;
          const targetCtx = a.zDepth >= 0 && b.zDepth >= 0 ? ctxFront : ctxBack;

          const grad = targetCtx.createLinearGradient(a.x, a.y, b.x, b.y);
          grad.addColorStop(0, `rgba(${a.color.rgb}, ${0.35 + proximity * 0.65})`);
          grad.addColorStop(1, `rgba(${b.color.rgb}, ${0.35 + proximity * 0.65})`);

          targetCtx.beginPath();
          targetCtx.moveTo(a.x, a.y);
          targetCtx.lineTo(b.x, b.y);
          targetCtx.strokeStyle = grad;
          targetCtx.lineWidth = 1.5 + proximity * (isActive ? 3.2 : 2.2);
          targetCtx.stroke();
        }
      }
    }

    // Draw Multi-Color 3D Satellite Spheres
    projected.forEach((p) => {
      const targetCtx = p.zDepth >= 0 ? ctxFront : ctxBack;
      const alpha = p.zDepth >= 0 ? 1.0 : 0.72;

      targetCtx.beginPath();
      targetCtx.arc(p.x, p.y, p.size * 2.6, 0, Math.PI * 2);
      targetCtx.fillStyle = `rgba(${p.color.rgb}, ${p.zDepth >= 0 ? 0.42 : 0.22})`;
      targetCtx.fill();

      targetCtx.beginPath();
      targetCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      targetCtx.fillStyle = p.color.hex;
      targetCtx.globalAlpha = alpha;
      targetCtx.fill();
      targetCtx.globalAlpha = 1;

      targetCtx.lineWidth = 1.6;
      targetCtx.strokeStyle = '#ffffff';
      targetCtx.stroke();
    });

    requestAnimationFrame(render3DFaceSatellites);
  }

  // 5. Speech Synthesis
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
    syncStateToNative();
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
      voiceStatusText.textContent = 'Parla ora...';
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
      updatePersonaBadge();
      btnToggleMic.textContent = 'Ascolto Vocale';
      btnToggleMic.classList.remove('btn-listening');
    };

    recognition.onend = () => {
      state.isListening = false;
      if (!state.isProcessing) updatePersonaBadge();
      btnToggleMic.textContent = 'Ascolto Vocale';
      btnToggleMic.classList.remove('btn-listening');
    };
  }

  function toggleMicrophone() {
    if (postToNativeBridge({ action: 'toggleVoice' })) {
      return;
    }
    if (!recognition) {
      voiceStatusText.textContent = 'Usa il microfono della tastiera o scrivi nella barra.';
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

  function getPersonaSystemPrompt(persona) {
    if (persona === 'jarvis') {
      return 'Sei J.A.R.V.I.S., modulo AI specializzato in task tecniche, programmazione, ingegneria, calcoli e diagnostica. Rispondi in italiano in modo preciso, tecnico e strutturato ("Agli ordini, Signore").';
    }
    if (persona === 'edith') {
      return 'Sei E.D.I.T.H., modulo AI specializzato in fotografia, video, regia visiva, montaggio e generazione di prompt creativi per immagini e video. Rispondi in italiano con focus visivo e creativo.';
    }
    return 'Sei D.O.O.M., assistente AI All-In-One completo e sovrano. Rispondi in italiano in modo chiaro, autorevole ed esauriente su qualsiasi argomento.';
  }

  // Helper: Query OpenAI ChatGPT API
  async function callOpenAIChatGPT(query, persona, startTime) {
    const apiKey = (state.apiConfig.openaiKey || '').trim();
    if (!apiKey) return null;
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: getPersonaSystemPrompt(persona) },
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
      provider: 'API ChatGPT',
      latencyMs: Date.now() - startTime,
      cards: []
    };
  }

  // Helper: Query Google Gemini API
  async function callGoogleGemini(query, persona, startTime) {
    const apiKey = (state.apiConfig.geminiKey || '').trim();
    if (!apiKey) return null;
    const gemRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: getPersonaSystemPrompt(persona) }] },
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
      provider: 'API Gemini',
      latencyMs: Date.now() - startTime,
      cards: []
    };
  }

  // 7. Hybrid Query Engine
  async function runStandaloneOnDeviceQuery(query) {
    const startTime = Date.now();
    const persona = state.persona;
    const lower = query.toLowerCase();
    const routingMode = state.apiConfig.routingMode || 'auto';

    // A) Task / Memory Add Commands
    if (/^(aggiungi task|crea promemoria|ricordami di|ricordami|aggiungi nota|memorizza che|memorizza)/i.test(lower)) {
      const extracted = query
        .replace(/^(aggiungi task|crea promemoria|ricordami di|ricordami|aggiungi nota|memorizza che|memorizza)[:\s]*/i, '')
        .trim();
      const isMem = lower.includes('memorizza');
      const speech = `Registrato in memoria locale: "${extracted}".`;
      return {
        ok: true,
        persona,
        speech,
        display: speech,
        provider: 'Motore Locale',
        latencyMs: Math.max(3, Date.now() - startTime),
        taskAction: { type: isMem ? 'MEMORY_ADD' : 'TASK_ADD', content: extracted },
        cards: []
      };
    }

    // B) Briefing
    if (/\b(quali sono i miei task|mostra i task|mostra i miei task|mostra promemoria|cosa devo fare|leggi memoria|cosa ricordi|briefing)\b/i.test(lower)) {
      const activeTasks = state.tasks.filter((t) => !t.done).map((t) => t.text);
      const memFacts = state.memory.map((m) => m.text);
      const taskSummary =
        activeTasks.length > 0
          ? `Hai ${activeTasks.length} task attivi: ${activeTasks.join('; ')}.`
          : 'Non ci sono task attivi.';
      return {
        ok: true,
        persona,
        speech: taskSummary,
        display: `### Briefing Operativo\n\n**Task Attivi (${activeTasks.length})**:\n- ${activeTasks.join('\n- ') || 'Nessun task attivo'}\n\n**Memoria (${memFacts.length})**:\n- ${memFacts.join('\n- ')}`,
        provider: 'Motore Locale',
        latencyMs: 4,
        cards: []
      };
    }

    // C) Local Math Co-Processor
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
            return {
              ok: true,
              persona,
              speech: `Il risultato di ${cleanMath} è ${resNum}.`,
              display: `### Calcolo Locale\n\n\`${cleanMath} = ${resNum}\``,
              provider: 'APU Matematica',
              latencyMs: 2,
              cards: []
            };
          }
        }
      } catch (_) {}
    }

    const cachedDossiers = JSON.parse(localStorage.getItem('doom_offline_cache') || '{}');

    // D) Online Modules
    if (navigator.onLine && routingMode !== 'offline') {
      // 1. Live Weather
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
              `https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m`
            );
            const wx = await wxRes.json();
            if (wx?.current) {
              const c = wx.current;
              const cityLabel = `${p.name}${p.country ? ', ' + p.country : ''}`;
              const speech = `Meteo ${cityLabel}: ${c.temperature_2m} gradi, umidità ${c.relative_humidity_2m}%, vento ${c.wind_speed_10m} km/h.`;
              const resultObj = {
                ok: true,
                persona,
                speech,
                display: `### Meteo — ${cityLabel}\n\nTemperatura **${c.temperature_2m}°C** (percepita ${c.apparent_temperature}°C), umidità **${c.relative_humidity_2m}%**, vento **${c.wind_speed_10m} km/h**.`,
                provider: 'Open-Meteo Live',
                latencyMs: Date.now() - startTime,
                cards: []
              };
              cachedDossiers[lower] = resultObj;
              localStorage.setItem('doom_offline_cache', JSON.stringify(cachedDossiers));
              return resultObj;
            }
          }
        } catch (_) {}
      }

      // 2. ChatGPT / Gemini API
      try {
        if (routingMode === 'gemini') {
          const gemRes = await callGoogleGemini(query, persona, startTime);
          if (gemRes) return gemRes;
          const gptRes = await callOpenAIChatGPT(query, persona, startTime);
          if (gptRes) return gptRes;
        } else {
          const gptRes = await callOpenAIChatGPT(query, persona, startTime);
          if (gptRes) return gptRes;
          const gemRes = await callGoogleGemini(query, persona, startTime);
          if (gemRes) return gemRes;
        }
      } catch (_) {}

      // 3. Wikipedia IT Live Search
      const cleanTopic = query
        .replace(/^(chi è|chi era|cosa è|cos'è|che cos'è|parlami di|cerca|dimmi tutto su|informazioni su|spiegami)\s+/i, '')
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
              const resObj = {
                ok: true,
                persona,
                speech: summary.extract,
                display: `### ${summary.title}\n\n${summary.extract}`,
                provider: 'Ricerca Live',
                latencyMs: Date.now() - startTime,
                cards: []
              };
              cachedDossiers[lower] = resObj;
              localStorage.setItem('doom_offline_cache', JSON.stringify(cachedDossiers));
              return resObj;
            }
          }
        } catch (_) {}
      }
    }

    // E) Built-in Offline Dossiers
    if (OFFLINE_DOSSIERS[lower]) {
      const d = OFFLINE_DOSSIERS[lower];
      return {
        ok: true,
        persona,
        speech: d.summary,
        display: `### ${d.title}\n\n${d.summary}`,
        provider: 'Archivio Locale',
        latencyMs: 3,
        cards: []
      };
    }

    if (cachedDossiers[lower]) {
      return { ...cachedDossiers[lower], provider: 'Cache Locale', latencyMs: 3 };
    }

    const fallbackSpeech =
      'Comando elaborato localmente. Per risposte AI generative complete inserisci una chiave API ChatGPT o API Gemini nella scheda Motore.';
    return {
      ok: true,
      persona,
      speech: fallbackSpeech,
      display: fallbackSpeech,
      provider: 'Motore Locale',
      latencyMs: Math.max(4, Date.now() - startTime),
      cards: []
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

  function appendStreamMessage({ role, sender, text, provider = '', latencyMs = 0 }) {
    const entry = document.createElement('article');
    entry.className = `message-entry ${role === 'user' ? 'user-query' : 'assistant-reply'}`;

    const timeStr = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const metaRight = role === 'user' ? timeStr : `${provider} · ${latencyMs} ms`;

    entry.innerHTML = `
      <div class="msg-meta">
        <span class="msg-sender">${sender}</span>
        <span>${metaRight}</span>
      </div>
      <div class="msg-body"><p>${formatDisplayHtml(text)}</p></div>
    `;

    streamContainer.prepend(entry);
  }

  // 9. Execute Query
  async function submitQuery(rawQuery) {
    const query = (rawQuery || '').trim();
    if (!query || state.isProcessing) return;

    state.isProcessing = true;
    if (voiceStateBadge) voiceStateBadge.textContent = 'ELABORAZIONE...';
    commandInput.value = '';

    appendStreamMessage({
      role: 'user',
      sender: 'TU',
      text: query
    });

    const data = await runStandaloneOnDeviceQuery(query);

    state.isProcessing = false;
    state.requestCount += 1;
    updatePersonaBadge();

    if (telemetryLatency) {
      telemetryLatency.textContent = `${state.requestCount} req · ${data.latencyMs || 4} ms`;
    }

    if (data.taskAction) {
      if (data.taskAction.type === 'MEMORY_ADD') {
        state.memory.unshift({ id: 'm_' + Date.now(), text: data.taskAction.content });
        saveAndRenderMemory();
      } else {
        state.tasks.unshift({ id: 't_' + Date.now(), text: data.taskAction.content, done: false });
        saveAndRenderTasks();
      }
      syncStateToNative();
    }

    const senderName =
      state.persona === 'jarvis' ? 'J.A.R.V.I.S.' : state.persona === 'edith' ? 'E.D.I.T.H.' : 'D.O.O.M.';

    appendStreamMessage({
      role: 'assistant',
      sender: senderName,
      text: data.display || data.speech,
      provider: data.provider || 'Locale',
      latencyMs: data.latencyMs || 4
    });

    speakText(data.speech);
  }

  commandForm.addEventListener('submit', (e) => {
    e.preventDefault();
    submitQuery(commandInput.value);
  });

  // 10. 1-Click Siri Config
  const siriWebhookPreview = document.getElementById('siriWebhookPreview');

  function triggerOneClickSiri(mode) {
    const urlStr = mode === 'ask' ? 'doomai://ask?q=' : 'doomai://voice';
    navigator.clipboard?.writeText(urlStr);
    if (siriWebhookPreview) {
      siriWebhookPreview.textContent = `Collegamento copiato: ${urlStr}\nApertura Comandi Rapidi...\nTocca '+' -> Aggiungi Azione 'Apri URL' -> Incolla e salva!`;
    }
    if (!postToNativeBridge({ action: 'openShortcutsApp' })) {
      window.location.href = 'shortcuts://create-shortcut';
    }
  }

  document.getElementById('btnSiriOneClickVoice')?.addEventListener('click', () => triggerOneClickSiri('voice'));
  document.getElementById('btnSiriOneClickAsk')?.addEventListener('click', () => triggerOneClickSiri('ask'));

  document.getElementById('btnTestSiriVoiceUrl')?.addEventListener('click', () => {
    window.onDoomNativeEvent({ type: 'siriUrlQuery', mode: 'voice' });
  });

  document.getElementById('btnTestSiriWebhook')?.addEventListener('click', async () => {
    const json = await runStandaloneOnDeviceQuery(state.persona);
    if (siriWebhookPreview) siriWebhookPreview.textContent = json.speech;
    speakText(json.speech);
  });

  // 11. Engine & API Vault Configuration
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
    syncStateToNative();
    const statusEl = document.getElementById('saveConfigStatus');
    if (statusEl) {
      statusEl.textContent = 'Chiavi API salvate!';
      setTimeout(() => {
        statusEl.textContent = '';
      }, 3000);
    }
  });

  // 12. Tasks & Memory
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
        syncStateToNative();
      });
    });

    container.querySelectorAll('[data-del-task]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-del-task');
        state.tasks = state.tasks.filter((x) => x.id !== id);
        saveAndRenderTasks();
        syncStateToNative();
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
        syncStateToNative();
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
    syncStateToNative();
  });

  document.getElementById('addMemoryForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('newMemoryInput');
    const val = input.value.trim();
    if (!val) return;
    state.memory.unshift({ id: 'm_' + Date.now(), text: val });
    input.value = '';
    saveAndRenderMemory();
    syncStateToNative();
  });

  // 13. Mini-Configuratore Griglia Stile Home iOS
  function initIOSGridConfigurator() {
    const DEFAULT_GRID = {
      order: ['head', 'controls', 'telemetry', 'console'],
      spans: { head: 2, controls: 2, telemetry: 2, console: 2 },
      hidden: [],
      fontScale: 'md',
      headScale: 'md'
    };

    const WIDGET_NAMES = {
      head: 'Nucleo 3D',
      controls: 'Modalità AI',
      telemetry: 'Info Tecniche',
      console: 'Console'
    };

    let layout = (() => {
      try {
        const saved = JSON.parse(localStorage.getItem('doom_grid_layout_v1') || 'null');
        if (saved && Array.isArray(saved.order)) {
          return {
            ...DEFAULT_GRID,
            ...saved,
            order: saved.order.filter((x) => x !== 'presets')
          };
        }
      } catch (_) {}
      return { ...DEFAULT_GRID, spans: { ...DEFAULT_GRID.spans }, hidden: [] };
    })();

    const gridEl = document.getElementById('iosWidgetGrid');
    const btnEdit = document.getElementById('btnToggleGridEdit');
    const hiddenPillsEl = document.getElementById('hiddenWidgetsPills');

    function saveAndApplyGrid() {
      localStorage.setItem('doom_grid_layout_v1', JSON.stringify(layout));

      layout.order.forEach((id) => {
        const w = gridEl.querySelector(`[data-widget-id="${id}"]`);
        if (w) gridEl.appendChild(w);
      });

      gridEl.querySelectorAll('.hud-widget').forEach((w) => {
        const id = w.getAttribute('data-widget-id');
        const span = layout.spans[id] === 1 ? 1 : 2;
        w.setAttribute('data-span', String(span));
        w.classList.toggle('widget-hidden', layout.hidden.includes(id));
        const spanBtn = w.querySelector('[data-act="span"]');
        if (spanBtn) spanBtn.textContent = span === 1 ? '1×' : '2×';
      });

      document.querySelectorAll('#fontScaleGroup .seg-btn').forEach((b) => {
        b.classList.toggle('active', b.getAttribute('data-font') === layout.fontScale);
      });
      document.querySelectorAll('#headScaleGroup .seg-btn').forEach((b) => {
        b.classList.toggle('active', b.getAttribute('data-head') === layout.headScale);
      });

      if (hiddenPillsEl) {
        hiddenPillsEl.innerHTML = layout.hidden
          .map((id) => `<button type="button" class="ota-mini-btn" data-restore-id="${id}">+ ${WIDGET_NAMES[id] || id}</button>`)
          .join('');
        hiddenPillsEl.querySelectorAll('[data-restore-id]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const rid = btn.getAttribute('data-restore-id');
            layout.hidden = layout.hidden.filter((x) => x !== rid);
            saveAndApplyGrid();
          });
        });
      }

      calibrateDynamicViewport();
    }

    if (btnEdit) {
      btnEdit.addEventListener('click', () => {
        const isEditing = document.body.classList.toggle('grid-edit-mode');
        btnEdit.classList.toggle('active', isEditing);
        btnEdit.textContent = isEditing ? 'Fine' : 'Modifica Griglia';
      });
    }

    document.querySelectorAll('#fontScaleGroup .seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        layout.fontScale = btn.getAttribute('data-font') || 'md';
        saveAndApplyGrid();
      });
    });

    document.querySelectorAll('#headScaleGroup .seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        layout.headScale = btn.getAttribute('data-head') || 'md';
        saveAndApplyGrid();
      });
    });

    document.getElementById('btnResetGridLayout')?.addEventListener('click', () => {
      layout = { ...DEFAULT_GRID, order: [...DEFAULT_GRID.order], spans: { ...DEFAULT_GRID.spans }, hidden: [] };
      saveAndApplyGrid();
    });

    gridEl?.querySelectorAll('.hud-widget').forEach((w) => {
      const id = w.getAttribute('data-widget-id');
      w.querySelectorAll('.we-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const act = btn.getAttribute('data-act');
          const idx = layout.order.indexOf(id);
          if (act === 'up' && idx > 0) {
            [layout.order[idx - 1], layout.order[idx]] = [layout.order[idx], layout.order[idx - 1]];
          } else if (act === 'down' && idx < layout.order.length - 1) {
            [layout.order[idx + 1], layout.order[idx]] = [layout.order[idx], layout.order[idx + 1]];
          } else if (act === 'span') {
            layout.spans[id] = layout.spans[id] === 1 ? 2 : 1;
          } else if (act === 'hide') {
            if (!layout.hidden.includes(id)) layout.hidden.push(id);
          }
          saveAndApplyGrid();
        });
      });
    });

    saveAndApplyGrid();
  }

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
  initIOSGridConfigurator();
  applyPersona(state.persona);
  btnToggleTts.textContent = `Voce: ${state.ttsEnabled ? 'ON' : 'OFF'}`;
  detectHardwareAPU();
  hydrateApiConfigForm();
  saveAndRenderTasks();
  saveAndRenderMemory();
  requestAnimationFrame(render3DFaceSatellites);
  checkInitialUrlQuery();
})();
