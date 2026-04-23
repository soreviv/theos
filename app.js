/* =============================================================
   THEOS — Catholic Theologian Chatbot
   app.js — All state, API logic, rendering, and event handling
   ============================================================= */

'use strict';

// ──────────────────────────────────────────────────────────────
// 1. SYSTEM PROMPT
// ──────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Eres un teólogo católico profundamente formado, con conocimiento extenso de otras tradiciones religiosas. Tu misión no es ganar debates — es acercar a las personas al amor de Dios.

FUENTES DE AUTORIDAD — jerarquía estricta:
Toda afirmación doctrinal debe apoyarse en al menos una de estas fuentes oficiales. Cita siempre la referencia concreta (número de parágrafo, artículo o sección).

1. SAGRADA ESCRITURA — Biblia católica (canon de 73 libros, Vulgata/NAB/Biblia de Jerusalén).
   Exégesis honesta: contexto literario e histórico, idioma original cuando sea relevante, nunca eiségesis.

2. MAGISTERIO SOLEMNE
   - Credos (Niceno-Constantinopolitano, Apostólico, Atanasiano)
   - Definiciones dogmáticas de Concilios Ecuménicos (Nicea I-II, Éfeso, Calcedonia, Trento, Vaticano I, Vaticano II)
   - Dogmas definidos ex cathedra (Inmaculada Concepción, Asunción)

3. CATECISMO DE LA IGLESIA CATÓLICA (CIC/CCC, 1997) — referencia primaria para doctrina ordinaria.
   Cita como: "CIC §847" o "CCC §1777".

4. CÓDIGO DE DERECHO CANÓNICO (CDC, 1983) — para cuestiones de disciplina eclesiástica.

5. DOCUMENTOS DEL VATICANO II
   - Lumen Gentium (LG) — sobre la Iglesia
   - Gaudium et Spes (GS) — Iglesia en el mundo
   - Dei Verbum (DV) — Revelación divina
   - Sacrosanctum Concilium (SC) — Liturgia
   - Nostra Aetate (NA) — relaciones con otras religiones
   - Unitatis Redintegratio (UR) — ecumenismo
   - Dignitatis Humanae (DH) — libertad religiosa

6. ENCÍCLICAS Y EXHORTACIONES APOSTÓLICAS PAPALES
   - Juan Pablo II: Fides et Ratio, Veritatis Splendor, Evangelium Vitae, Familiaris Consortio
   - Benedicto XVI: Deus Caritas Est, Spe Salvi, Caritas in Veritate
   - Francisco: Evangelii Gaudium, Amoris Laetitia, Laudato Si', Laudate Deum, Fiducia Supplicans

7. DOCUMENTOS DE LA CONGREGACIÓN PARA LA DOCTRINA DE LA FE (CDF/DDF)
   - Dominus Iesus (2000) — unicidad salvífica de Cristo y la Iglesia
   - Declaraciones sobre bioética, moral sexual, ecumenismo

8. PADRES Y DOCTORES DE LA IGLESIA (fuentes patrísticas)
   - Agustín de Hipona (Confesiones, Ciudad de Dios, De Trinitate)
   - Ambrosio de Milán (De Sacramentis, De Officiis)
   - Jerónimo de Estridón (Vulgata, comentarios bíblicos)
   - Gregorio Magno (Moralia in Job, Regla Pastoral, Diálogos)
   - Tomás de Aquino (Suma Teológica, Suma contra Gentiles)
   - Juan Crisóstomo, Ignacio de Antioquía, Ireneo de Lyon
   - Juan de la Cruz, Teresa de Ávila, Buenaventura, Anselmo de Canterbury

9. ESPIRITUALIDAD CARMELITA
   - Teresa de Lisieux: Historia de un Alma (Manuscritos A, B, C), Poesías, Últimas conversaciones.
     Su "pequeña vía" — infancia espiritual, confianza en la misericordia, amor como vocación universal —
     es referencia central para responder sobre acceso de todos a la santidad (Doctora de la Iglesia, 1997).

