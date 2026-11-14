(() => {
  // Application State
  const state = {
    persona: localStorage.getItem('stark_persona') || 'jarvis',
    ttsEnabled: localStorage.getItem('stark_tts') !== 'false',
    isListening: false,
    isSpeaking: false,
    isProcessing: false,
    apuTelemetry: {
      engine: 'Apple Neural Engine / WebGPU Hybrid',
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
          { id: 'm2', text: 'Dispositivo primario: iPhone iOS con integrazione Siri & APU locale' }
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
    const cores = navigator.hardwareConcurrency || 6;
    let hasWebGpu = false;

    if ('gpu' in navigator) {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter) hasWebGpu = true;
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
      webgpu: hasWebGpu
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

  // 4. Animated 60fps Canvas Reactor
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

    const pulseRadius = 95 + Math.sin(phase * 2.5) * (state.isListening || state.isSpeaking ? 16 : 5);
    ctx.beginPath();
    ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
    ctx.fillStyle = isEdith ? 'rgba(251, 113, 133, 0.14)' : 'rgba(34, 211, 238, 0.14)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = primaryColor;
    ctx.stroke();

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

  // 5. Speech Synthesis (TTS in Italian — iOS Safari Compatible)
  function speakText(text) {
    if (!state.ttsEnabled || !('speechSynthesis' in window) || !text) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'it-IT';
      utterance.rate = state.persona === 'edith' ? 1.05 : 0.98;
      utterance.pitch = state.persona === 'edith' ? 1.03 : 0.94;

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
        'Su iOS puoi usare anche il microfono della tastiera (Dettatura Siri) o il comando "Ehi Siri".';
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

  // 7. Standalone Client-Side iOS Intelligence Engine (runs directly on iPhone when no server is used)
  async function runStandaloneOnDeviceQuery(query) {
    const startTime = Date.now();
    const persona = state.persona;
    const lower = query.toLowerCase();
    const cards = [];

    // A) Task / Memory Commands
    if (/^(aggiungi task|crea promemoria|ricordami di|aggiungi nota|memorizza che)/i.test(lower)) {
      const extracted = query
        .replace(/^(aggiungi task|crea promemoria|ricordami di|aggiungi nota|memorizza che)[:\s]*/i, '')
        .trim();
      const isMem = lower.includes('memorizza');
      const speech =
        persona === 'edith'
          ? `Ricevuto. Ho registrato nel database tattico del tuo iPhone: "${extracted}".`
          : `Certamente, Signore. Ho annotato "${extracted}" nella memoria locale del dispositivo.`;
      return {
        ok: true,
        persona,
        speech,
        display: speech,
        provider: `${state.apuTelemetry.engine} (On-Device Vault)`,
        latencyMs: Math.max(6, Date.now() - startTime),
        taskAction: { type: isMem ? 'MEMORY_ADD' : 'TASK_ADD', content: extracted },
        cards: [
          {
            category: isMem ? 'MEMORIA NEURALE AGGIORNATA' : 'NUOVO TASK OPERATIVO',
            title: extracted,
            summary: 'Salvato direttamente nella memoria persistente del tuo iPhone.'
          }
        ]
      };
    }

    // B) Live Weather via Open-Meteo directly from iPhone
    if (/\b(meteo|tempo|temperatura|piove|previsioni)\b/i.test(lower)) {
      const cityMatch =
        query.match(/(?:meteo|tempo|temperatura|previsioni)\s+(?:a|di|per|su|in)?\s*([a-zA-ZÀ-ÿ\s]{2,25})/i) || [];
      const targetCity = (cityMatch[1] || 'Roma').replace(/\b(oggi|domani|adesso|ora|live|in tempo reale)\b/gi, '').trim() || 'Roma';
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
            return {
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
          }
        }
      } catch (_) {}
    }

    // C) Local APU Math Co-Processor
    const cleanMath = query
      .toLowerCase()
      .replace(/quanto fa|calcola|risolvi|\?/g, ' ')
      .replace(/,/g, '.')
      .replace(/×|x(?=\s*\d)/g, '*')
      .replace(/÷/g, '/')
      .trim();
    if (/^[0-9+\-*/().\s]+$/.test(cleanMath) && /[+\-*/]/.test(cleanMath)) {
      try {
        const val = Function(`"use strict"; return (${cleanMath});`)();
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
            display: `### Calcolo Computazionale APU\n\n\`${cleanMath} = ${resNum}\``,
            provider: `${state.apuTelemetry.engine} (Math Co-Processor)`,
            latencyMs: 2,
            cards: [
              {
                category: 'CO-PROCESSORE MATEMATICO ON-DEVICE',
                title: `${cleanMath} = ${resNum}`,
                summary: 'Eseguito direttamente sull\'unità aritmetica locale dell\'iPhone a latenza zero.'
              }
            ]
          };
        }
      } catch (_) {}
    }

    // D) Direct Gemini API call if user configured a Gemini Key on iPhone
    if (state.apiConfig.geminiKey) {
      try {
        const sys =
          persona === 'edith'
            ? 'Sei E.D.I.T.H., assistente tattico di Tony Stark su iOS. Rispondi in italiano in modo diretto e preciso.'
            : 'Sei J.A.R.V.I.S., assistente AI di Tony Stark su iOS. Rispondi in italiano con stile elegante ("Agli ordini, Signore") e completo.';
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
          return {
            ok: true,
            persona,
            speech: reply.replace(/[#*`_~>-]/g, '').slice(0, 480),
            display: reply,
            provider: 'Google Gemini 2.5 Flash (Direct iOS)',
            latencyMs: Date.now() - startTime,
            cards: []
          };
        }
      } catch (_) {}
    }

    // E) Direct Wikipedia IT Live Search from iPhone
    const cleanTopic = query
      .replace(/^(chi è|chi era|cosa è|cos'è|che cos'è|parlami di|cerca|dimmi tutto su|informazioni su|spiegami|jarvis|edith)\s+/i, '')
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
                ? `Dossier ${summary.title} acquisito.`
                : `Agli ordini, Signore. Ho estratto il dossier verificato su ${summary.title}.`;
            return {
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
                    { label: 'Modalità', value: 'Standalone iOS' }
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
          }
        }
      } catch (_) {}
    }

    const fallbackSpeech =
      persona === 'edith'
        ? `Sistema E.D.I.T.H. attivo su iPhone per "${query}". Puoi chiedere qualsiasi dossier enciclopedico, meteo di qualsiasi città, calcoli o inserire una API Key nel tab Motore AI & APU.`
        : `Signore, ho analizzato "${query}" sull'APU locale del suo iPhone. Può chiedermi qualsiasi ricerca enciclopedica, meteo live, calcoli o inserire una chiave API nel pannello Motore AI & APU.`;
    return {
      ok: true,
      persona,
      speech: fallbackSpeech,
      display: fallbackSpeech,
      provider: state.apuTelemetry.engine,
      latencyMs: Date.now() - startTime,
      cards: []
    };
  }

  // 8. Markdown-lite Formatter & Stream Renderer
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

  // 9. Execute Query (Tries Backend Server first, automatically falls back to Standalone On-Device iOS Engine!)
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

    let data = null;
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
      if (response.ok) {
        data = await response.json();
      }
    } catch (_) {
      // Backend server not present (e.g. running on iPhone via GitHub Pages) -> use Standalone iOS Engine!
    }

    if (!data || !data.ok) {
      data = await runStandaloneOnDeviceQuery(query);
    }

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

  // 10. Siri Webhook Simulator & Native Swift Inspector
  const siriEndpointUrlDisplay = document.getElementById('siriEndpointUrlDisplay');
  const siriWebhookPreview = document.getElementById('siriWebhookPreview');
  const swiftCodeViewer = document.getElementById('swiftCodeViewer');

  if (siriEndpointUrlDisplay) {
    siriEndpointUrlDisplay.textContent = `${window.location.origin}/api/siri`;
  }

  document.getElementById('btnTestSiriWebhook').addEventListener('click', async () => {
    siriWebhookPreview.textContent = '// Simulazione risposta vocale Siri in corso...';
    const json = await runStandaloneOnDeviceQuery('Meteo Roma in tempo reale');
    siriWebhookPreview.textContent = JSON.stringify(json, null, 2);
    speakText(json.speech);
  });

  document.getElementById('btnCopyCurl').addEventListener('click', () => {
    const curlCmd = `curl -X POST "${window.location.origin}/api/siri" \\\n  -H "Content-Type: application/json" \\\n  -d '{"query": "Chi era Leonardo da Vinci?", "persona": "${state.persona}"}'`;
    navigator.clipboard?.writeText(curlCmd);
    siriWebhookPreview.textContent = `// Comando cURL copiato negli appunti:\n\n${curlCmd}`;
  });

  async function loadIosPackageFiles() {
    try {
      const res = await fetch('/api/ios-package');
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.files) {
          state.iosPackageFiles = data.files;
          const defaultFile = 'ios-native/SiriIntents/AskStarkIntent.swift';
          if (state.iosPackageFiles[defaultFile]) {
            swiftCodeViewer.textContent = state.iosPackageFiles[defaultFile];
          }
          return;
        }
      }
    } catch (_) {}
    swiftCodeViewer.textContent = '// Tutti i file Swift 6 sono presenti nella cartella ios-native/ del repository GitHub GoldenRose01/stark-os-ios-assistant.';
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
    localStorage.setItem('stark_api_config', JSON.stringify(state.apiConfig));
    const statusEl = document.getElementById('saveConfigStatus');
    statusEl.textContent = 'Configurazione salvata nel Vault locale.';
    setTimeout(() => {
      statusEl.textContent = '';
    }, 3000);
  });

  // 12. Tasks & Contextual Memory Management
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

  // Check if URL has ?q=... parameter (so iOS Siri Shortcuts can open the app directly with a voice query!)
  const urlParams = new URLSearchParams(window.location.search);
  const initialQuery = urlParams.get('q') || urlParams.get('query');
  const initialPersona = urlParams.get('persona');
  if (initialPersona) applyPersona(initialPersona);

  // Initialize Boot Sequence
  applyPersona(state.persona);
  btnToggleTts.textContent = `Voce AI: ${state.ttsEnabled ? 'ON' : 'OFF'}`;
  detectHardwareAPU();
  hydrateApiConfigForm();
  saveAndRenderTasks();
  saveAndRenderMemory();
  loadIosPackageFiles();
  requestAnimationFrame(renderReactor);

  if (initialQuery) {
    setTimeout(() => submitQuery(initialQuery), 300);
  } else {
    appendStreamMessage({
      role: 'assistant',
      sender: state.persona === 'edith' ? 'E.D.I.T.H. TACTICAL CORE' : 'J.A.R.V.I.S. AI CORE',
      text:
        state.persona === 'edith'
          ? 'Sistema tattico **E.D.I.T.H.** online su iOS. L\'acceleratore APU locale e il motore di ricerca live sono operativi anche senza server esterno.'
          : 'Bentornato, Signore. Tutti i sistemi **J.A.R.V.I.S.** sono online. L\'app funziona direttamente sull\'APU del suo iPhone anche senza cavi o PC.',
      cards: [
        {
          category: 'MODALITÀ STANDALONE iOS ATTIVA',
          title: 'Installabile su iPhone da Safari (Zero-Cavi / Zero-Sideloadly)',
          summary:
            'Su iPhone tocca il tasto Condividi di Safari -> "Aggiungi alla schermata Home" per installare STARK AI come App a tutto schermo, oppure passa parametri da Siri con ?q=LaTuaDomanda.',
          metrics: [
            { label: 'Motore iOS', value: 'Standalone + APU' },
            { label: 'Dati Live', value: 'Wikipedia + Meteo' },
            { label: 'Parametro Siri', value: '?q=Domanda' },
            { label: 'Voce', value: 'Italiano (it-IT)' }
          ]
        }
      ],
      provider: 'Stark Hybrid APU Core',
      latencyMs: 7
    });
  }
})();
