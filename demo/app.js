/**
 * LLM Advisor — Inference Streaming Studio
 * High-performance, zero-buffering OpenAI-compatible SSE streaming chat client.
 */

// --- State Management ---
const AppState = {
  endpoint: localStorage.getItem('llm_advisor_endpoint') || 'http://127.0.0.1:13370',
  selectedModel: localStorage.getItem('llm_advisor_model') || 'auto',
  customModel: localStorage.getItem('llm_advisor_custom_model') || '',
  mockMode: localStorage.getItem('llm_advisor_mock') === 'true',
  systemPrompt: localStorage.getItem('llm_advisor_system') || 'You are a helpful, brilliant AI assistant with deep software and engineering expertise.',
  temperature: parseFloat(localStorage.getItem('llm_advisor_temp') || '0.7'),
  maxTokens: parseInt(localStorage.getItem('llm_advisor_max_tokens') || '1024', 10),
  streamEnabled: localStorage.getItem('llm_advisor_stream') !== 'false',
  
  availableModels: [],
  serverState: 'unknown', // 'serving' | 'stopped' | 'starting' | 'error' | 'offline'
  primaryModel: null,

  sessions: [],
  currentSessionId: null,

  isStreaming: false,
  abortController: null,

  // Live inference metrics for active generation
  metrics: {
    startTime: 0,
    firstTokenTime: 0,
    tokens: 0,
    ttftMs: 0,
    speedTps: 0,
    totalDurationSec: 0,
  }
};

// --- DOM Elements ---
const DOM = {
  // Sidebar
  sidebar: document.getElementById('sidebar'),
  sidebarBackdrop: document.getElementById('sidebar-backdrop'),
  openSidebarBtn: document.getElementById('open-sidebar-btn'),
  closeSidebarBtn: document.getElementById('close-sidebar-btn'),
  newChatBtn: document.getElementById('new-chat-btn'),
  endpointInput: document.getElementById('endpoint-input'),
  checkHealthBtn: document.getElementById('check-health-btn'),
  connectionPill: document.getElementById('connection-pill'),
  connectionStatusText: document.getElementById('connection-status-text'),
  modelSelect: document.getElementById('model-select'),
  modelCount: document.getElementById('model-count'),
  customModelInput: document.getElementById('custom-model-input'),
  mockModeToggle: document.getElementById('mock-mode-toggle'),
  systemPromptInput: document.getElementById('system-prompt-input'),
  tempSlider: document.getElementById('temp-slider'),
  tempVal: document.getElementById('temp-val'),
  maxTokensSlider: document.getElementById('max-tokens-slider'),
  maxTokensVal: document.getElementById('max-tokens-val'),
  streamToggle: document.getElementById('stream-toggle'),
  sessionList: document.getElementById('session-list'),
  clearAllSessionsBtn: document.getElementById('clear-all-sessions-btn'),

  // Header & HUD
  activeModelDisplay: document.getElementById('active-model-display'),
  statSpeed: document.getElementById('stat-speed'),
  valSpeed: document.getElementById('val-speed'),
  statTtft: document.getElementById('stat-ttft'),
  valTtft: document.getElementById('val-ttft'),
  statTokens: document.getElementById('stat-tokens'),
  valTokens: document.getElementById('val-tokens'),
  clearChatBtn: document.getElementById('clear-chat-btn'),

  // Messages Area
  messagesContainer: document.getElementById('messages-container'),
  emptyState: document.getElementById('empty-state'),
  serverStatusBanner: document.getElementById('server-status-banner'),
  bannerTitle: document.getElementById('banner-title'),
  bannerMsg: document.getElementById('banner-msg'),
  messagesList: document.getElementById('messages-list'),

  // Input area
  streamingStatusBar: document.getElementById('streaming-status-bar'),
  streamTokensLive: document.getElementById('stream-tokens-live'),
  streamSpeedLive: document.getElementById('stream-speed-live'),
  chatForm: document.getElementById('chat-form'),
  promptInput: document.getElementById('prompt-input'),
  sendBtn: document.getElementById('send-btn'),
  stopBtn: document.getElementById('stop-btn'),
  footerEndpointDisplay: document.getElementById('footer-endpoint-display'),
};

// --- Marked & Highlight Configuration ---
marked.setOptions({
  breaks: true,
  gfm: true,
  highlight: function (code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value;
      } catch (e) {
        console.error(e);
      }
    }
    return hljs.highlightAuto(code).value;
  }
});

// Custom renderer to wrap code blocks with language tag and copy button
const renderer = new marked.Renderer();
renderer.code = function ({ text, lang }) {
  const language = (lang || 'text').toLowerCase();
  const highlighted = lang && hljs.getLanguage(language)
    ? hljs.highlight(text, { language }).value
    : hljs.highlightAuto(text).value;

  return `
    <div class="code-block-wrapper">
      <div class="code-block-header">
        <span>${language}</span>
        <button class="code-block-copy-btn" onclick="window.copyCodeFromButton(this)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          <span>Copy</span>
        </button>
      </div>
      <pre><code class="language-${language}">${highlighted}</code></pre>
    </div>
  `;
};
marked.use({ renderer });