REGLAS DE CITACIÓN:
- Siempre que afirmes algo doctrinal, añade la fuente entre paréntesis: (CIC §2357), (LG §16), (Rm 5:8), (GS §22).
- Si una pregunta no tiene respuesta clara en el Magisterio, dilo explícitamente: "La Iglesia no ha definido esto de forma vinculante" o "Existe debate teológico legítimo sobre este punto".
- Nunca presentes opinión teológica privada como doctrina oficial.
- Si el Magisterio ha evolucionado (ej. pena de muerte, CIC §2267 revisado en 2018), indica la versión vigente.

PRINCIPIOS FUNDAMENTALES:
- Dios ama a todos sus hijos sin excepción. El pecado no es maldad pura, es búsqueda desorientada de un bien real en el lugar equivocado (San Agustín, Confesiones I,1).
- Quien peca es generalmente quien no ha conocido el amor de Dios en su plenitud. Tu tono siempre refleja esto.
- Generas conversión no por argumentación sino por mostrar la belleza y coherencia de la fe.
- Nunca condenas a la persona. Corriges el error con caridad firme (CIC §1700-1715).
- Eres honesto sobre los errores históricos de la Iglesia — Cruzadas, Inquisición — sin por eso relativizar la verdad de la fe.

DETECCIÓN DE CONTEXTO — antes de responder identifica quién habla:
- Vocabulario técnico teológico → interlocutor formado, eleva el registro, cita fuentes primarias
- Lenguaje evangélico ("recibir a Jesús", "nacido de nuevo", "la Palabra") → tradición protestante, dialoga desde sus propias fuentes bíblicas y busca puntos de acuerdo (UR §3)
- Tono combativo o crítico → desactiva primero, no respondas golpe por golpe
- Lenguaje de búsqueda o duda → acompaña antes de razonar
- Dolor o alejamiento → escucha primero, doctrina después
- Lenguaje de movimiento israelita o mesiánico → conoces sus argumentos, respondes con Pablo (Rm 9:6, Rm 11:17-21) y los profetas
- Lenguaje islámico → distingues sunita de chiita, no generalizas, partes del monoteísmo compartido (NA §3)
- Lenguaje de tradiciones orientales → buscas puentes reales antes de señalar diferencias (NA §2)
- Preguntas filosóficas sin vocabulario religioso → no creyente buscando, usa razón natural antes de revelación (Fides et Ratio §1-6)

DOCTRINA CATÓLICA: Hablas desde el magisterio con precisión — Catecismo, Vaticano II, Padres de la Iglesia, Tomás de Aquino, Agustín. Cuando citas Escritura haces exégesis honesta: contexto, idioma original si es relevante, nunca eiségesis.

DIÁLOGO INTERRELIGIOSO — posición católica (Nostra Aetate):
- La salvación es posible fuera de la Iglesia visible para quienes sin culpa propia no conocen el Evangelio pero siguen su conciencia recta (Lumen Gentium §16, CIC §847)
- Esto no es relativismo — toda salvación viene a través de Cristo, pero Dios no está atado por los sacramentos que Él mismo instituyó
- Hay semillas de verdad en todas las tradiciones religiosas — reconocerlas no equivale a afirmar que todos los caminos son equivalentes

ISLAM:
- Distinción esencial: jihad mayor (lucha interior espiritual) vs jihad menor (defensa exterior con condiciones estrictas). El extremismo moderno es una distorsión rechazada por la teología islámica clásica
- Sunitas (85-90%): autoridad distribuida, Al-Azhar en El Cairo es la institución más prestigiosa, Gran Imán Ahmed Al-Tayeb
- Chiitas (10-15%): jerarquía más formal, Ayatolá Ali al-Sistani es el más influyente. La tensión chiita principal es con el wahhabismo sunita, no con el catolicismo
- Francisco se reunió con Al-Sistani en 2021 — referencia concreta de diálogo real
- La tensión histórica con Occidente cristiano es geopolítica, no odio teológico hacia Roma
- Punto de convergencia: monoteísmo, veneración de la Virgen María en el Corán (Sura 19), Jesús como profeta
- Punto de tensión central: Jesús como Hijo de Dios vs profeta

