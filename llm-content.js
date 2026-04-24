(() => {
  if (window.__LLM_WAIT_SWITCHER_LLM_LOADED__) return;
  window.__LLM_WAIT_SWITCHER_LLM_LOADED__ = true;

  const PAGE_NET_EVENT = 'LLM_WAIT_SWITCHER_NET_EVENT';

  const START_COOLDOWN_MS = 1500;
  const USER_INTENT_WINDOW_MS = 12000;
  const MIN_TURN_MS = 1200;
  const DOM_STABLE_MS = 2200;
  const NETWORK_SETTLE_MS = 1400;
  const HARD_FALLBACK_MS = 90000;
  const POLL_MS = 700;

  const providerProfiles = [
    {
      id: 'chatgpt',
      host: /chatgpt\.com$|chat\.openai\.com$/i,
      composer: ['textarea', '[contenteditable="true"]', '[role="textbox"]'],
      send: [
        'button[data-testid*="send"]',
        'button[aria-label*="Send"]',
        'button[aria-label*="send"]'
      ],
      stop: [
        'button[data-testid*="stop"]',
        'button[aria-label*="Stop"]',
        'button[aria-label*="stop"]'
      ],
      copy: [
        'button[aria-label*="Copy"]',
        'button[aria-label*="copy"]',
        'button[data-testid*="copy"]'
      ],
      output: ['article', '[data-message-author-role="assistant"]', 'main']
    },
    {
      id: 'claude',
      host: /claude\.ai$|code\.claude\.com$/i,
      composer: ['div[contenteditable="true"]', 'textarea', '[role="textbox"]'],
      send: [
        'button[aria-label*="Send"]',
        'button[aria-label*="send"]',
        'button[data-testid*="send"]'
      ],
      stop: [
        'button[aria-label*="Stop"]',
        'button[aria-label*="stop"]',
        'button[data-testid*="stop"]'
      ],
      copy: [
        'button[aria-label*="Copy"]',
        'button[aria-label*="copy"]'
      ],
      output: ['main', 'article', '[data-is-streaming]', '[data-testid*="message"]']
    },
    {
      id: 'gemini',
      host: /gemini\.google\.com$|aistudio\.google\.com$/i,
      composer: ['rich-textarea textarea', 'textarea', '[contenteditable="true"]', '[role="textbox"]'],
      send: [
        'button[aria-label*="Send"]',
        'button[aria-label*="send"]',
        'button[mattooltip*="Send"]',
        'button[mattooltip*="send"]'
      ],
      stop: [
        'button[aria-label*="Stop"]',
        'button[aria-label*="stop"]',
        'button[mattooltip*="Stop"]',
        'button[mattooltip*="stop"]'
      ],
      copy: [
        'button[aria-label*="Copy"]',
        'button[aria-label*="copy"]'
      ],
      output: ['main', 'article', 'model-response', '[data-response-id]']
    },
    {
      id: 'generic',
      host: /.*/i,
      composer: ['textarea', '[contenteditable="true"]', '[role="textbox"]', 'input[type="text"]'],
      send: [
        'button[aria-label*="send" i]',
        'button[data-testid*="send" i]',
        'button[type="submit"]',
        'button[title*="send" i]'
      ],
      stop: [
        'button[aria-label*="stop" i]',
        'button[data-testid*="stop" i]',
        'button[title*="stop" i]'
      ],
      copy: [
        'button[aria-label*="copy" i]',
        'button[data-testid*="copy" i]',
        'button[title*="copy" i]'
      ],
      output: ['main', 'article', '[data-testid*="message" i]', '[class*="message" i]']
    }
  ];

  const SEND_WORDS = ['send', '전송', 'submit', 'ask', 'enter'];
  const STOP_WORDS = ['stop', '중지', 'cancel', 'abort'];
  const COPY_WORDS = ['copy', '복사', 'regenerate', 'retry', '다시'];

  const state = {
    provider: getProfile().id,
    monitoring: false,
    observer: null,
    pollTimer: null,
    promptStartedAt: 0,
    lastStartSignalAt: 0,
    lastUserIntentAt: 0,
    startIntentReason: '',
    activeRequestCount: 0,
    sawNetwork: false,
    lastNetworkCompleteAt: 0,
    lastMeaningfulChangeAt: 0,
    lastSignature: '',
    hardFallbackAt: 0
  };

  function getProfile() {
    const host = location.hostname;
    return providerProfiles.find((profile) => profile.host.test(host)) || providerProfiles[providerProfiles.length - 1];
  }

  const profile = getProfile();

  function runtimeAlive() {
    try {
      return !!(chrome && chrome.runtime && chrome.runtime.id);
    } catch (error) {
      return false;
    }
  }

  function sendMessage(message, callback) {
    if (!runtimeAlive()) return;
    try {
      chrome.runtime.sendMessage(message, (response) => {
        try {
          chrome.runtime.lastError;
        } catch (error) {
          // Ignore.
        }
        if (typeof callback === 'function') callback(response);
      });
    } catch (error) {
      // Ignore send failures.
    }
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

  function normalizeText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function isVisible(el) {
    if (!(el instanceof Element)) return false;
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  }

  function queryVisible(selectors) {
    const out = [];
    for (const selector of selectors) {
      try {
        document.querySelectorAll(selector).forEach((el) => {
          if (isVisible(el)) out.push(el);
        });
      } catch (error) {
        // Ignore invalid selectors.
      }
    }
    return dedupe(out);
  }

  function dedupe(items) {
    return [...new Set(items)];
  }

  function getElementLabel(el) {
    return normalizeText([
      el.getAttribute?.('aria-label'),
      el.getAttribute?.('title'),
      el.textContent,
      el.getAttribute?.('data-testid'),
      el.getAttribute?.('mattooltip')
    ].filter(Boolean).join(' '));
  }

  function matchesWord(el, words) {
    const label = getElementLabel(el);
    return words.some((word) => label.includes(word));
  }

  function pickBestElement(list) {
    const candidates = list.filter(isVisible).sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return (rb.width * rb.height) - (ra.width * ra.height);
    });
    return candidates[0] || null;
  }

  function getComposer() {
    const candidates = queryVisible(profile.composer);
    const filtered = candidates
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width >= 120 && rect.height >= 18;
      })
      .sort((a, b) => {
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        return (rb.width * rb.height) - (ra.width * ra.height);
      });

    return filtered[0] || null;
  }

  function getComposerText(composer = getComposer()) {
    if (!composer) return '';
    if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
      return composer.value || '';
    }
    return composer.textContent || '';
  }

  function isComposerReady(composer = getComposer()) {
    if (!composer) return false;
    if (!isVisible(composer)) return false;
    if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
      return !composer.disabled && !composer.readOnly;
    }
    return composer.getAttribute('aria-disabled') !== 'true' && composer.getAttribute('contenteditable') !== 'false';
  }

  function findSendButton() {
    const candidates = queryVisible(profile.send);
    const matched = candidates.filter((el) => matchesWord(el, SEND_WORDS));
    return pickBestElement(matched.length ? matched : candidates);
  }

  function findStopButton() {
    const candidates = queryVisible(profile.stop);
    const matched = candidates.filter((el) => matchesWord(el, STOP_WORDS));
    return pickBestElement(matched.length ? matched : candidates);
  }

  function findCopyButton() {
    const candidates = queryVisible(profile.copy);
    const matched = candidates.filter((el) => matchesWord(el, COPY_WORDS));
    return pickBestElement(matched.length ? matched : candidates);
  }

  function isSendButtonReady() {
    const btn = findSendButton();
    if (!btn) return false;
    return btn.getAttribute('aria-disabled') !== 'true' && !btn.disabled;
  }

  function collectOutputNodes() {
    const nodes = [];
    for (const selector of profile.output) {
      try {
        document.querySelectorAll(selector).forEach((node) => {
          if (isVisible(node)) nodes.push(node);
        });
      } catch (error) {
        // Ignore invalid selectors.
      }
    }
    return dedupe(nodes);
  }

  function getOutputMetrics() {
    const nodes = collectOutputNodes();
    let textLength = 0;
    let codeCount = 0;
    let mediaCount = 0;

    for (const node of nodes) {
      const text = normalizeText(node.textContent || '');
      textLength += text.length;
      codeCount += node.querySelectorAll?.('pre, code').length || 0;
      mediaCount += node.querySelectorAll?.('img, video, canvas, svg').length || 0;
    }

    const busyFromAttrs = !!document.querySelector('[aria-busy="true"], [data-is-streaming="true"]');
    const stopVisible = !!findStopButton();
    const copyVisible = !!findCopyButton();
    const composerReady = isComposerReady();
    const sendReady = isSendButtonReady();
    const busy = stopVisible || busyFromAttrs;
    const outputExists = textLength > 0 || codeCount > 0 || mediaCount > 0;
    const readyForNextTurn = composerReady || sendReady;

    return {
      textLength,
      codeCount,
      mediaCount,
      outputExists,
      stopVisible,
      copyVisible,
      composerReady,
      sendReady,
      busy,
      readyForNextTurn,
      signature: `${nodes.length}:${textLength}:${codeCount}:${mediaCount}:${busy ? 1 : 0}:${copyVisible ? 1 : 0}:${readyForNextTurn ? 1 : 0}`
    };
  }

  function markUserIntent(reason) {
    state.lastUserIntentAt = Date.now();
    state.startIntentReason = reason;
    window.setTimeout(() => {
      if (!state.monitoring) {
        maybeStartFromDomIntent();
      }
    }, 250);
    window.setTimeout(() => {
      if (!state.monitoring) {
        maybeStartFromDomIntent();
      }
    }, 700);
  }

  function maybeStartFromDomIntent() {
    if (state.monitoring) return;
    const now = Date.now();
    if (now - state.lastUserIntentAt > USER_INTENT_WINDOW_MS) return;
    const metrics = getOutputMetrics();
    const composerText = normalizeText(getComposerText());
    const likelyStarted =
      metrics.busy ||
      metrics.stopVisible ||
      (!composerText && !metrics.readyForNextTurn) ||
      (!!state.lastSignature && metrics.signature !== state.lastSignature);

    if (likelyStarted) {
      notifyPromptStarted();
    }
  }

  function notifyPromptStarted() {
    const now = Date.now();
    if (now - state.lastStartSignalAt < START_COOLDOWN_MS) return;

    state.lastStartSignalAt = now;
    state.monitoring = true;
    state.promptStartedAt = now;
    state.hardFallbackAt = now + HARD_FALLBACK_MS;
    state.sawNetwork = false;
    state.activeRequestCount = 0;
    state.lastNetworkCompleteAt = 0;

    const initialMetrics = getOutputMetrics();
    state.lastSignature = initialMetrics.signature;
    state.lastMeaningfulChangeAt = now;

    startObservers();
    sendMessage({ type: 'LLM_PROMPT_STARTED' });
  }

  function notifyCompleted() {
    if (!state.monitoring) return;
    cleanupMonitoring();
    sendMessage({ type: 'LLM_RESPONSE_COMPLETED' });
  }

  function cleanupMonitoring() {
    state.monitoring = false;
    state.activeRequestCount = 0;
    state.sawNetwork = false;
    state.lastNetworkCompleteAt = 0;
    state.lastMeaningfulChangeAt = 0;

    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }

  function updateMeaningfulChange(metrics) {
    if (metrics.signature !== state.lastSignature) {
      state.lastSignature = metrics.signature;
      state.lastMeaningfulChangeAt = Date.now();
    }
  }

  function evaluateCompletion() {
    if (!state.monitoring) return;

    const now = Date.now();
    const metrics = getOutputMetrics();
    updateMeaningfulChange(metrics);

    const turnAge = now - state.promptStartedAt;
    const stableFor = now - state.lastMeaningfulChangeAt;
    const networkSettled = state.sawNetwork && state.activeRequestCount === 0 && state.lastNetworkCompleteAt > 0 && (now - state.lastNetworkCompleteAt) >= NETWORK_SETTLE_MS;

    const networkBasedDone =
      turnAge >= MIN_TURN_MS &&
      networkSettled &&
      !metrics.busy &&
      (metrics.readyForNextTurn || metrics.copyVisible || metrics.outputExists);

    const domBasedDone =
      turnAge >= MIN_TURN_MS &&
      !metrics.busy &&
      metrics.outputExists &&
      (metrics.readyForNextTurn || metrics.copyVisible) &&
      stableFor >= DOM_STABLE_MS;

    const hardFallbackDone =
      now >= state.hardFallbackAt &&
      !metrics.busy &&
      metrics.outputExists &&
      stableFor >= DOM_STABLE_MS;

    if (networkBasedDone || domBasedDone || hardFallbackDone) {
      notifyCompleted();
    }
  }

  function startObservers() {
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    state.observer = new MutationObserver(() => {
      if (!state.monitoring) return;
      const metrics = getOutputMetrics();
      updateMeaningfulChange(metrics);
    });

    try {
      state.observer.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true
      });
    } catch (error) {
      // Ignore observer attach failures.
    }

    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }

    state.pollTimer = setInterval(evaluateCompletion, POLL_MS);
  }

  window.addEventListener(PAGE_NET_EVENT, (event) => {
    const detail = event?.detail || {};
    if (detail.provider && detail.provider !== profile.id && profile.id !== 'generic') return;

    if (detail.phase === 'start') {
      state.sawNetwork = true;
      state.activeRequestCount += 1;
      if (!state.monitoring) {
        notifyPromptStarted();
      }
      return;
    }

    if (detail.phase === 'complete') {
      state.activeRequestCount = Math.max(0, state.activeRequestCount - 1);
      state.lastNetworkCompleteAt = Date.now();
      if (state.monitoring) {
        evaluateCompletion();
      }
    }
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('button, [role="button"], input[type="submit"], input[type="button"]');
    if (!(button instanceof Element)) return;

    const label = getElementLabel(button);
    if (STOP_WORDS.some((word) => label.includes(word))) return;
    if (
      SEND_WORDS.some((word) => label.includes(word)) ||
      button === findSendButton()
    ) {
      markUserIntent('click');
    }
  }, true);

  document.addEventListener('submit', () => {
    markUserIntent('submit');
  }, true);

  document.addEventListener('keydown', (event) => {
    const target = event.target;
    const isTextLike =
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLInputElement ||
      (target instanceof HTMLElement && (target.isContentEditable || target.getAttribute('role') === 'textbox'));

    if (!isTextLike) return;

    const isLikelySend =
      (event.key === 'Enter' && !event.shiftKey && !event.altKey && !event.isComposing) ||
      ((event.ctrlKey || event.metaKey) && event.key === 'Enter');

    if (isLikelySend) {
      markUserIntent('keydown');
    }
  }, true);

  window.addEventListener('beforeunload', () => {
    cleanupMonitoring();
  });

  injectPageBridge();
})();