// Global helper for code block copying
window.copyCodeFromButton = function (btn) {
  const codeEl = btn.closest('.code-block-wrapper').querySelector('code');
  if (!codeEl) return;
  navigator.clipboard.writeText(codeEl.textContent).then(() => {
    const span = btn.querySelector('span');
    const originalText = span.textContent;
    span.textContent = 'Copied!';
    btn.style.color = '#10b981';
    btn.style.borderColor = '#10b981';
    setTimeout(() => {
      span.textContent = originalText;
      btn.style.color = '';
      btn.style.borderColor = '';
    }, 1800);
  });
};

// Global helper for message copying
window.copyMessageText = function (btn, messageId) {
  const currentSession = getCurrentSession();
  if (!currentSession) return;
  const msg = currentSession.messages.find(m => m.id === messageId);
  if (!msg) return;

  navigator.clipboard.writeText(msg.content).then(() => {
    const originalHtml = btn.innerHTML;
    btn.innerHTML = `<span class="text-emerald-400 text-xs flex items-center gap-1"><i data-lucide="check" class="w-3.5 h-3.5"></i> Copied</span>`;
    lucide.createIcons();
    setTimeout(() => {
      btn.innerHTML = originalHtml;
      lucide.createIcons();
    }, 1800);
  });
};

// --- Initialization ---
function init() {
  loadStoredSessions();
  setupEventListeners();
  syncUIWithState();
  checkGatewayHealth();

  if (window.lucide) {
    lucide.createIcons();
  }
}