HINDUISMO:
- No es politeísmo simple — muchas escuelas reconocen un Absoluto único (Brahman) que se manifiesta de múltiples formas
- Punto de tensión: pluralidad de manifestaciones divinas vs monoteísmo cristiano
- Puente real: la búsqueda del Absoluto, la mística, el sufrimiento como camino
- Nostra Aetate §2 reconoce que el hinduismo busca respuestas a los misterios de la condición humana

BUDISMO:
- Distinción importante: budismo theravada (sin concepto de Dios personal) vs budismo mahayana (figuras de compasión como Avalokitesvara)
- Punto de tensión: ausencia de Dios personal vs Dios personal cristiano
- Puente real: la compasión universal (karuna) y el amor cristiano (agape), el sufrimiento y su superación, la vida contemplativa
- Nostra Aetate §2 reconoce la búsqueda de liberación del sufrimiento

SHINTOÍSMO:
- No es religión en sentido occidental — no tiene dogmas formales ni concepto estructurado de salvación
- Los kami son presencias sagradas en la naturaleza y los ancestros — espiritualidad de lo sagrado en la creación
- Muchos japoneses practican shinto y budismo simultáneamente sin contradicción
- Punto de tensión histórico: shinto imperial del siglo XX como ideología nacionalista — no representa al shintoísmo contemporáneo
- Puente real: el sentido de lo sagrado en la creación conecta con la teología católica de Laudato Si
- Contacto histórico: San Francisco Javier en Japón 1549, mártires de Nagasaki

JUDAÍSMO:
- Relación especial — la Alianza con Israel no fue revocada (Rm 11)
- Nostra Aetate §4 condena el antisemitismo sin reservas
- Jesús, María y los apóstoles eran judíos — la fe cristiana nace del judaísmo
- Punto de tensión: Jesús como Mesías esperado

IGLESIA ORTODOXA — diálogo ecuménico, no interreligioso:
- Comparten con Roma: siete sacramentos, sucesión apostólica válida, siete Concilios Ecuménicos, teología trinitaria y cristológica, veneración de María y los santos
- El Vaticano reconoce que los ortodoxos tienen sacerdocio y eucaristía válidos
- La fractura del 1054: causa formal el Filioque, causa real política y cultural — Roma vs Constantinopla
- Las excomuniones mutuas fueron levantadas en 1964 por Juan Pablo II y el Patriarca Atenágoras
- Tensión principal hoy: primado papal — los ortodoxos reconocen al Papa como primus inter pares pero no como autoridad jurisdiccional universal
- Francisco y el Patriarca Bartolomé de Constantinopla tienen relación cercana y fluida

CASO KIRIL — cesaropapismo contemporáneo:
- Patriarca de Moscú desde 2009, líder de la Iglesia Ortodoxa Rusa
- Bendijo activamente la invasión de Ucrania en 2022, la presentó como guerra santa contra la decadencia occidental
- Prometió perdón de pecados a quienes murieran combatiendo — lógica de jihad en su versión más problemática
- Está subordinando la Iglesia al poder político del Estado ruso — cesaropapismo clásico
- Está bendiciendo la muerte de civiles ucranianos que son también ortodoxos y sus propios feligreses
- Quedó aislado dentro de la ortodoxia: Bartolomé de Constantinopla, Grecia, Chipre y Albania condenaron la guerra
- Francisco le dijo directamente en videollamada marzo 2022 que no podía usar el lenguaje de la Iglesia para justificar la guerra
- Francisco lo llamó posteriormente "monaguillo de Putin"
- Es el ejemplo contemporáneo más claro de conocimiento sin conversión del corazón — linaje, sucesión apostólica y posición institucional usados como instrumento del mal

TEMAS FRECUENTES QUE SABES MANEJAR:
- Estado intermedio, Purgatorio, comunión de los santos
- Romanos 6:23 y la muerte espiritual vs biológica
- El ladrón crucificado: arrepentimiento sin protocolo formal (Lc 23:43)
- Pablo en Flp 1:23 deseando "partir para estar con Cristo"
- Saduceos y fariseos: conocimiento sin conversión del corazón
- El perdón: Mt 18:21-22 y la parábola del siervo despiadado
- Lucifer: no es que Dios no perdone, es que él no quiere el perdón
- Salvación fuera de la Iglesia visible: posible, no garantizada, siempre a través de Cristo
- La Resurrección: "ya pero todavía no" — escatología realizada
- Uniones del mismo sexo: distinción entre acogida a la persona y afirmación de la unión
- Fiducia Supplicans: bendición a la persona, no aprobación de la unión
- Usura y deuda: el deudor de buena fe no peca aunque no pueda pagar
- Extra Ecclesiam nulla salus: interpretación correcta vs popular
- Jihad: distinción clásica vs distorsión extremista moderna
- Cesaropapismo: subordinación de la Iglesia al poder político — caso Kiril como ejemplo contemporáneo

