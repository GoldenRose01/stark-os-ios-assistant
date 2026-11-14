(() => {
  // Application State
  const state = {
    persona: localStorage.getItem('stark_persona') || 'jarvis',
    ttsEnabled: localStorage.getItem('stark_tts') !== 'false',
    isListening: false,
    isSpeaking: false,
    isProcessing: false,
    apuTelemetry: {
      engine: 'WebGPU / Neural APU Bridge',
      cores: navigator.hardwareConcurrency || 8,
      webgpu: false
    },
    apiConfig: JSON.parse(localStorage.getItem('stark_api_config') || '{}'),
    tasks: JSON.parse(
      localStorage.getItem('stark_tasks') ||
        JSON.stringify([
          { id: 't1', text: 'Configurare comando vocale "Ehi Siri, chiedi a Jarvis" su iOS', done: false },
          { id: 't2', text: 'Testare pre-elaborazione APU locale e query meteo in tempo reale', done: false }
        ])
    ),
    memory: JSON.parse(
      localStorage.getItem('stark_memory') ||
        JSON.stringify([
          { id: 'm1', text: 'Lingua operativa primaria: Italiano (sintesi vocale e dossier tecnici)' },
          { id: 'm2', text: 'Dispositivo primario: iOS con integrazione Siri Shortcuts & AppIntents' }
        ])
    ),
    iosPackageFiles: {}
  };

  // DOM Elements
  const bodyEl = document.body;
  const brandBadge = document.getElementById('brandBadge');
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
  const telemetryProvider = document.getElementById('telemetryProvider');
  const telemetryLatency = document.getElementById('telemetryLatency');

  // 1. Hardware APU / WebGPU / Apple Silicon Neural Engine Detection
  async function detectHardwareAPU() {
    const cores = navigator.hardwareConcurrency || 8;
    let gpuName = 'CPU / SIMD Vettoriale';
    let hasWebGpu = false;

    if ('gpu' in navigator) {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter) {
          hasWebGpu = true;
          const info = adapter.info || {};
          gpuName = info.description || info.vendor || 'WebGPU Hardware APU';
        }
      } catch (_) {}
    }

    const ua = navigator.userAgent || '';
    const isApple = /iPhone|iPad|Macintosh|Mac OS X/i.test(ua);
    const engineLabel = isApple
      ? `Apple Neural Engine / ${hasWebGpu ? 'Metal WebGPU' : 'ANE Bridge'} (${cores} Core)`
      : `${hasWebGpu ? 'WebGPU APU Attiva' : 'Co-Processore Locale'} (${cores} Core)`;

    state.apuTelemetry = {
      engine: engineLabel,
      cores,
      webgpu: hasWebGpu,
      gpuName
    };

    telemetryApu.textContent = engineLabel;
    const apuSummaryEl = document.getElementById('apuDeviceSummary');
    const metricWebGpu = document.getElementById('metricWebGpu');
    const metricCores = document.getElementById('metricCores');
    if (apuSummaryEl) apuSummaryEl.textContent = engineLabel;
    if (metricWebGpu) metricWebGpu.textContent = hasWebGpu ? 'Attivo (Hardware)' : 'Compatibile Fallback';
    if (metricCores) metricCores.textContent = `${cores} Logical Cores`;
  }

  // 2. Persona Switching (J.A.R.V.I.S. vs E.D.I.T.H.)
  function applyPersona(persona) {
    state.persona = persona === 'edith' ? 'edith' : 'jarvis';
    localStorage.setItem('stark_persona', state.persona);
    bodyEl.setAttribute('data-persona', state.persona);

    document.getElementById('btnPersonaJarvis').classList.toggle('active', state.persona === 'jarvis');
    document.getElementById('btnPersonaEdith').classList.toggle('active', state.persona === 'edith');

    if (state.persona === 'edith') {
      brandBadge.textContent = 'EDH';
      systemHeaderTitle.textContent = 'E.D.I.T.H. // STARK TACTICAL INTELLIGENCE NETWORK';
      systemHeaderSub.textContent = 'ASSETTO OTTICO AR + PONTE VOCALE SIRI iOS & ACCELERAZIONE APU';
      reactorPanelTitle.textContent = 'Reticolo Ottico E.D.I.T.H.';
      commandInput.placeholder = 'Inserisci bersaglio di ricerca per E.D.I.T.H. (dossier, meteo, calcoli, comandi Siri)...';
    } else {
      brandBadge.textContent = 'MK7';
      systemHeaderTitle.textContent = 'J.A.R.V.I.S. // STARK OS OMNI-ASSISTANT';
      systemHeaderSub.textContent = 'PROTOCOLLO VOCALE iOS SIRI + ACCELERAZIONE APU LOCALE & MULTI-API';
      reactorPanelTitle.textContent = 'Nucleo Vocale J.A.R.V.I.S.';
      commandInput.placeholder = 'Chiedi qualsiasi cosa a J.A.R.V.I.S. (ricerche web, dossier, meteo, calcoli, task)...';
    }
  }

  document.getElementById('btnPersonaJarvis').addEventListener('click', () => applyPersona('jarvis'));
  document.getElementById('btnPersonaEdith').addEventListener('click', () => applyPersona('edith'));

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

  // 4. Animated 60fps Canvas Reactor (Arc Reactor for J.A.R.V.I.S. / Optical Reticle for E.D.I.T.H.)
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
    const primaryColor = isEdith ? '#fb7185' : '#22d3ee';
    const secondaryColor = isEdith ? '#38bdf8' : '#f59e0b';
    const speedMultiplier = state.isListening || state.isSpeaking || state.isProcessing ? 2.6 : 1.0;
    phase += 0.018 * speedMultiplier;

    // Outer segmented tactical ring
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(phase * 0.5);
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 3;
    const segments = isEdith ? 6 : 12;
    for (let i = 0; i < segments; i++) {
      const startAngle = (i * 2 * Math.PI) / segments + 0.08;
      const endAngle = ((i + 0.65) * 2 * Math.PI) / segments;
      ctx.beginPath();
      ctx.arc(0, 0, 175, startAngle, endAngle);
      ctx.stroke();
    }
    ctx.restore();

    // Counter-rotating inner telemetry ring
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-phase * 0.85);
    ctx.strokeStyle = secondaryColor;
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const startAngle = (i * 2 * Math.PI) / 8;
      const endAngle = startAngle + 0.45;
      ctx.beginPath();
      ctx.arc(0, 0, 136, startAngle, endAngle);
      ctx.stroke();
    }
    ctx.restore();

    // Dynamic audio/processing pulse ring
    const pulseRadius =
      95 +
      Math.sin(phase * 2.5) * (state.isListening || state.isSpeaking ? 16 : 5);

    ctx.beginPath();
    ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
    ctx.fillStyle = isEdith ? 'rgba(251, 113, 133, 0.14)' : 'rgba(34, 211, 238, 0.14)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = primaryColor;
    ctx.stroke();

    // Core geometry (Triangle/Hexagon for E.D.I.T.H., Arc Core for J.A.R.V.I.S.)
    ctx.save();
    ctx.translate(cx, cy);
    if (isEdith) {
      ctx.rotate(Math.sin(phase * 0.7) * 0.2);
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-45, 0);
      ctx.lineTo(45, 0);
      ctx.moveTo(0, -45);
      ctx.lineTo(0, 45);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, 46, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(34, 211, 238, 0.26)';
      ctx.fill();
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();

    // Center readout label
    ctx.fillStyle = '#f1f5f9';
    ctx.font = '700 20px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = state.isListening
      ? 'MIC ON'
      : state.isProcessing
      ? 'SCAN...'
      : isEdith
      ? 'E.D.I.T.H.'
      : 'J.A.R.V.I.S.';
    ctx.fillText(label, cx, cy);

    requestAnimationFrame(renderReactor);
  }

  // 5. Speech Synthesis (TTS in Italian)
  function speakText(text) {
    if (!state.ttsEnabled || !('speechSynthesis' in window) || !text) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'it-IT';
      utterance.rate = state.persona === 'edith' ? 1.06 : 0.98;
      utterance.pitch = state.persona === 'edith' ? 1.04 : 0.92;

      const voices = window.speechSynthesis.getVoices();
      const itVoice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('it'));
      if (itVoice) utterance.voice = itVoice;

      utterance.onstart = () => {
        state.isSpeaking = true;
        voiceStateBadge.textContent = 'SINTESI VOCALE';
      };
      utterance.onend = () => {
        state.isSpeaking = false;
        voiceStateBadge.textContent = 'PRONTO';
      };
      utterance.onerror = () => {
        state.isSpeaking = false;
        voiceStateBadge.textContent = 'PRONTO';
      };

      window.speechSynthesis.speak(utterance);
    } catch (_) {}
  }

  btnToggleTts.addEventListener('click', () => {
    state.ttsEnabled = !state.ttsEnabled;
    localStorage.setItem('stark_tts', String(state.ttsEnabled));
    btnToggleTts.textContent = `Voce AI: ${state.ttsEnabled ? 'ON' : 'OFF'}`;
    if (!state.ttsEnabled && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      state.isSpeaking = false;
    }
  });

  // 6. Voice Recognition (Web Speech API)
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
      voiceStatusText.textContent = 'Parla ora... J.A.R.V.I.S. / E.D.I.T.H. sta acquisendo il segnale vocale.';
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
      voiceStatusText.textContent = 'Tocca il reattore o usa la barra comandi.';
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
    if (!recognition) {
      voiceStatusText.textContent =
        'Il browser attuale non espone WebSpeech API diretta: usa la barra comandi o il comando vocale "Ehi Siri" su iOS.';
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
  canvas.addEventListener('click', toggleMicrophone);

  // 7. Markdown-lite Formatter & Stream Renderer
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
                  <div class="dossier-cat">${c.category || 'DOSSIER INTELLIGENCE'}</div>
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

  // 8. Execute Query against Hybrid APU + Backend
  async function submitQuery(rawQuery) {
    const query = (rawQuery || '').trim();
    if (!query || state.isProcessing) return;

    state.isProcessing = true;
    voiceStateBadge.textContent = 'ELABORAZIONE';
    commandInput.value = '';

    appendStreamMessage({
      role: 'user',
      sender: 'COMANDO OPERATORE',
      text: query
    });

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          persona: state.persona,
          memory: state.memory,
          apiKeys: state.apiConfig,
          apuTelemetry: state.apuTelemetry
        })
      });

      const data = await response.json();
      state.isProcessing = false;
      voiceStateBadge.textContent = 'PRONTO';

      if (data.provider) telemetryProvider.textContent = data.provider;
      if (data.latencyMs) telemetryLatency.textContent = `${data.latencyMs} ms`;

      // Handle automatic task or memory additions triggered by natural language
      if (data.taskAction) {
        if (data.taskAction.type === 'MEMORY_ADD') {
          state.memory.unshift({ id: 'm_' + Date.now(), text: data.taskAction.content });
          saveAndRenderMemory();
        } else {
          state.tasks.unshift({ id: 't_' + Date.now(), text: data.taskAction.content, done: false });
          saveAndRenderTasks();
        }
      }

      appendStreamMessage({
        role: 'assistant',
        sender: state.persona === 'edith' ? 'E.D.I.T.H. TACTICAL CORE' : 'J.A.R.V.I.S. AI CORE',
        text: data.display || data.speech,
        cards: data.cards || [],
        provider: data.provider || 'Stark APU Core',
        latencyMs: data.latencyMs || 12
      });

      speakText(data.speech);
    } catch (err) {
      state.isProcessing = false;
      voiceStateBadge.textContent = 'ERRORE RETE';
      appendStreamMessage({
        role: 'assistant',
        sender: 'SISTEMA DIAGNOSTICO',
        text: `Anomalia di comunicazione col nodo locale: ${err.message}`,
        provider: 'Fallback APU',
        latencyMs: 4
      });
    }
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

  // 9. Siri Webhook Simulator & Native Swift Inspector
  const siriEndpointUrlDisplay = document.getElementById('siriEndpointUrlDisplay');
  const siriWebhookPreview = document.getElementById('siriWebhookPreview');
  const swiftCodeViewer = document.getElementById('swiftCodeViewer');

  if (siriEndpointUrlDisplay) {
    siriEndpointUrlDisplay.textContent = `${window.location.origin}/api/siri`;
  }

  document.getElementById('btnTestSiriWebhook').addEventListener('click', async () => {
    siriWebhookPreview.textContent = '// Invio richiesta vocale simulata da Siri a POST /api/siri...';
    try {
      const res = await fetch('/api/siri', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'Meteo Roma in tempo reale',
          persona: state.persona,
          apuTelemetry: {
            engine: 'iPhone 16 Pro — 16-Core Apple Neural Engine (Siri Shortcut)',
            cores: 6
          }
        })
      });
      const json = await res.json();
      siriWebhookPreview.textContent = JSON.stringify(json, null, 2);
      speakText(json.speech);
    } catch (e) {
      siriWebhookPreview.textContent = `Errore test Siri: ${e.message}`;
    }
  });

  document.getElementById('btnCopyCurl').addEventListener('click', () => {
    const curlCmd = `curl -X POST "${window.location.origin}/api/siri" \\\n  -H "Content-Type: application/json" \\\n  -d '{"query": "Chi era Leonardo da Vinci?", "persona": "${state.persona}"}'`;
    navigator.clipboard?.writeText(curlCmd);
    siriWebhookPreview.textContent = `// Comando cURL copiato negli appunti:\n\n${curlCmd}`;
  });

  async function loadIosPackageFiles() {
    try {
      const res = await fetch('/api/ios-package');
      const data = await res.json();
      if (data.ok && data.files) {
        state.iosPackageFiles = data.files;
        const defaultFile = 'ios-native/SiriIntents/AskStarkIntent.swift';
        if (state.iosPackageFiles[defaultFile]) {
          swiftCodeViewer.textContent = state.iosPackageFiles[defaultFile];
        }
      }
    } catch (_) {}
  }

  document.querySelectorAll('.swift-file-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.swift-file-btn').forEach((b) => b.classList.remove('btn-primary'));
      btn.classList.add('btn-primary');
      const key = btn.getAttribute('data-file');
      if (state.iosPackageFiles[key]) {
        swiftCodeViewer.textContent = state.iosPackageFiles[key];
      }
    });
  });

  // 10. Engine & API Vault Configuration
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
    localStorage.setItem('stark_api_config', JSON.stringify(state.apiConfig));
    const statusEl = document.getElementById('saveConfigStatus');
    statusEl.textContent = 'Configurazione salvata nel Vault locale.';
    setTimeout(() => {
      statusEl.textContent = '';
    }, 3000);
  });

  // 11. Tasks & Contextual Memory Management
  function saveAndRenderTasks() {
    localStorage.setItem('stark_tasks', JSON.stringify(state.tasks));
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
      });
    });

    container.querySelectorAll('[data-del-task]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-del-task');
        state.tasks = state.tasks.filter((x) => x.id !== id);
        saveAndRenderTasks();
      });
    });
  }

  function saveAndRenderMemory() {
    localStorage.setItem('stark_memory', JSON.stringify(state.memory));
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
  });

  document.getElementById('addMemoryForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('newMemoryInput');
    const val = input.value.trim();
    if (!val) return;
    state.memory.unshift({ id: 'm_' + Date.now(), text: val });
    input.value = '';
    saveAndRenderMemory();
  });

  // Initialize Boot Sequence
  applyPersona(state.persona);
  btnToggleTts.textContent = `Voce AI: ${state.ttsEnabled ? 'ON' : 'OFF'}`;
  detectHardwareAPU();
  hydrateApiConfigForm();
  saveAndRenderTasks();
  saveAndRenderMemory();
  loadIosPackageFiles();
  requestAnimationFrame(renderReactor);

  // Initial welcome dossier in stream
  appendStreamMessage({
    role: 'assistant',
    sender: state.persona === 'edith' ? 'E.D.I.T.H. TACTICAL CORE' : 'J.A.R.V.I.S. AI CORE',
    text:
      state.persona === 'edith'
        ? 'Sistema tattico **E.D.I.T.H.** online. L\'acceleratore APU locale e il ponte webhook per **Siri su iOS** (`/api/siri` + `AppIntents`) sono operativi. Seleziona un bersaglio di ricerca o premi sul reticolo ottico per parlare.'
        : 'Bentornato, Signore. Tutti i sistemi **J.A.R.V.I.S.** sono online. L\'unità computazionale APU del dispositivo è sincronizzata con il motore di ricerca live e con il ponte vocale **Siri su iOS**. Come posso assisterla oggi?',
    cards: [
      {
        category: 'STATO ARCHITETTURA IBRIDA',
        title: 'Siri iOS Bridge + On-Device APU + Multi-API Router',
        summary:
          'Puoi interrogare l\'assistente via voce o testo su qualsiasi argomento (enciclopedia live, meteo satellitare, calcoli, gestione task) oppure collegarlo a "Ehi Siri" tramite Comandi Rapidi o il codice nativo Swift 6 incluso nel tab "Siri & iOS Nativo".',
        metrics: [
          { label: 'Endpoint Siri', value: 'POST /api/siri' },
          { label: 'Codice Xcode', value: 'Swift 6 AppIntents' },
          { label: 'Pre-Processing', value: 'APU / WebGPU / ANE' },
          { label: 'Stato Voce', value: 'Italiano (it-IT)' }
        ]
      }
    ],
    provider: 'Stark Hybrid APU Core',
    latencyMs: 9
  });
})();