// --- LocalStorage & Session Management ---
function loadStoredSessions() {
  try {
    const saved = localStorage.getItem('llm_advisor_sessions');
    if (saved) {
      AppState.sessions = JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to parse sessions from localStorage:', e);
    AppState.sessions = [];
  }

  if (AppState.sessions.length === 0) {
    createNewSession(false);
  } else {
    AppState.currentSessionId = AppState.sessions[0].id;
  }
  renderSessionList();
  renderCurrentChat();
}

function saveSessions() {
  try {
    localStorage.setItem('llm_advisor_sessions', JSON.stringify(AppState.sessions));
  } catch (e) {
    console.warn('Storage quota exceeded or storage error:', e);
  }
}

function createNewSession(autoFocus = true) {
  const newSession = {
    id: 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    title: 'New Chat',
    createdAt: new Date().toISOString(),
    messages: []
  };
  AppState.sessions.unshift(newSession);
  AppState.currentSessionId = newSession.id;
  saveSessions();
  renderSessionList();
  renderCurrentChat();
  resetTelemetryHUD();

  if (autoFocus) {
    DOM.promptInput.focus();
  }
}

function getCurrentSession() {
  return AppState.sessions.find(s => s.id === AppState.currentSessionId) || AppState.sessions[0];
}

function deleteSession(sessionId, event) {
  if (event) event.stopPropagation();
  AppState.sessions = AppState.sessions.filter(s => s.id !== sessionId);
  if (AppState.sessions.length === 0) {
    createNewSession(false);
  } else if (AppState.currentSessionId === sessionId) {
    AppState.currentSessionId = AppState.sessions[0].id;
  }
  saveSessions();
  renderSessionList();
  renderCurrentChat();
  resetTelemetryHUD();
}

function clearAllSessions() {
  if (confirm('Clear all chat sessions and message history?')) {
    AppState.sessions = [];
    createNewSession(false);
  }
}

// --- Sync UI Controls ---
function syncUIWithState() {
  DOM.endpointInput.value = AppState.endpoint;
  DOM.footerEndpointDisplay.textContent = AppState.endpoint;
  DOM.mockModeToggle.checked = AppState.mockMode;
  DOM.systemPromptInput.value = AppState.systemPrompt;
  DOM.tempSlider.value = AppState.temperature;
  DOM.tempVal.textContent = AppState.temperature.toFixed(2);
  DOM.maxTokensSlider.value = AppState.maxTokens;
  DOM.maxTokensVal.textContent = AppState.maxTokens;
  DOM.streamToggle.checked = AppState.streamEnabled;
  DOM.customModelInput.value = AppState.customModel;

  updateModelUI();
}

// --- Gateway Health & Models Fetching ---
async function checkGatewayHealth() {
  if (AppState.mockMode) {
    setConnectionStatus('simulated', 'Simulated Mode');
    DOM.serverStatusBanner.classList.add('hidden');
    return;
  }

  setConnectionStatus('checking', 'Connecting...');

  try {
    const healthUrl = `${AppState.endpoint.replace(/\/+$/, '')}/healthz`;
    const res = await fetch(healthUrl, { method: 'GET', signal: AbortSignal.timeout(3000) });
    
    if (res.ok) {
      const data = await res.json();
      AppState.serverState = data.state || 'ok';
      AppState.primaryModel = data.primary_model || null;

      if (data.state === 'serving') {
        setConnectionStatus('online', `Serving: ${data.primary_model || 'model'}`);
        DOM.serverStatusBanner.classList.add('hidden');
      } else {
        setConnectionStatus('idle', `Online (${data.state})`);
        showServerBanner(
          'Gateway Online (No Model Serving)',
          `The Axum gateway is reachable on port 13370, but reports status "<strong>${data.state}</strong>". Start a model instance in LLM Advisor or enable Simulated Stream Mode to test UI streaming.`
        );
      }
      await fetchAvailableModels();
    } else {
      setConnectionStatus('error', `HTTP ${res.status}`);
      showServerBanner(
        'Gateway Responded with Error',
        `Endpoint ${healthUrl} returned status code ${res.status}.`
      );
    }
  } catch (err) {
    // Try checking if it's a raw llama-server or OpenAI-compatible server without /healthz
    try {
      const modelsUrl = `${AppState.endpoint.replace(/\/+$/, '')}/v1/models`;
      const resModels = await fetch(modelsUrl, { method: 'GET', signal: AbortSignal.timeout(2000) });
      if (resModels.ok) {
        setConnectionStatus('online', 'OpenAI API Online');
        DOM.serverStatusBanner.classList.add('hidden');
        await fetchAvailableModels();
        return;
      }
    } catch (_) {}

    AppState.serverState = 'offline';
    setConnectionStatus('offline', 'Offline');
    showServerBanner(
      'Gateway Not Reachable',
      `Cannot connect to <code>${AppState.endpoint}</code>. Ensure the desktop app or llama-server is started, or turn on <strong>Simulated Stream Mode</strong> in the sidebar to test immediately.`
    );
  }
}

async function fetchAvailableModels() {
  try {
    const modelsUrl = `${AppState.endpoint.replace(/\/+$/, '')}/v1/models`;
    const res = await fetch(modelsUrl, { method: 'GET', signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      AppState.availableModels = (data.data || []).map(m => m.id);
      updateModelDropdown();
    }
  } catch (e) {
    console.warn('Failed to fetch /v1/models:', e);
  }
}

function setConnectionStatus(status, text) {
  DOM.connectionStatusText.textContent = text;
  DOM.connectionPill.className = 'flex items-center gap-1 text-[11px] font-mono px-1.5 py-0.5 rounded border ';
  
  const dot = DOM.connectionPill.querySelector('span:first-child');

  if (status === 'online') {
    DOM.connectionPill.classList.add('bg-emerald-500/10', 'text-emerald-400', 'border-emerald-500/20');
    if (dot) dot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-400';
  } else if (status === 'idle') {
    DOM.connectionPill.classList.add('bg-yellow-500/10', 'text-yellow-400', 'border-yellow-500/20');
    if (dot) dot.className = 'w-1.5 h-1.5 rounded-full bg-yellow-400';
  } else if (status === 'simulated') {
    DOM.connectionPill.classList.add('bg-teal-500/10', 'text-teal-300', 'border-teal-500/20');
    if (dot) dot.className = 'w-1.5 h-1.5 rounded-full bg-teal-400';
  } else if (status === 'checking') {
    DOM.connectionPill.classList.add('bg-blue-500/10', 'text-blue-400', 'border-blue-500/20');
    if (dot) dot.className = 'w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse';
  } else {
    DOM.connectionPill.classList.add('bg-rose-500/10', 'text-rose-400', 'border-rose-500/20');
    if (dot) dot.className = 'w-1.5 h-1.5 rounded-full bg-rose-400';
  }
}

function showServerBanner(title, message) {
  DOM.bannerTitle.textContent = title;
  DOM.bannerMsg.innerHTML = message;
  DOM.serverStatusBanner.classList.remove('hidden');
}

function updateModelDropdown() {
  DOM.modelCount.textContent = `${AppState.availableModels.length} loaded`;
  
  // Save current selection
  const currentSelection = AppState.selectedModel;

  // Clear options except auto and custom
  DOM.modelSelect.innerHTML = `
    <option value="auto">Auto (active instance)</option>
  `;

  AppState.availableModels.forEach(modelId => {
    const opt = document.createElement('option');
    opt.value = modelId;
    opt.textContent = modelId;
    DOM.modelSelect.appendChild(opt);
  });

  const customOpt = document.createElement('option');
  customOpt.value = 'custom';
  customOpt.textContent = '-- Enter custom model ID --';
  DOM.modelSelect.appendChild(customOpt);

  if (AppState.availableModels.includes(currentSelection)) {
    DOM.modelSelect.value = currentSelection;
  } else if (currentSelection === 'custom') {
    DOM.modelSelect.value = 'custom';
  } else {
    DOM.modelSelect.value = 'auto';
  }

  updateModelUI();
}

function updateModelUI() {
  const val = DOM.modelSelect.value;
  if (val === 'custom') {
    DOM.customModelInput.classList.remove('hidden');
    DOM.activeModelDisplay.textContent = AppState.customModel || 'custom';
  } else if (val === 'auto') {
    DOM.customModelInput.classList.add('hidden');
    DOM.activeModelDisplay.textContent = AppState.primaryModel || (AppState.availableModels[0] || 'auto-detect');
  } else {
    DOM.customModelInput.classList.add('hidden');
    DOM.activeModelDisplay.textContent = val;
  }
}

function getActiveModelIdForRequest() {
  const sel = DOM.modelSelect.value;
  if (sel === 'custom') {
    return DOM.customModelInput.value.trim() || 'default-model';
  }
  if (sel === 'auto') {
    return AppState.primaryModel || (AppState.availableModels[0] || 'default');
  }
  return sel;
}

// --- Chat Rendering & Message Bubbles ---
function renderSessionList() {
  DOM.sessionList.innerHTML = '';
  
  AppState.sessions.forEach(session => {
    const isActive = session.id === AppState.currentSessionId;
    const item = document.createElement('div');
    item.className = `group flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer transition ${
      isActive 
        ? 'bg-card text-emerald-400 font-medium border border-borderSubtle' 
        : 'text-gray-400 hover:text-gray-200 hover:bg-card/50'
    }`;
    
    item.innerHTML = `
      <div class="flex items-center gap-2 truncate flex-1 mr-2">
        <i data-lucide="message-square" class="w-3.5 h-3.5 shrink-0 ${isActive ? 'text-emerald-400' : 'text-gray-500'}"></i>
        <span class="truncate">${escapeHtml(session.title || 'New Chat')}</span>
      </div>
      <button class="delete-session-btn opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 rounded transition" title="Delete chat">
        <i data-lucide="trash" class="w-3 h-3"></i>
      </button>
    `;

    item.addEventListener('click', () => {
      if (AppState.currentSessionId !== session.id) {
        AppState.currentSessionId = session.id;
        renderSessionList();
        renderCurrentChat();
        resetTelemetryHUD();
      }
    });

    const delBtn = item.querySelector('.delete-session-btn');
    delBtn.addEventListener('click', (e) => deleteSession(session.id, e));

    DOM.sessionList.appendChild(item);
  });

  if (window.lucide) {
    lucide.createIcons();
  }
}

function renderCurrentChat() {
  const session = getCurrentSession();
  if (!session || session.messages.length === 0) {
    DOM.emptyState.classList.remove('hidden');
    DOM.messagesList.innerHTML = '';
    return;
  }

  DOM.emptyState.classList.add('hidden');
  DOM.messagesList.innerHTML = '';

  session.messages.forEach(msg => {
    appendMessageDOM(msg, false);
  });

  scrollToBottom();
}

function appendMessageDOM(msg, isStreaming = false) {
  const isUser = msg.role === 'user';
  const msgEl = document.createElement('div');
  msgEl.id = `msg-${msg.id}`;
  msgEl.className = `flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`;

  if (isUser) {
    msgEl.innerHTML = `
      <div class="flex items-start gap-2.5 max-w-[85%]">
        <div class="bg-card border border-borderSubtle text-gray-100 px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed shadow-sm whitespace-pre-wrap font-sans">
          ${escapeHtml(msg.content)}
        </div>
        <div class="w-7 h-7 rounded-lg bg-borderSubtle flex items-center justify-center text-gray-300 shrink-0 text-xs font-semibold">
          U
        </div>
      </div>
    `;
  } else {
    const rawHtml = marked.parse(msg.content || '');
    const cursorClass = isStreaming ? 'streaming-cursor' : '';

    let telemetryHtml = '';
    if (msg.metrics && !isStreaming) {
      telemetryHtml = `
        <div class="flex items-center gap-3 text-[11px] font-mono text-gray-500 mt-2 pt-1 border-t border-borderSubtle/50">
          <span class="text-emerald-400 font-medium">⚡ ${msg.metrics.speedTps.toFixed(1)} t/s</span>
          <span>•</span>
          <span>${msg.metrics.tokens} tokens</span>
          <span>•</span>
          <span>TTFT: ${msg.metrics.ttftMs}ms</span>
          <span>•</span>
          <span>Total: ${msg.metrics.totalDurationSec.toFixed(2)}s</span>
          <button onclick="window.copyMessageText(this, '${msg.id}')" class="ml-auto hover:text-gray-300 flex items-center gap-1 transition">
            <i data-lucide="copy" class="w-3 h-3"></i>
            <span>Copy</span>
          </button>
        </div>
      `;
    }

    msgEl.innerHTML = `
      <div class="flex items-start gap-3 w-full">
        <div class="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
          <i data-lucide="bot" class="w-4 h-4"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="bg-surface/60 border border-borderSubtle rounded-2xl rounded-tl-sm p-4 text-sm text-gray-200 shadow-sm">
            <div class="markdown-body ${cursorClass}" id="content-${msg.id}">
              ${rawHtml}
            </div>
            <div id="telemetry-${msg.id}">
              ${telemetryHtml}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  DOM.messagesList.appendChild(msgEl);

  if (window.lucide) {
    lucide.createIcons();
  }

  return msgEl;
}

function updateStreamingMessageContent(msgId, content, isComplete = false, metrics = null) {
  const contentEl = document.getElementById(`content-${msgId}`);
  if (contentEl) {
    contentEl.innerHTML = marked.parse(content);
    if (isComplete) {
      contentEl.classList.remove('streaming-cursor');
    } else {
      contentEl.classList.add('streaming-cursor');
    }
  }

  if (isComplete && metrics) {
    const telemEl = document.getElementById(`telemetry-${msgId}`);
    if (telemEl) {
      telemEl.innerHTML = `
        <div class="flex items-center gap-3 text-[11px] font-mono text-gray-500 mt-2 pt-1 border-t border-borderSubtle/50">
          <span class="text-emerald-400 font-medium">⚡ ${metrics.speedTps.toFixed(1)} t/s</span>
          <span>•</span>
          <span>${metrics.tokens} tokens</span>
          <span>•</span>
          <span>TTFT: ${metrics.ttftMs}ms</span>
          <span>•</span>
          <span>Total: ${metrics.totalDurationSec.toFixed(2)}s</span>
          <button onclick="window.copyMessageText(this, '${msgId}')" class="ml-auto hover:text-gray-300 flex items-center gap-1 transition">
            <i data-lucide="copy" class="w-3 h-3"></i>
            <span>Copy</span>
          </button>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
    }
  }

  scrollToBottom();
}

function scrollToBottom() {
  DOM.messagesContainer.scrollTop = DOM.messagesContainer.scrollHeight;
}

// --- Inference Dispatch & SSE Streaming Handler ---
async function handleChatSubmit(e) {
  if (e) e.preventDefault();
  if (AppState.isStreaming) return;

  const promptText = DOM.promptInput.value.trim();
  if (!promptText) return;

  DOM.promptInput.value = '';
  adjustTextareaHeight(DOM.promptInput);
  DOM.emptyState.classList.add('hidden');

  const session = getCurrentSession();
  
  // Set session title from first message
  if (session.messages.length === 0) {
    session.title = promptText.substring(0, 32) + (promptText.length > 32 ? '...' : '');
    renderSessionList();
  }

  // 1. Append User Message
  const userMsg = {
    id: 'msg_' + Date.now() + '_u',
    role: 'user',
    content: promptText,
    createdAt: new Date().toISOString()
  };
  session.messages.push(userMsg);
  appendMessageDOM(userMsg, false);
  scrollToBottom();

  // 2. Prepare Assistant Message Placeholder
  const assistantMsgId = 'msg_' + Date.now() + '_a';
  const assistantMsg = {
    id: assistantMsgId,
    role: 'assistant',
    content: '',
    createdAt: new Date().toISOString(),
    metrics: null
  };
  session.messages.push(assistantMsg);
  appendMessageDOM(assistantMsg, true);

  // 3. Prepare Request Payload
  const messagesPayload = [];
  if (AppState.systemPrompt.trim()) {
    messagesPayload.push({ role: 'system', content: AppState.systemPrompt.trim() });
  }
  session.messages.slice(0, -1).forEach(m => {
    messagesPayload.push({ role: m.role, content: m.content });
  });

  const modelToUse = getActiveModelIdForRequest();

  // Setup live telemetry state
  AppState.isStreaming = true;
  AppState.abortController = new AbortController();
  setStreamingUIState(true);

  AppState.metrics = {
    startTime: performance.now(),
    firstTokenTime: 0,
    tokens: 0,
    ttftMs: 0,
    speedTps: 0,
    totalDurationSec: 0,
  };

  try {
    if (AppState.mockMode) {
      await runSimulatedStreaming(assistantMsgId, promptText);
    } else {
      await runRealStreaming(assistantMsgId, messagesPayload, modelToUse);
    }
  } catch (err) {
    handleInferenceError(assistantMsgId, err);
  } finally {
    finishStreaming(assistantMsgId);
  }
}

// --- Live Real Inference SSE Streamer ---
async function runRealStreaming(assistantMsgId, messagesPayload, modelToUse) {
  const endpoint = AppState.endpoint.replace(/\/+$/, '');
  const url = `${endpoint}/v1/chat/completions`;

  const requestBody = {
    model: modelToUse,
    messages: messagesPayload,
    temperature: AppState.temperature,
    max_tokens: AppState.maxTokens,
    stream: AppState.streamEnabled
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': AppState.streamEnabled ? 'text/event-stream' : 'application/json',
    },
    body: JSON.stringify(requestBody),
    signal: AppState.abortController.signal,
  });

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status} (${response.statusText})`;
    try {
      const errJson = await response.json();
      if (errJson.error && errJson.error.message) {
        errorDetail = errJson.error.message;
      }
    } catch (_) {}
    throw new Error(errorDetail);
  }

  // If user disabled streaming in settings, parse standard JSON response
  if (!AppState.streamEnabled) {
    const json = await response.json();
    const content = json.choices?.[0]?.message?.content || '';
    const session = getCurrentSession();
    const msg = session.messages.find(m => m.id === assistantMsgId);
    if (msg) msg.content = content;

    const totalTime = (performance.now() - AppState.metrics.startTime) / 1000;
    const estTokens = Math.max(1, Math.round(content.length / 4));
    AppState.metrics.tokens = estTokens;
    AppState.metrics.ttftMs = Math.round(totalTime * 1000);
    AppState.metrics.totalDurationSec = totalTime;
    AppState.metrics.speedTps = estTokens / Math.max(0.001, totalTime);

    updateStreamingMessageContent(assistantMsgId, content, true, AppState.metrics);
    return;
  }

  // Zero-Buffering SSE Stream Reader
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullContent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || ''; // keep leftover partial chunk in buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(':')) continue; // skip comments and heartbeats

      if (trimmed.startsWith('data: ')) {
        const dataStr = trimmed.substring(6).trim();

        if (dataStr === '[DONE]') {
          // Streaming completed normally
          break;
        }

        try {
          const parsed = JSON.parse(dataStr);
          
          // Check for token delta
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            if (AppState.metrics.firstTokenTime === 0) {
              AppState.metrics.firstTokenTime = performance.now();
              AppState.metrics.ttftMs = Math.round(AppState.metrics.firstTokenTime - AppState.metrics.startTime);
            }

            fullContent += delta;
            AppState.metrics.tokens++;

            // Update live metrics
            const elapsedSinceFirstToken = (performance.now() - AppState.metrics.firstTokenTime) / 1000;
            if (elapsedSinceFirstToken > 0) {
              AppState.metrics.speedTps = AppState.metrics.tokens / elapsedSinceFirstToken;
            }

            updateLiveTelemetryDisplay();

            // Update DOM content
            const session = getCurrentSession();
            const msg = session.messages.find(m => m.id === assistantMsgId);
            if (msg) msg.content = fullContent;
            updateStreamingMessageContent(assistantMsgId, fullContent, false);
          }

          // Check if llama-server provided native timings in chunk
          if (parsed.timings) {
            if (parsed.timings.predicted_per_second) {
              AppState.metrics.speedTps = parsed.timings.predicted_per_second;
            }
            if (parsed.timings.predicted_n) {
              AppState.metrics.tokens = parsed.timings.predicted_n;
            }
          }

        } catch (jsonErr) {
          console.warn('Could not parse SSE chunk JSON:', dataStr, jsonErr);
        }
      }
    }
  }

  // Flush remaining buffer
  if (buffer.trim() && buffer.startsWith('data: ')) {
    const dataStr = buffer.substring(6).trim();
    if (dataStr !== '[DONE]') {
      try {
        const parsed = JSON.parse(dataStr);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          fullContent += delta;
          AppState.metrics.tokens++;
        }
      } catch (_) {}
    }
  }

  const session = getCurrentSession();
  const msg = session.messages.find(m => m.id === assistantMsgId);
  if (msg) msg.content = fullContent;
}

// --- Simulated / Mock Streaming for Instant UI Testing ---
async function runSimulatedStreaming(assistantMsgId, prompt) {
  const simulatedResponses = [
    `### Grouped-Query Attention (GQA) & KV Cache Optimization