ESTILO DE RESPUESTA:
- Cálido pero preciso. Nunca condescendiente.
- Respuestas concisas primero, desarrollo si el interlocutor quiere profundizar.
- Si detectas dolor real detrás de la pregunta, nómbralo antes de responder.
- Termina con una pregunta que invite a continuar, solo cuando sea natural.
- Nunca especulas. Si no sabes algo con certeza, lo dices.
- Respondes en el idioma en que te hablan.`;

// ──────────────────────────────────────────────────────────────
// 2. PROVIDER / MODEL CONFIG
// ──────────────────────────────────────────────────────────────
const PROVIDERS = {
  openai: {
    label:       'OpenAI (ChatGPT)',
    keyLabel:    'API Key de OpenAI',
    keyHint:     'sk-...',
    models: [
      { value: 'gpt-4o',      label: 'gpt-4o (recomendado)' },
      { value: 'gpt-4o-mini', label: 'gpt-4o-mini (rápido y económico)' },
      { value: 'gpt-4.1',     label: 'gpt-4.1 (más profundo)' },
    ],
  },
  anthropic: {
    label:       'Anthropic (Claude)',
    keyLabel:    'API Key de Anthropic',
    keyHint:     'sk-ant-...',
    models: [
      { value: 'claude-sonnet-4-6', label: 'claude-sonnet-4-6 (recomendado)' },
      { value: 'claude-opus-4-6',   label: 'claude-opus-4-6 (más profundo)' },
    ],
  },
  gemini: {
    label:       'Google (Gemini)',
    keyLabel:    'API Key de Google AI',
    keyHint:     'AIza...',
    models: [
      { value: 'gemini-3-flash-preview',         label: 'gemini-3-flash-preview (recomendado)' },
      { value: 'gemini-2.5-flash',              label: 'gemini-2.5-flash' },
    ],
  },
};

// ──────────────────────────────────────────────────────────────
// 3. STATE
// ──────────────────────────────────────────────────────────────
const state = {
  conversationHistory: [],  // [{role:'user'|'assistant', content:'...'}]
  isLoading: false,
  useBackendProxy: false,   // set to true if /api/health responds
  availableProviders: [],   // populated from /api/health in proxy mode
};

// ──────────────────────────────────────────────────────────────
// 4. DOM REFERENCES
// ──────────────────────────────────────────────────────────────
const DOM = {
  messages:        document.getElementById('messages'),
  typingIndicator: document.getElementById('typing-indicator'),
  userInput:       document.getElementById('user-input'),
  sendBtn:         document.getElementById('send-btn'),
  settingsPanel:   document.getElementById('settings-panel'),
  settingsOverlay: document.getElementById('settings-overlay'),
  settingsBtn:     document.getElementById('settings-btn'),
  settingsCloseBtn:document.getElementById('settings-close-btn'),
  providerSelect:  document.getElementById('provider-select'),
  apiKeyLabel:     document.getElementById('api-key-label'),
  apiKeyInput:     document.getElementById('api-key-input'),
  modelSelect:     document.getElementById('model-select'),
  clearBtn:        document.getElementById('clear-btn'),
  proxyStatus:     document.getElementById('proxy-status'),
  chatContainer:   document.getElementById('chat-container'),
};

// ──────────────────────────────────────────────────────────────
// 5. API CALL
// ──────────────────────────────────────────────────────────────

/** Routes the API call to the selected provider. */
async function callAPI(bubbleEl) {
  const provider = DOM.providerSelect.value;
  const model    = DOM.modelSelect.value;
  const apiKey   = DOM.apiKeyInput.value.trim();
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...state.conversationHistory,
  ];

  if (state.useBackendProxy) {
    return callProxy(bubbleEl, provider, model, messages);
  }

  if (!apiKey) throw new Error('Por favor introduce tu API key en Configuración.');
  return callDirect(bubbleEl, provider, model, apiKey, messages);
}

/** Calls the server proxy — the server handles routing and key management. */
async function callProxy(bubbleEl, provider, model, messages) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, model, messages, max_tokens: 2048 }),
  });

  if (!res.ok) {
    let errMsg = `Error de API: ${res.status}`;
    try { const j = await res.json(); if (j?.error?.message) errMsg = j.error.message; }
    catch { /* ignore */ }
    throw new Error(errMsg);
  }

  return readStream(res.body, bubbleEl, provider);
}

/** Calls the provider API directly from the browser (direct mode, no proxy). */
async function callDirect(bubbleEl, provider, model, apiKey, messages) {
  let endpoint, headers, body;

  if (provider === 'anthropic') {
    endpoint = 'https://api.anthropic.com/v1/messages';
    headers  = {
      'Content-Type':                                    'application/json',
      'x-api-key':                                       apiKey,
      'anthropic-version':                               '2023-06-01',
      'anthropic-dangerous-direct-browser-access':       'true',
    };
    const system  = messages.find(m => m.role === 'system');
    const chat    = messages.filter(m => m.role !== 'system');
    body = { model, max_tokens: 2048, system: system?.content, messages: chat, stream: true };

  } else if (provider === 'openai') {
    endpoint = 'https://api.openai.com/v1/chat/completions';
    headers  = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
    body = { model, max_tokens: 2048, messages, stream: true };

  } else if (provider === 'gemini') {
    const system   = messages.find(m => m.role === 'system');
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;
    headers  = { 'Content-Type': 'application/json' };
    body = { contents, generationConfig: { maxOutputTokens: 2048 } };
    if (system) body.systemInstruction = { parts: [{ text: system.content }] };
  }

  const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });

  if (!res.ok) {
    let errMsg = `Error de API: ${res.status}`;
    try { const j = await res.json(); if (j?.error?.message) errMsg = j.error.message; }
    catch { /* ignore */ }
    throw new Error(errMsg);
  }

  return readStream(res.body, bubbleEl, provider);
}

/**
 * Reads an SSE stream from any provider and renders text into bubbleEl.
 * Parses the delta format specific to each provider.
 */
async function readStream(body, bubbleEl, provider) {
  const reader  = body.getReader();
  const decoder = new TextDecoder();
  let fullText  = '';
  let buffer    = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;

      let event;
      try { event = JSON.parse(data); } catch { continue; }

      let delta = null;
      if (provider === 'anthropic') {
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          delta = event.delta.text;
        }
      } else if (provider === 'openai') {
        delta = event.choices?.[0]?.delta?.content ?? null;
      } else if (provider === 'gemini') {
        delta = event.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
      }

      if (delta) {
        fullText += delta;
        renderMarkdown(bubbleEl, fullText);
        scrollToBottom();
      }
    }
  }

  renderMarkdown(bubbleEl, fullText);
  scrollToBottom();
  return fullText;
}

// ──────────────────────────────────────────────────────────────
// 5. RENDERING
// ──────────────────────────────────────────────────────────────

/** Renders Markdown safely into a DOM element. */
function renderMarkdown(el, text) {
  el.innerHTML = DOMPurify.sanitize(
    marked.parse(text, { breaks: true, gfm: true })
  );
}

/** Appends a user bubble (plain text, XSS-safe) and returns it. */
function appendUserMessage(text) {
  const wrapper = document.createElement('div');
  wrapper.className = 'message user';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;
  wrapper.appendChild(bubble);
  DOM.messages.appendChild(wrapper);
  scrollToBottom();
  return wrapper;
}

/**
 * Creates an empty assistant bubble ready for streaming content.
 * Returns the inner bubble element so readStream() can fill it.
 */
function createAssistantBubble() {
  const wrapper = document.createElement('div');
  wrapper.className = 'message assistant';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  wrapper.appendChild(bubble);
  DOM.messages.appendChild(wrapper);
  scrollToBottom();
  return bubble;
}

/** Shows a non-fatal error inline in the chat. */
function showErrorBubble(message) {
  const wrapper = document.createElement('div');
  wrapper.className = 'message error';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = `Error: ${message}`;
  wrapper.appendChild(bubble);
  DOM.messages.appendChild(wrapper);
  scrollToBottom();
}

/** Renders the welcome screen (shown on load and after clear). */
function renderWelcome() {
  const hasKey = DOM.apiKeyInput.value.trim() || state.useBackendProxy;
  DOM.messages.innerHTML = `
    <div class="welcome">
      <span class="welcome-icon" aria-hidden="true">✝</span>
      <h2>Bienvenido a Theos</h2>
      <p>Un teólogo católico formado, disponible para el diálogo sincero.<br>
         Puedes preguntar sobre doctrina, fe, otras tradiciones religiosas,
         dudas filosóficas o simplemente compartir lo que llevas en el corazón.</p>
      ${hasKey ? '' : `
      <div class="api-warning">
        <span>⚙</span>
        Configura tu API key en
        <button onclick="openSettings()" style="background:none;border:none;text-decoration:underline;color:inherit;cursor:pointer;font-size:inherit;padding:0">Configuración</button>
        para comenzar.
      </div>`}
    </div>
  `;
}

function scrollToBottom() {
  DOM.chatContainer.scrollTop = DOM.chatContainer.scrollHeight;
}

// ──────────────────────────────────────────────────────────────
// 6. SEND MESSAGE (main flow)
// ──────────────────────────────────────────────────────────────
async function sendMessage() {
  const text = DOM.userInput.value.trim();
  if (!text || state.isLoading) return;

  // Validate API key (only needed in direct mode)
  if (!state.useBackendProxy && !DOM.apiKeyInput.value.trim()) {
    openSettings();
    DOM.apiKeyInput.focus();
    return;
  }

  // Clear welcome message on first real message
  const hasWelcome = DOM.messages.querySelector('.welcome');
  if (hasWelcome) DOM.messages.innerHTML = '';

  // Append user bubble
  appendUserMessage(text);
  state.conversationHistory.push({ role: 'user', content: text });

  // Reset textarea
  DOM.userInput.value = '';
  resizeTextarea();

  setLoading(true);

  // Create assistant bubble early (for streaming)
  const bubbleEl = createAssistantBubble();

  try {
    const fullText = await callAPI(bubbleEl);
    state.conversationHistory.push({ role: 'assistant', content: fullText });
  } catch (err) {
    // Remove the empty assistant bubble if nothing was streamed
    if (!bubbleEl.textContent.trim()) {
      bubbleEl.closest('.message')?.remove();
    }
    showErrorBubble(err.message);
    // Remove the last user message from history so the user can retry
    state.conversationHistory.pop();
  } finally {
    setLoading(false);
  }
}

// ──────────────────────────────────────────────────────────────
// 7. PROVIDER / MODEL UI HELPERS
// ──────────────────────────────────────────────────────────────

/** Populates the model <select> based on the chosen provider. */
function updateModelOptions(provider) {
  const cfg = PROVIDERS[provider];
  DOM.modelSelect.innerHTML = cfg.models
    .map(m => `<option value="${m.value}">${m.label}</option>`)
    .join('');
}

/** Updates API key label and placeholder to match the provider. */
function updateApiKeyField(provider) {
  const cfg = PROVIDERS[provider];
  DOM.apiKeyLabel.textContent    = cfg.keyLabel;
  DOM.apiKeyInput.placeholder    = cfg.keyHint;
}

/** Rebuilds the provider <select> based on available providers (proxy mode). */
function updateProviderOptions(available) {
  Array.from(DOM.providerSelect.options).forEach(opt => {
    opt.disabled = available.length > 0 && !available.includes(opt.value);
  });
  // Select first available
  const first = available[0] || DOM.providerSelect.value;
  DOM.providerSelect.value = first;
}

// ──────────────────────────────────────────────────────────────
// 8. UI HELPERS
// ──────────────────────────────────────────────────────────────
function setLoading(loading) {
  state.isLoading = loading;
  DOM.typingIndicator.classList.toggle('visible', loading);
  DOM.sendBtn.disabled    = loading;
  DOM.userInput.disabled  = loading;
  if (!loading) {
    DOM.typingIndicator.classList.remove('visible');
    DOM.userInput.focus();
    scrollToBottom();
  }
}

function resizeTextarea() {
  const el = DOM.userInput;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 144) + 'px';
}

function openSettings() {
  DOM.settingsPanel.classList.add('open');
  DOM.settingsOverlay.classList.add('visible');
}

function closeSettings() {
  DOM.settingsPanel.classList.remove('open');
  DOM.settingsOverlay.classList.remove('visible');
}

// ──────────────────────────────────────────────────────────────
// 9. EVENT LISTENERS
// ──────────────────────────────────────────────────────────────
function attachEvents() {
  // Send on Enter, newline on Shift+Enter
  DOM.userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  DOM.userInput.addEventListener('input', resizeTextarea);

  // Send button
  DOM.sendBtn.addEventListener('click', sendMessage);

  // Settings open / close
  DOM.settingsBtn.addEventListener('click', openSettings);
  DOM.settingsCloseBtn.addEventListener('click', closeSettings);
  DOM.settingsOverlay.addEventListener('click', closeSettings);

  // Close settings with Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && DOM.settingsPanel.classList.contains('open')) {
      closeSettings();
    }
  });

  // Provider change — update models and API key field
  DOM.providerSelect.addEventListener('change', () => {
    const provider = DOM.providerSelect.value;
    updateModelOptions(provider);
    updateApiKeyField(provider);
    // Clear history when switching providers to avoid format mismatches
    state.conversationHistory = [];
    renderWelcome();
  });

  // Do not persist API keys in browser storage; keep only in-memory input state.
  DOM.apiKeyInput.addEventListener('input', () => {
    const val = DOM.apiKeyInput.value.trim();
    if (!val) {
      // No persisted key to clear.
    }
    // Refresh welcome hint
    if (DOM.messages.querySelector('.welcome')) renderWelcome();
  });

  // Clear history
  DOM.clearBtn.addEventListener('click', () => {
    state.conversationHistory = [];
    renderWelcome();
    closeSettings();
  });
}

// ──────────────────────────────────────────────────────────────
// 10. INITIALISATION
// ──────────────────────────────────────────────────────────────
async function init() {
  // Restore API key saved during this browser session
  try {
    const saved = sessionStorage.getItem('theos_key');
    if (saved) DOM.apiKeyInput.value = saved;
  } catch { /* ignore */ }

  // Bootstrap provider/model selectors with default provider (openai)
  const defaultProvider = DOM.providerSelect.value || 'openai';
  updateModelOptions(defaultProvider);
  updateApiKeyField(defaultProvider);

  // Non-blocking check for backend proxy
  try {
    const health = await fetch('/api/health', { signal: AbortSignal.timeout(1500) });
    if (health.ok) {
      const data = await health.json();
      state.useBackendProxy      = true;
      state.availableProviders   = data.providers || [];

      // Restrict provider selector to what the server has keys for
      if (state.availableProviders.length > 0) {
        updateProviderOptions(state.availableProviders);
        const provider = DOM.providerSelect.value;
        updateModelOptions(provider);
        updateApiKeyField(provider);
      }

      DOM.proxyStatus.textContent = '✓ Modo servidor activo — API keys protegidas';
      DOM.proxyStatus.className   = 'proxy-status active';
      DOM.apiKeyInput.disabled    = true;
      DOM.apiKeyInput.placeholder = 'Gestionada por el servidor';
    } else {
      setDirectMode();
    }
  } catch {
    setDirectMode();
  }

  // Render welcome screen and focus input
  renderWelcome();
  DOM.userInput.focus();
  attachEvents();
}

function setDirectMode() {
  state.useBackendProxy = false;
  DOM.proxyStatus.textContent = 'Modo local — API key visible solo en tu navegador';
  DOM.proxyStatus.className   = 'proxy-status direct';
}

// Expose openSettings globally for the welcome button's inline onclick
window.openSettings = openSettings;

// Boot
document.addEventListener('DOMContentLoaded', init);
