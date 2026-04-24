(() => {
  if (globalThis.__LLM_WAIT_SWITCHER_LLM_LOADED__) return;
  globalThis.__LLM_WAIT_SWITCHER_LLM_LOADED__ = true;

  const PAGE_EXPECT_EVENT = 'LLM_WAIT_SWITCHER_EXPECT_REQUEST';
  const PAGE_NET_EVENT = 'LLM_WAIT_SWITCHER_NET_EVENT';

  const START_VERIFY_INTERVAL_MS = 120;
  const START_VERIFY_TIMEOUT_MS = 9000;
  const START_SIGNAL_COOLDOWN_MS = 1200;

  const MIN_COMPLETION_MS = 900;
  const COMPLETION_POLL_MS = 250;
  const QUIET_WINDOW_MS = 1400;
  const READY_WINDOW_MS = 900;
  const NO_BUSY_WINDOW_MS = 900;
  const NETWORK_SETTLE_MS = 700;
  const HARD_FALLBACK_COMPLETION_MS = 25000;

  const SEND_KEYWORDS = [
    'send', 'submit', 'ask', 'run', 'generate', 'create', 'imagine',
    '전송', '보내기', '질문', '생성', '실행'
  ];
  const STOP_KEYWORDS = [
    'stop', 'cancel', 'abort', 'halt', 'stop generating', 'stop response',
    '응답 중지', '생성 중지', '중지', '취소', '중단'
  ];
  const BUSY_KEYWORDS = [
    'thinking', 'generating', 'creating', 'rendering', 'researching', 'searching',
    'processing', 'working', 'loading', 'answering', 'writing', 'reasoning',
    '답변 생성', '생성 중', '생각 중', '처리 중', '작성 중'
  ];

  const PLATFORM_CONFIG = {
    chatgpt: {
      composer: ['#prompt-textarea', 'textarea', '[contenteditable="true"]', '[role="textbox"]'],
      send: ['button[data-testid="send-button"]', 'button[aria-label*="Send"]'],
      stop: ['button[data-testid="stop-button"]', 'button[aria-label*="Stop"]'],
      copy: ['button[data-testid*="copy"]', 'button[aria-label*="Copy"]'],
      regenerate: ['button[data-testid*="regenerate"]', 'button[aria-label*="Regenerate"]'],
      assistant: ['[data-message-author-role="assistant"]', 'main article']
    },
    claude: {
      composer: ['div[contenteditable="true"]', 'textarea', '[role="textbox"]'],
      send: ['button[aria-label*="Send"]', 'button[aria-label*="send"]'],
      stop: ['button[aria-label*="Stop"]', 'button[aria-label*="stop"]'],
      copy: ['button[aria-label*="Copy"]'],
      regenerate: ['button[aria-label*="Retry"]', 'button[aria-label*="Regenerate"]'],
      assistant: ['[data-testid*="message"]', 'main article', 'article']
    },
    gemini: {
      composer: ['textarea', '[contenteditable="true"]', '[role="textbox"]'],
      send: ['button[aria-label*="Send"]', 'button[aria-label*="Run"]'],
      stop: ['button[aria-label*="Stop"]', 'button[aria-label*="Cancel"]'],
      copy: ['button[aria-label*="Copy"]'],
      regenerate: ['button[aria-label*="Retry"]', 'button[aria-label*="Refresh"]'],
      assistant: ['message-content', '[class*="response"]', 'main']
    },
    copilot: {
      composer: ['textarea', '[contenteditable="true"]', '[role="textbox"]'],
      send: ['button[aria-label*="Send"]'],
      stop: ['button[aria-label*="Stop"]', 'button[aria-label*="Cancel"]'],
      copy: ['button[aria-label*="Copy"]'],
      regenerate: ['button[aria-label*="Retry"]'],
      assistant: ['[class*="message"]', 'main article', 'article']
    },
    grok: {
      composer: ['textarea', '[contenteditable="true"]', '[role="textbox"]'],
      send: ['button[aria-label*="Send"]'],
      stop: ['button[aria-label*="Stop"]'],
      copy: ['button[aria-label*="Copy"]'],
      regenerate: ['button[aria-label*="Retry"]'],
      assistant: ['[class*="message"]', 'main article', 'article']
    },
    cursor: {
      composer: ['textarea', '[contenteditable="true"]', '[role="textbox"]'],
      send: ['button[aria-label*="Send"]', 'button[aria-label*="Submit"]'],
      stop: ['button[aria-label*="Stop"]', 'button[aria-label*="Cancel"]'],
      copy: ['button[aria-label*="Copy"]'],
      regenerate: ['button[aria-label*="Retry"]'],
      assistant: ['[class*="message"]', '[class*="response"]', 'main article', 'article']
    },
    perplexity: {
      composer: ['textarea', '[contenteditable="true"]', '[role="textbox"]'],
      send: ['button[aria-label*="Submit"]', 'button[aria-label*="Send"]'],
      stop: ['button[aria-label*="Stop"]', 'button[aria-label*="Cancel"]'],
      copy: ['button[aria-label*="Copy"]'],
      regenerate: ['button[aria-label*="Rewrite"]', 'button[aria-label*="Retry"]'],
      assistant: ['[class*="answer"]', '[class*="response"]', 'main article', 'article']
    },
    poe: {
      composer: ['textarea', '[contenteditable="true"]', '[role="textbox"]'],
      send: ['button[aria-label*="Send"]'],
      stop: ['button[aria-label*="Stop"]'],
      copy: ['button[aria-label*="Copy"]'],
      regenerate: ['button[aria-label*="Retry"]'],
      assistant: ['[class*="message"]', 'main article', 'article']
    },
    deepseek: {
      composer: ['textarea', '[contenteditable="true"]', '[role="textbox"]'],
      send: ['button[aria-label*="Send"]'],
      stop: ['button[aria-label*="Stop"]'],
      copy: ['button[aria-label*="Copy"]'],
      regenerate: ['button[aria-label*="Retry"]'],
      assistant: ['[class*="message"]', '[class*="assistant"]', 'main article', 'article']
    },
    mistral: {
      composer: ['textarea', '[contenteditable="true"]', '[role="textbox"]'],
      send: ['button[aria-label*="Send"]'],
      stop: ['button[aria-label*="Stop"]'],
      copy: ['button[aria-label*="Copy"]'],
      regenerate: ['button[aria-label*="Retry"]'],
      assistant: ['[class*="message"]', '[class*="assistant"]', 'main article', 'article']
    },
    midjourney: {
      composer: ['textarea', '[contenteditable="true"]', '[role="textbox"]'],
      send: ['button[aria-label*="Imagine"]', 'button[aria-label*="Send"]', 'button[aria-label*="Create"]'],
      stop: ['button[aria-label*="Stop"]', 'button[aria-label*="Cancel"]'],
      copy: ['button[aria-label*="Copy"]'],
      regenerate: ['button[aria-label*="Retry"]', 'button[aria-label*="Rerun"]'],
      assistant: ['main article', 'article', '[class*="result"]']
    },
    qwen: {
      composer: ['textarea', '[contenteditable="true"]', '[role="textbox"]'],
      send: ['button[aria-label*="Send"]'],
      stop: ['button[aria-label*="Stop"]'],
      copy: ['button[aria-label*="Copy"]'],
      regenerate: ['button[aria-label*="Retry"]'],
      assistant: ['[class*="message"]', 'main article', 'article']
    },
    kimi: {
      composer: ['textarea', '[contenteditable="true"]', '[role="textbox"]'],
      send: ['button[aria-label*="Send"]'],
      stop: ['button[aria-label*="Stop"]'],
      copy: ['button[aria-label*="Copy"]'],
      regenerate: ['button[aria-label*="Retry"]'],
      assistant: ['[class*="message"]', 'main article', 'article']
    },
    generic: {
      composer: ['textarea', '[contenteditable="true"]', '[role="textbox"]', 'input[type="text"]'],
      send: ['button[aria-label*="Send"]', 'button[aria-label*="Submit"]'],
      stop: ['button[aria-label*="Stop"]', 'button[aria-label*="Cancel"]'],
      copy: ['button[aria-label*="Copy"]'],
      regenerate: ['button[aria-label*="Retry"]', 'button[aria-label*="Regenerate"]'],
      assistant: [
        '[data-message-author-role="assistant"]',
        '[data-testid*="assistant"]',
        '[class*="assistant"]',
        '[class*="response"]',
        '[class*="answer"]',
        '[class*="message"]',
        'main article',
        'article',
        'main'
      ]
    }
  };

  function runtimeAlive() {
    try {
      return Boolean(chrome?.runtime?.id);
    } catch {
      return false;
    }
  }

  function safeSendMessage(message) {
    if (!runtimeAlive()) return;
    try {
      chrome.runtime.sendMessage(message, () => void chrome.runtime.lastError);
    } catch {
      // ignore
    }
  }

  function getProviderFromHost(hostname) {
    if (/chatgpt\.com$|chat\.openai\.com$/i.test(hostname)) return 'chatgpt';
    if (/claude\.ai$|code\.claude\.com$/i.test(hostname)) return 'claude';
    if (/gemini\.google\.com$|aistudio\.google\.com$/i.test(hostname)) return 'gemini';
    if (/copilot\.microsoft\.com$/i.test(hostname)) return 'copilot';
    if (/grok\.com$/i.test(hostname)) return 'grok';
    if (/perplexity\.ai$/i.test(hostname)) return 'perplexity';
    if (/poe\.com$/i.test(hostname)) return 'poe';
    if (/deepseek\.com$/i.test(hostname)) return 'deepseek';
    if (/mistral\.ai$/i.test(hostname)) return 'mistral';
    if (/midjourney\.com$/i.test(hostname)) return 'midjourney';
    if (/cursor\.com$/i.test(hostname)) return 'cursor';
    if (/qwen\.ai$/i.test(hostname)) return 'qwen';
    if (/kimi\.com$/i.test(hostname)) return 'kimi';
    return 'generic';
  }

  const provider = getProviderFromHost(location.hostname);
  const config = PLATFORM_CONFIG[provider] || PLATFORM_CONFIG.generic;

  let monitoring = false;
  let observer = null;
  let pollTimer = null;
  let passiveTimer = null;
  let startVerifyTimer = null;
  let pendingStart = null;
  let promptStartedAt = 0;
  let lastStartSignalAt = 0;
  let lastUserIntentAt = 0;
  let lastSignature = '';
  let lastMeaningfulChangeAt = 0;
  let lastBusySeenAt = 0;
  let lastReadySeenAt = 0;
  let trackedNetworkCount = 0;
  let sawTrackedNetworkThisTurn = false;
  let lastTrackedNetworkCompleteAt = 0;

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function isVisible(el) {
    if (!(el instanceof Element)) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function dedupeElements(elements) {
    const seen = new Set();
    const out = [];
    for (const el of elements) {
      if (!(el instanceof Element) || seen.has(el)) continue;
      seen.add(el);
      out.push(el);
    }
    return out;
  }

  function queryVisible(selectors = []) {
    const result = [];
    for (const selector of selectors) {
      try {
        result.push(...Array.from(document.querySelectorAll(selector)).filter(isVisible));
      } catch {
        // ignore bad selectors
      }
    }
    return dedupeElements(result);
  }

  function elementText(el) {
    return normalizeText(el?.textContent || el?.getAttribute?.('aria-label') || '');
  }

  function getComposerCandidates() {
    const fallback = PLATFORM_CONFIG.generic.composer;
    return queryVisible([...(config.composer || []), ...fallback])
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width >= 100 && rect.height >= 16;
      })
      .sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom);
  }

  function getPrimaryComposer() {
    return getComposerCandidates()[0] || null;
  }

  function getComposerText(el) {
    if (!el) return '';
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return el.value || '';
    return el.textContent || '';
  }

  function isComposerInteractive(el) {
    if (!el) return false;
    const disabled = el.getAttribute('aria-disabled') === 'true' || el.getAttribute('disabled') !== null;
    return !disabled;
  }

  function getControlCandidates() {
    return queryVisible(['button', '[role="button"]', 'input[type="submit"]', 'input[type="button"]']);
  }

  function matchesExplicitSelectors(el, selectors = []) {
    return selectors.some((selector) => {
      try {
        return el.matches(selector);
      } catch {
        return false;
      }
    });
  }

  function isPotentialSendButton(el) {
    if (!(el instanceof Element) || !isVisible(el)) return false;
    if (matchesExplicitSelectors(el, [...(config.send || []), ...(PLATFORM_CONFIG.generic.send || [])])) return true;
    const text = elementText(el);
    return SEND_KEYWORDS.some((keyword) => text.includes(keyword));
  }

  function isPotentialStopButton(el) {
    if (!(el instanceof Element) || !isVisible(el)) return false;
    if (matchesExplicitSelectors(el, [...(config.stop || []), ...(PLATFORM_CONFIG.generic.stop || [])])) return true;
    const text = elementText(el);
    return STOP_KEYWORDS.some((keyword) => text.includes(keyword));
  }

  function hasStopButton() {
    return getControlCandidates().some(isPotentialStopButton);
  }

  function getReadySendButton() {
    const buttons = getControlCandidates().filter(isPotentialSendButton);
    return buttons[0] || null;
  }

  function hasBusyIndicator() {
    if (hasStopButton()) return true;

    const busySelectors = [
      '[aria-busy="true"]',
      '[role="progressbar"]',
      'progress',
      '[data-state="loading"]',
      '[class*="loading"]',
      '[class*="spinner"]',
      '[class*="typing"]',
      '[class*="stream"]',
      '[class*="generating"]',
      '[class*="thinking"]'
    ];

    if (queryVisible([...(config.busy || []), ...busySelectors]).length > 0) return true;

    const nodes = queryVisible(['[role="status"]', '[aria-live]', 'button', '[role="button"]']);
    return nodes.some((node) => BUSY_KEYWORDS.some((keyword) => elementText(node).includes(keyword)));
  }

  function getOutputNodes() {
    const selectors = [...(config.assistant || []), ...(PLATFORM_CONFIG.generic.assistant || [])];
    return queryVisible(selectors)
      .filter((el) => {
        const textLength = normalizeText(el.textContent || '').length;
        const mediaCount = el.querySelectorAll('img, canvas, svg, video').length;
        return textLength > 0 || mediaCount > 0 || el.matches('main, article');
      })
      .slice(-8);
  }

  function hasCopyOrRegenerateUi() {
    const explicit = queryVisible([...(config.copy || []), ...(config.regenerate || []), ...(PLATFORM_CONFIG.generic.copy || []), ...(PLATFORM_CONFIG.generic.regenerate || [])]);
    if (explicit.length > 0) return true;

    return getControlCandidates().some((el) => {
      const text = elementText(el);
      return text.includes('copy') || text.includes('retry') || text.includes('regenerate') || text.includes('rewrite');
    });
  }

  function getSnapshot() {
    const outputNodes = getOutputNodes();
    const lastFew = outputNodes.slice(-4);

    let textLength = 0;
    let mediaCount = 0;
    let codeCount = 0;

    for (const node of lastFew) {
      textLength += normalizeText(node.textContent || '').length;
      mediaCount += node.querySelectorAll('img, canvas, svg, video').length;
      codeCount += node.querySelectorAll('pre, code, table').length;
    }

    const composer = getPrimaryComposer();
    const sendReady = Boolean(getReadySendButton());
    const composerReady = isComposerInteractive(composer);
    const busy = hasBusyIndicator();
    const outputExists = outputNodes.length > 0 || textLength > 0 || mediaCount > 0;
    const readyUi = composerReady || sendReady;
    const copyUi = hasCopyOrRegenerateUi();

    return {
      composer,
      composerText: getComposerText(composer),
      busy,
      outputExists,
      readyUi,
      copyUi,
      signature: `${outputNodes.length}:${textLength}:${mediaCount}:${codeCount}:${busy ? 1 : 0}:${composerReady ? 1 : 0}:${sendReady ? 1 : 0}:${copyUi ? 1 : 0}`
    };
  }

  function injectPageBridge() {
    if (!runtimeAlive()) return;
    if (document.documentElement?.dataset?.llmWaitSwitcherBridgeInjected === 'true') return;

    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('page-bridge.js');
    script.async = false;
    script.dataset.llmWaitSwitcher = 'true';
    script.onload = () => script.remove();
    script.onerror = () => script.remove();
    (document.head || document.documentElement || document.body).appendChild(script);

    if (document.documentElement) {
      document.documentElement.dataset.llmWaitSwitcherBridgeInjected = 'true';
    }
  }

  function signalExpectRequest() {
    try {
      window.dispatchEvent(new CustomEvent(PAGE_EXPECT_EVENT, { detail: { provider } }));
    } catch {
      // ignore
    }
  }

  function cleanupStartVerification() {
    pendingStart = null;
    if (startVerifyTimer) {
      clearInterval(startVerifyTimer);
      startVerifyTimer = null;
    }
  }

  function resetTurnState() {
    trackedNetworkCount = 0;
    sawTrackedNetworkThisTurn = false;
    lastTrackedNetworkCompleteAt = 0;
    lastMeaningfulChangeAt = 0;
    lastBusySeenAt = 0;
    lastReadySeenAt = 0;
    lastSignature = '';
  }

  function cleanupMonitor() {
    monitoring = false;
    cleanupStartVerification();
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    resetTurnState();
  }

  function notifyPromptStarted(reason) {
    const now = Date.now();
    if (monitoring) return;
    if (now - lastStartSignalAt < START_SIGNAL_COOLDOWN_MS) return;
    lastStartSignalAt = now;
    cleanupStartVerification();
    safeSendMessage({ type: 'LLM_PROMPT_STARTED', reason, provider });
    startCompletionMonitor();
  }

  function notifyCompleted(reason) {
    cleanupMonitor();
    safeSendMessage({ type: 'LLM_RESPONSE_COMPLETED', reason, provider });
  }

  function evaluateStartEvidence(state) {
    const snapshot = getSnapshot();
    const elapsed = Date.now() - state.createdAt;
    const previousComposerText = normalizeText(state.beforeComposerText);
    const currentComposerText = normalizeText(snapshot.composerText);
    const composerCleared = previousComposerText.length > 0 && currentComposerText.length <= Math.floor(previousComposerText.length * 0.35);
    const outputChanged = snapshot.signature !== state.beforeSignature;
    const busy = snapshot.busy;
    const recentNetwork = sawTrackedNetworkThisTurn || trackedNetworkCount > 0;

    return (
      recentNetwork ||
      hasStopButton() ||
      (busy && elapsed > 180) ||
      (composerCleared && elapsed > 90) ||
      (busy && outputChanged) ||
      (snapshot.outputExists && outputChanged && elapsed > 240)
    );
  }

  function queueStartVerification(reason) {
    if (monitoring) return;
    cleanupStartVerification();
    lastUserIntentAt = Date.now();
    signalExpectRequest();

    const snapshot = getSnapshot();
    pendingStart = {
      reason,
      createdAt: Date.now(),
      beforeComposerText: snapshot.composerText,
      beforeSignature: snapshot.signature
    };

    startVerifyTimer = setInterval(() => {
      if (!pendingStart) return;
      const elapsed = Date.now() - pendingStart.createdAt;
      if (evaluateStartEvidence(pendingStart)) {
        notifyPromptStarted(pendingStart.reason);
        return;
      }
      if (elapsed >= START_VERIFY_TIMEOUT_MS) {
        cleanupStartVerification();
      }
    }, START_VERIFY_INTERVAL_MS);
  }

  function markMeaningfulChange(snapshot) {
    const now = Date.now();
    if (snapshot.signature !== lastSignature) {
      lastSignature = snapshot.signature;
      lastMeaningfulChangeAt = now;
    }
    if (snapshot.busy) lastBusySeenAt = now;
    if (snapshot.readyUi || snapshot.copyUi) lastReadySeenAt = now;
  }

  function startCompletionMonitor() {
    if (monitoring) return;
    monitoring = true;
    promptStartedAt = Date.now();

    const snapshot = getSnapshot();
    lastSignature = snapshot.signature;
    lastMeaningfulChangeAt = Date.now();
    lastBusySeenAt = snapshot.busy ? Date.now() : 0;
    lastReadySeenAt = snapshot.readyUi || snapshot.copyUi ? Date.now() : 0;
    trackedNetworkCount = Math.max(0, trackedNetworkCount);
    if (!sawTrackedNetworkThisTurn) {
      sawTrackedNetworkThisTurn = trackedNetworkCount > 0;
    }

    observer = new MutationObserver(() => {
      if (!monitoring) return;
      markMeaningfulChange(getSnapshot());
    });
    observer.observe(document.documentElement || document, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true
    });

    pollTimer = setInterval(() => {
      const now = Date.now();
      const snapshot = getSnapshot();
      markMeaningfulChange(snapshot);

      const enoughTimePassed = now - promptStartedAt >= MIN_COMPLETION_MS;
      const quietEnough = now - lastMeaningfulChangeAt >= QUIET_WINDOW_MS;
      const noBusyLongEnough = lastBusySeenAt === 0 || now - lastBusySeenAt >= NO_BUSY_WINDOW_MS;
      const readyLongEnough = (snapshot.readyUi || snapshot.copyUi) && lastReadySeenAt > 0 && now - lastReadySeenAt >= READY_WINDOW_MS;
      const networkSettled =
        sawTrackedNetworkThisTurn &&
        trackedNetworkCount === 0 &&
        lastTrackedNetworkCompleteAt > 0 &&
        now - lastTrackedNetworkCompleteAt >= NETWORK_SETTLE_MS;

      const outputDoneUi = snapshot.copyUi || (snapshot.readyUi && getReadySendButton());

      const networkBasedCompletion =
        enoughTimePassed &&
        networkSettled &&
        noBusyLongEnough &&
        snapshot.outputExists &&
        (quietEnough || readyLongEnough || outputDoneUi);

      const domFallbackCompletion =
        enoughTimePassed &&
        !snapshot.busy &&
        noBusyLongEnough &&
        snapshot.outputExists &&
        readyLongEnough &&
        (quietEnough || outputDoneUi);

      const hardFallbackCompletion =
        now - promptStartedAt >= HARD_FALLBACK_COMPLETION_MS &&
        !snapshot.busy &&
        noBusyLongEnough &&
        snapshot.outputExists;

      if (networkBasedCompletion || domFallbackCompletion || hardFallbackCompletion) {
        notifyCompleted(
          networkBasedCompletion ? 'network' : domFallbackCompletion ? 'dom' : 'hard-fallback'
        );
      }
    }, COMPLETION_POLL_MS);
  }

  window.addEventListener(PAGE_NET_EVENT, (event) => {
    const detail = event?.detail || {};
    const eventProvider = detail.provider || 'generic';
    if (provider !== 'generic' && eventProvider !== provider) return;

    if (detail.phase === 'start') {
      trackedNetworkCount += 1;
      sawTrackedNetworkThisTurn = true;
      if (!monitoring) {
        notifyPromptStarted('network');
      }
      return;
    }

    if (detail.phase === 'complete') {
      trackedNetworkCount = Math.max(0, trackedNetworkCount - 1);
      lastTrackedNetworkCompleteAt = Date.now();
    }
  });

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest('button, [role="button"], input[type="submit"], input[type="button"]');
      if (!button) return;
      if (isPotentialStopButton(button)) return;
      if (isPotentialSendButton(button)) {
        queueStartVerification('click');
      }
    },
    true
  );

  document.addEventListener(
    'submit',
    () => {
      queueStartVerification('submit');
    },
    true
  );

  document.addEventListener(
    'keydown',
    (event) => {
      const target = event.target;
      const isTextLike =
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLInputElement ||
        (target instanceof HTMLElement && (target.isContentEditable || target.getAttribute('role') === 'textbox'));
      if (!isTextLike) return;

      const isLikelySend =
        (event.key === 'Enter' && !event.shiftKey && !event.altKey) ||
        ((event.ctrlKey || event.metaKey) && event.key === 'Enter');
      if (isLikelySend) {
        queueStartVerification('keydown');
      }
    },
    true
  );

  passiveTimer = setInterval(() => {
    if (monitoring) return;
    if (Date.now() - lastUserIntentAt > 10000) return;
    if (hasStopButton() || (hasBusyIndicator() && getSnapshot().outputExists)) {
      notifyPromptStarted('passive-busy');
    }
  }, 300);

  window.addEventListener('beforeunload', () => {
    cleanupMonitor();
    if (passiveTimer) {
      clearInterval(passiveTimer);
      passiveTimer = null;
    }
  });

  injectPageBridge();
})();