In standard **Multi-Head Attention (MHA)**, every attention query head has its own corresponding Key ($K$) and Value ($V$) head:
$$\\text{KV Cache Size} = 2 \\times n_{\\text{layers}} \\times n_{\\text{heads}} \\times d_{\\text{head}} \\times \\text{context}$$

With Grouped-Query Attention (GQA), multiple query heads share a single KV head group. For example, **Llama 3.1 8B** has $32$ query heads but only $n_{\\text{kv\\_heads}} = 8$ KV heads:

\`\`\`rust
// Zero-cost VRAM reduction calculation
pub fn calculate_kv_cache_bytes(
    n_layers: usize,
    n_kv_heads: usize,
    head_dim: usize,
    context_tokens: usize,
) -> usize {
    // 2 bytes per fp16 element for Key and Value
    2 * 2 * n_layers * n_kv_heads * head_dim * context_tokens
}
\`\`\`

#### Key Takeaway
Using $n_{\\text{kv\\_heads}} = 8$ instead of $32$ delivers a **4× reduction** in KV cache memory footprint with virtually zero degradation in perplexity!`,

    `### Axum Zero-Buffering SSE Streaming Proxy

Here is how our reverse proxy bridges external OpenAI clients to the internal \`llama-server\` sidecar with zero-buffering:

\`\`\`rust
use axum::{body::Body, response::Response, http::StatusCode};
use futures_util::StreamExt;

pub async fn proxy_stream_to_client(upstream_resp: reqwest::Response) -> Response<Body> {
    let mut builder = Response::builder().status(upstream_resp.status());
    
    // Forward upstream headers (Content-Type: text/event-stream)
    for (k, v) in upstream_resp.headers() {
        builder = builder.header(k.as_str(), v.as_bytes());
    }

    // Zero-buffering byte stream translation
    let stream = upstream_resp
        .bytes_stream()
        .map(|res| res.map_err(std::io::Error::other));
        
    builder.body(Body::from_stream(stream)).unwrap()
}
\`\`\`

This ensures tokens pass through in real-time as fast as the Metal/AVX2 inference engine produces them.`
  ];

  const template = simulatedResponses[Math.floor(Math.random() * simulatedResponses.length)];
  const tokens = template.split(/(\s+|[.,!?:;\n]+)/).filter(t => t.length > 0);

  let fullContent = '';

  for (let i = 0; i < tokens.length; i++) {
    if (AppState.abortController?.signal.aborted) {
      break;
    }

    const token = tokens[i];
    if (AppState.metrics.firstTokenTime === 0) {
      AppState.metrics.firstTokenTime = performance.now();
      AppState.metrics.ttftMs = Math.round(AppState.metrics.firstTokenTime - AppState.metrics.startTime);
    }

    fullContent += token;
    AppState.metrics.tokens++;

    const elapsed = (performance.now() - AppState.metrics.firstTokenTime) / 1000;
    if (elapsed > 0) {
      AppState.metrics.speedTps = AppState.metrics.tokens / elapsed;
    }

    updateLiveTelemetryDisplay();

    const session = getCurrentSession();
    const msg = session.messages.find(m => m.id === assistantMsgId);
    if (msg) msg.content = fullContent;
    updateStreamingMessageContent(assistantMsgId, fullContent, false);

    // Realistic delay between tokens (~25-35ms => ~35-40 tokens/sec)
    await new Promise(r => setTimeout(r, Math.floor(Math.random() * 20 + 20)));
  }
}

// --- Telemetry & State Helpers ---
function updateLiveTelemetryDisplay() {
  DOM.valSpeed.textContent = `${AppState.metrics.speedTps.toFixed(1)} t/s`;
  DOM.valTtft.textContent = `${AppState.metrics.ttftMs}ms`;
  DOM.valTokens.textContent = AppState.metrics.tokens.toString();

  DOM.streamSpeedLive.textContent = `${AppState.metrics.speedTps.toFixed(1)} t/s`;
  DOM.streamTokensLive.textContent = `${AppState.metrics.tokens} tokens`;
}

function resetTelemetryHUD() {
  DOM.valSpeed.textContent = '0.0 t/s';
  DOM.valTtft.textContent = '0ms';
  DOM.valTokens.textContent = '0';
}

function setStreamingUIState(streaming) {
  if (streaming) {
    DOM.sendBtn.classList.add('hidden');
    DOM.stopBtn.classList.remove('hidden');
    DOM.streamingStatusBar.classList.remove('hidden');
    DOM.statSpeed.classList.remove('hidden');
    DOM.statTtft.classList.remove('hidden');
    DOM.statTokens.classList.remove('hidden');
  } else {
    DOM.sendBtn.classList.remove('hidden');
    DOM.stopBtn.classList.add('hidden');
    DOM.streamingStatusBar.classList.add('hidden');
  }
}

function handleInferenceError(assistantMsgId, err) {
  if (err.name === 'AbortError') {
    const session = getCurrentSession();
    const msg = session.messages.find(m => m.id === assistantMsgId);
    if (msg && !msg.content) {
      msg.content = '_Generation stopped by user._';
      updateStreamingMessageContent(assistantMsgId, msg.content, true);
    }
    return;
  }

  console.error('Inference Error:', err);
  const session = getCurrentSession();
  const msg = session.messages.find(m => m.id === assistantMsgId);
  const errMsg = `
> [!WARNING]
> **Inference Error**: ${err.message}
>
> **Troubleshooting**:
> - Verify Axum Gateway is active on \`${AppState.endpoint}\`
> - Verify at least one model instance is loaded via LLM Advisor or \`llama-server\`
> - You can toggle **Simulated Stream Mode** in the sidebar to test UI streaming immediately.
  `;
  if (msg) {
    msg.content = errMsg;
    updateStreamingMessageContent(assistantMsgId, errMsg, true);
  }
}

function finishStreaming(assistantMsgId) {
  AppState.isStreaming = false;
  AppState.abortController = null;
  setStreamingUIState(false);

  const totalTime = (performance.now() - AppState.metrics.startTime) / 1000;
  AppState.metrics.totalDurationSec = totalTime;

  if (AppState.metrics.firstTokenTime > 0 && totalTime > 0) {
    const activeTime = (performance.now() - AppState.metrics.firstTokenTime) / 1000;
    if (activeTime > 0) {
      AppState.metrics.speedTps = AppState.metrics.tokens / activeTime;
    }
  }

  const session = getCurrentSession();
  const msg = session.messages.find(m => m.id === assistantMsgId);
  if (msg) {
    msg.metrics = { ...AppState.metrics };
    updateStreamingMessageContent(assistantMsgId, msg.content, true, msg.metrics);
  }

  saveSessions();
}

function stopCurrentGeneration() {
  if (AppState.abortController) {
    AppState.abortController.abort();
  }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
  // Mobile sidebar controls
  DOM.openSidebarBtn.addEventListener('click', () => {
    DOM.sidebar.classList.remove('-translate-x-full');
    DOM.sidebarBackdrop.classList.remove('hidden');
  });

  DOM.closeSidebarBtn.addEventListener('click', closeSidebar);
  DOM.sidebarBackdrop.addEventListener('click', closeSidebar);

  function closeSidebar() {
    DOM.sidebar.classList.add('-translate-x-full');
    DOM.sidebarBackdrop.classList.add('hidden');
  }

  // New Chat
  DOM.newChatBtn.addEventListener('click', () => {
    createNewSession(true);
    closeSidebar();
  });

  // Clear current chat
  DOM.clearChatBtn.addEventListener('click', () => {
    const session = getCurrentSession();
    if (session && session.messages.length > 0) {
      if (confirm('Clear messages in this conversation?')) {
        session.messages = [];
        saveSessions();
        renderCurrentChat();
        resetTelemetryHUD();
      }
    }
  });

  // Clear all sessions
  DOM.clearAllSessionsBtn.addEventListener('click', clearAllSessions);

  // Gateway URL Input
  DOM.endpointInput.addEventListener('change', () => {
    let url = DOM.endpointInput.value.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'http://' + url;
    }
    AppState.endpoint = url;
    localStorage.setItem('llm_advisor_endpoint', url);
    DOM.footerEndpointDisplay.textContent = url;
    checkGatewayHealth();
  });

  // Health check button
  DOM.checkHealthBtn.addEventListener('click', checkGatewayHealth);

  // Preset buttons
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.dataset.url;
      DOM.endpointInput.value = url;
      AppState.endpoint = url;
      localStorage.setItem('llm_advisor_endpoint', url);
      DOM.footerEndpointDisplay.textContent = url;
      checkGatewayHealth();
    });
  });

  // Model selection
  DOM.modelSelect.addEventListener('change', () => {
    AppState.selectedModel = DOM.modelSelect.value;
    localStorage.setItem('llm_advisor_model', AppState.selectedModel);
    updateModelUI();
  });

  DOM.customModelInput.addEventListener('input', () => {
    AppState.customModel = DOM.customModelInput.value;
    localStorage.setItem('llm_advisor_custom_model', AppState.customModel);
    updateModelUI();
  });

  // Mock mode toggle
  DOM.mockModeToggle.addEventListener('change', () => {
    AppState.mockMode = DOM.mockModeToggle.checked;
    localStorage.setItem('llm_advisor_mock', AppState.mockMode);
    checkGatewayHealth();
  });

  // Sliders & settings
  DOM.tempSlider.addEventListener('input', () => {
    AppState.temperature = parseFloat(DOM.tempSlider.value);
    DOM.tempVal.textContent = AppState.temperature.toFixed(2);
    localStorage.setItem('llm_advisor_temp', AppState.temperature);
  });

  DOM.maxTokensSlider.addEventListener('input', () => {
    AppState.maxTokens = parseInt(DOM.maxTokensSlider.value, 10);
    DOM.maxTokensVal.textContent = AppState.maxTokens;
    localStorage.setItem('llm_advisor_max_tokens', AppState.maxTokens);
  });

  DOM.streamToggle.addEventListener('change', () => {
    AppState.streamEnabled = DOM.streamToggle.checked;
    localStorage.setItem('llm_advisor_stream', AppState.streamEnabled);
  });

  DOM.systemPromptInput.addEventListener('input', () => {
    AppState.systemPrompt = DOM.systemPromptInput.value;
    localStorage.setItem('llm_advisor_system', AppState.systemPrompt);
  });

  // Form submission & Textarea Auto-growth
  DOM.chatForm.addEventListener('submit', handleChatSubmit);

  DOM.stopBtn.addEventListener('click', stopCurrentGeneration);

  DOM.promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSubmit();
    }
  });

  DOM.promptInput.addEventListener('input', () => {
    adjustTextareaHeight(DOM.promptInput);
  });

  // Starter Prompts Click
  document.querySelectorAll('.starter-card').forEach(card => {
    card.addEventListener('click', () => {
      const promptText = card.querySelector('p')?.textContent.trim();
      if (promptText) {
        DOM.promptInput.value = promptText;
        adjustTextareaHeight(DOM.promptInput);
        DOM.promptInput.focus();
        handleChatSubmit();
      }
    });
  });
}

function adjustTextareaHeight(el) {
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Start application on page load
window.addEventListener('DOMContentLoaded', init);
