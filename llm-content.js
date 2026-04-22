if (!globalThis.__LLM_WAIT_SWITCHER_LLM_LOADED__) {
  globalThis.__LLM_WAIT_SWITCHER_LLM_LOADED__ = true;

  const PAGE_EXPECT_EVENT = 'LLM_WAIT_SWITCHER_EXPECT_REQUEST';
  const PAGE_NET_EVENT = 'LLM_WAIT_SWITCHER_NET_EVENT';

  const SEND_KEYWORDS = [
    'send',
    'submit',
    'ask',
    'run',
    'generate',
    'create',
    'imagine',
    '전송',
    '보내기',
    '질문',
    '생성',
    '실행'
  ];

  const STOP_KEYWORDS = [
    'stop',
    'cancel',
    'abort',
    'halt',
    'stop generating',
    'stop response',
    'cancel generation',
    '응답 중지',
    '생성 중지',
    '중지',
    '취소',
    '중단'
  ];

  const BUSY_KEYWORDS = [
    'thinking',
    'generating',
    'creating',
    'rendering',
    'researching',
    'searching',
    'processing',
    'working',
    'loading',
    '답변 생성',
    '생성 중',
    '생각 중',
    '처리 중',
    '렌더링 중',
    '검색 중'
  ];

  const START_SIGNAL_COOLDOWN_MS = 1300;
  const START_VERIFY_INTERVAL_MS = 220;
  const START_VERIFY_TIMEOUT_MS = 5000;

  const COMPLETION_POLL_MS = 700;
  const MIN_COMPLETION_MS = 2200;
  const NETWORK_SETTLE_MS = 900;
  const NO_BUSY_WINDOW_MS = 1000;
  const QUIET_WINDOW_MS = 1800;
  const READY_WINDOW_MS = 900;
  const STABLE_TICKS_REQUIRED = 3;
  const HARD_FALLBACK_COMPLETION_MS = 14000;

  let monitoring = false;
  let observer = null;
  let pollTimer = null;
  let startVerifyTimer = null;

  let promptStartedAt = 0;
  let lastStartSignalAt = 0;

  let pendingStart = null;

  let lastMeaningfulChangeAt = 0;
  let lastBusySeenAt = 0;
  let lastReadySeenAt = 0;
  let lastOutputSignature = '';
  let stableTickCount = 0;

  let trackedNetworkCount = 0;
  let sawTrackedNetworkThisTurn = false;
  let lastTrackedNetworkCompleteAt = 0;

  function injectPageBridge() {
    if (document.documentElement?.dataset?.llmWaitSwitcherBridgeInjected === 'true') {
      return;
    }

    if (document.documentElement) {
      document.documentElement.dataset.llmWaitSwitcherBridgeInjected = 'true';
    }

    const script = document.createElement('script');
    script.textContent = `
      (() => {
        if (window.__LLM_WAIT_SWITCHER_PAGE_BRIDGE__) return;
        window.__LLM_WAIT_SWITCHER_PAGE_BRIDGE__ = true;

        const PAGE_EXPECT_EVENT = '${PAGE_EXPECT_EVENT}';
        const PAGE_NET_EVENT = '${PAGE_NET_EVENT}';

        const state = {
          expectUntil: 0,
          provider: 'generic',
          seq: 0
        };

        function dispatch(detail) {
          try {
            window.dispatchEvent(new CustomEvent(PAGE_NET_EVENT, { detail }));
          } catch (error) {}
        }

        function getProviderFromHost(host) {
          if (/chatgpt\\.com$|chat\\.openai\\.com$/i.test(host)) return 'chatgpt';
          if (/gemini\\.google\\.com$|aistudio\\.google\\.com$/i.test(host)) return 'gemini';
          if (/claude\\.ai$|code\\.claude\\.com$/i.test(host)) return 'claude';
          if (/copilot\\.microsoft\\.com$/i.test(host)) return 'copilot';
          if (/grok\\.com$/i.test(host)) return 'grok';
          if (/perplexity\\.ai$/i.test(host)) return 'perplexity';
          if (/poe\\.com$/i.test(host)) return 'poe';
          if (/deepseek\\.com$/i.test(host)) return 'deepseek';
          if (/mistral\\.ai$/i.test(host)) return 'mistral';
          if (/midjourney\\.com$/i.test(host)) return 'midjourney';
          if (/cursor\\.com$/i.test(host)) return 'cursor';
          if (/qwen\\.ai$/i.test(host)) return 'qwen';
          if (/kimi\\.com$/i.test(host)) return 'kimi';
          return 'generic';
        }

        function toAbsoluteUrl(urlLike) {
          try {
            return new URL(urlLike, location.href);
          } catch (error) {
            return null;
          }
        }

        function getUrlString(input) {
          try {
            if (typeof input === 'string') return input;
            if (input instanceof Request) return input.url;
            if (input && typeof input.url === 'string') return input.url;
          } catch (error) {}
          return '';
        }

        function getMethod(input, init) {
          try {
            if (init && init.method) return String(init.method).toUpperCase();
            if (input instanceof Request && input.method) return String(input.method).toUpperCase();
            if (input && input.method) return String(input.method).toUpperCase();
          } catch (error) {}
          return 'GET';
        }

        function isExcludedUrl(urlString) {
          return /telemetry|analytics|segment|sentry|logging|metrics|track|traces|stats|beacon/i.test(urlString);
        }

        function isRelevantHost(urlObj, provider) {
          const host = urlObj.hostname;
          const sameHost = host === location.hostname;

          if (sameHost) return true;

          if (provider === 'chatgpt') {
            return /(^|\\.)openai\\.com$|(^|\\.)chatgpt\\.com$|(^|\\.)chat\\.openai\\.com$/i.test(host);
          }

          if (provider === 'gemini') {
            return /(^|\\.)google\\.com$|(^|\\.)googleapis\\.com$|(^|\\.)googleusercontent\\.com$/i.test(host);
          }

          if (provider === 'claude') {
            return /(^|\\.)claude\\.ai$|(^|\\.)anthropic\\.com$/i.test(host);
          }

          if (provider === 'copilot') {
            return /(^|\\.)microsoft\\.com$|(^|\\.)bing\\.com$/i.test(host);
          }

          if (provider === 'grok') {
            return /(^|\\.)grok\\.com$|(^|\\.)x\\.com$|(^|\\.)twitter\\.com$/i.test(host);
          }

          return false;
        }

        function isLikelyGenerationRequest(urlString, method, provider) {
          if (method === 'GET') return false;
          if (!urlString || isExcludedUrl(urlString)) return false;
          if (Date.now() > state.expectUntil) return false;

          const urlObj = toAbsoluteUrl(urlString);
          if (!urlObj) return false;
          if (!isRelevantHost(urlObj, provider)) return false;

          const s = urlString.toLowerCase();

          if (provider === 'chatgpt') {
            return /conversation|responses|backend-api|messages|completion|chat-requirements/.test(s);
          }

          if (provider === 'gemini') {
            return /generatecontent|streamgeneratecontent|batchexecute|bard|conversation|content|model/.test(s);
          }

          if (provider === 'claude') {
            return /chat_conversations|completion|append_message|retry_message|messages/.test(s);
          }

          return true;
        }

        async function consumeResponseBody(response, id, urlString, provider) {
          try {
            const clone = response.clone();

            if (!clone.body || !clone.body.getReader) {
              dispatch({
                phase: 'complete',
                id,
                url: urlString,
                provider,
                ok: response.ok
              });
              return;
            }

            const reader = clone.body.getReader();

            while (true) {
              const result = await reader.read();
              if (result.done) break;
            }

            dispatch({
              phase: 'complete',
              id,
              url: urlString,
              provider,
              ok: response.ok
            });
          } catch (error) {
            dispatch({
              phase: 'complete',
              id,
              url: urlString,
              provider,
              ok: false
            });
          }
        }

        window.addEventListener(PAGE_EXPECT_EVENT, (event) => {
          const provider = event?.detail?.provider || getProviderFromHost(location.hostname);
          state.provider = provider;
          state.expectUntil = Date.now() + 15000;
        });

        const originalFetch = window.fetch.bind(window);

        window.fetch = async function(input, init) {
          const provider = state.provider || getProviderFromHost(location.hostname);
          const urlString = getUrlString(input);
          const method = getMethod(input, init);
          const shouldTrack = isLikelyGenerationRequest(urlString, method, provider);

          let id = null;

          if (shouldTrack) {
            id = 'fetch-' + (++state.seq);
            dispatch({
              phase: 'start',
              id,
              url: urlString,
              provider
            });
          }

          try {
            const response = await originalFetch(input, init);

            if (id) {
              consumeResponseBody(response, id, urlString, provider);
            }

            return response;
          } catch (error) {
            if (id) {
              dispatch({
                phase: 'complete',
                id,
                url: urlString,
                provider,
                ok: false
              });
            }
            throw error;
          }
        };

        const originalXHROpen = XMLHttpRequest.prototype.open;
        const originalXHRSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
          this.__lwsMethod = String(method || 'GET').toUpperCase();
          this.__lwsUrl = typeof url === 'string' ? url : '';
          return originalXHROpen.call(this, method, url, ...rest);
        };

        XMLHttpRequest.prototype.send = function(body) {
          const provider = state.provider || getProviderFromHost(location.hostname);
          const urlString = this.__lwsUrl || '';
          const method = this.__lwsMethod || 'GET';
          const shouldTrack = isLikelyGenerationRequest(urlString, method, provider);

          let id = null;
          let finished = false;

          if (shouldTrack) {
            id = 'xhr-' + (++state.seq);
            dispatch({
              phase: 'start',
              id,
              url: urlString,
              provider
            });

            const finish = (ok) => {
              if (finished) return;
              finished = true;
              dispatch({
                phase: 'complete',
                id,
                url: urlString,
                provider,
                ok
              });
            };

            this.addEventListener('loadend', () => finish(true), { once: true });
            this.addEventListener('error', () => finish(false), { once: true });
            this.addEventListener('abort', () => finish(false), { once: true });
          }

          return originalXHRSend.call(this, body);
        };
      })();
    `;

    (document.documentElement || document.head || document.body).appendChild(script);
    script.remove();
  }

  function getProviderFromHost(host) {
    if (/chatgpt\.com$|chat\.openai\.com$/i.test(host)) return 'chatgpt';
    if (/gemini\.google\.com$|aistudio\.google\.com$/i.test(host)) return 'gemini';
    if (/claude\.ai$|code\.claude\.com$/i.test(host)) return 'claude';
    if (/copilot\.microsoft\.com$/i.test(host)) return 'copilot';
    if (/grok\.com$/i.test(host)) return 'grok';
    if (/perplexity\.ai$/i.test(host)) return 'perplexity';
    if (/poe\.com$/i.test(host)) return 'poe';
    if (/deepseek\.com$/i.test(host)) return 'deepseek';
    if (/mistral\.ai$/i.test(host)) return 'mistral';
    if (/midjourney\.com$/i.test(host)) return 'midjourney';
    if (/cursor\.com$/i.test(host)) return 'cursor';
    if (/qwen\.ai$/i.test(host)) return 'qwen';
    if (/kimi\.com$/i.test(host)) return 'kimi';
    return 'generic';
  }

  const provider = getProviderFromHost(location.hostname);

  function normalizeText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function isVisible(el) {
    if (!(el instanceof Element)) return false;
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();

    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  function elementText(el) {
    if (!(el instanceof Element)) return '';
    return normalizeText(
      [
        el.textContent,
        el.getAttribute('aria-label'),
        el.getAttribute('title'),
        el.getAttribute('data-testid'),
        el.getAttribute('data-state'),
        el.getAttribute('name')
      ]
        .filter(Boolean)
        .join(' ')
    );
  }

  function dedupeElements(elements) {
    const seen = new Set();
    const result = [];

    for (const el of elements) {
      if (!(el instanceof Element)) continue;
      if (seen.has(el)) continue;
      seen.add(el);
      result.push(el);
    }

    return result;
  }

  function getVisibleElementsBySelector(selector) {
    try {
      return Array.from(document.querySelectorAll(selector)).filter(isVisible);
    } catch (error) {
      return [];
    }
  }

  function signalExpectRequest() {
    window.dispatchEvent(
      new CustomEvent(PAGE_EXPECT_EVENT, {
        detail: { provider }
      })
    );
  }

  function getPrimaryComposer() {
    const candidates = dedupeElements(
      [
        ...getVisibleElementsBySelector('textarea'),
        ...getVisibleElementsBySelector('[contenteditable="true"]'),
        ...getVisibleElementsBySelector('[role="textbox"]'),
        ...getVisibleElementsBySelector('input[type="text"]'),
        ...getVisibleElementsBySelector('input:not([type])')
      ]
    )
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width >= 120 && rect.height >= 18;
      })
      .sort((a, b) => {
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();

        if (rb.bottom !== ra.bottom) return rb.bottom - ra.bottom;
        return rb.width * rb.height - ra.width * ra.height;
      });

    return candidates[0] || null;
  }

  function getComposerText(el) {
    if (!el) return '';

    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      return el.value || '';
    }

    return el.textContent || '';
  }

  function isComposerInteractive(el) {
    if (!el || !isVisible(el)) return false;

    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      return !el.disabled && !el.readOnly;
    }

    if (el instanceof HTMLElement) {
      if (el.matches('[aria-disabled="true"], [disabled], [inert]')) return false;
      if (el.getAttribute('contenteditable') === 'false') return false;
      return true;
    }

    return false;
  }

  function isPotentialSendButton(button) {
    if (!(button instanceof Element) || !isVisible(button)) return false;
    if (button.matches('[disabled], [aria-disabled="true"]')) return false;

    const text = elementText(button);
    if (!text) return false;
    if (STOP_KEYWORDS.some((keyword) => text.includes(keyword))) return false;

    if (
      button.matches('button[data-testid="send-button"]') ||
      button.matches('button[aria-label*="Send"]') ||
      button.matches('button[aria-label*="Submit"]') ||
      button.matches('button[aria-label*="Generate"]') ||
      button.matches('button[aria-label*="Create"]') ||
      button.matches('button[aria-label*="Imagine"]') ||
      button.matches('button[aria-label*="Run"]') ||
      button.matches('button[aria-label*="전송"]') ||
      button.matches('button[aria-label*="생성"]')
    ) {
      return true;
    }

    return SEND_KEYWORDS.some((keyword) => text.includes(keyword));
  }

  function isPotentialStopControl(el) {
    if (!(el instanceof Element) || !isVisible(el)) return false;

    if (
      el.matches('button[data-testid="stop-button"]') ||
      el.matches('button[aria-label*="Stop"]') ||
      el.matches('button[aria-label*="Cancel"]') ||
      el.matches('button[aria-label*="중지"]') ||
      el.matches('button[aria-label*="취소"]')
    ) {
      return true;
    }

    const text = elementText(el);
    if (!text) return false;

    return STOP_KEYWORDS.some((keyword) => text.includes(keyword));
  }

  function getControls() {
    return Array.from(
      document.querySelectorAll(
        'button, [role="button"], input[type="button"], input[type="submit"]'
      )
    ).filter(isVisible);
  }

  function hasStopControl() {
    return getControls().some((el) => isPotentialStopControl(el));
  }

  function getReadySendButton() {
    const controls = getControls().filter((el) => isPotentialSendButton(el));

    if (controls.length === 0) return null;

    controls.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return rb.bottom - ra.bottom;
    });

    return controls[0] || null;
  }

  function isSendButtonReady() {
    return !!getReadySendButton();
  }

  function hasBusyIndicator() {
    if (hasStopControl()) return true;

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

    for (const selector of busySelectors) {
      const nodes = getVisibleElementsBySelector(selector);
      if (nodes.length > 0) return true;
    }

    const nodes = Array.from(
      document.querySelectorAll('[role="status"], [aria-live], button, [role="button"]')
    ).filter(isVisible);

    return nodes.some((node) => {
      const text = elementText(node);
      return BUSY_KEYWORDS.some((keyword) => text.includes(keyword));
    });
  }

  function getOutputNodes() {
    const selectors = [
      '[data-message-author-role="assistant"]',
      '[data-testid*="assistant"]',
      '[class*="assistant"]',
      '[class*="response"]',
      '[class*="answer"]',
      '[class*="message"]',
      'main article',
      'article',
      'main'
    ];

    return dedupeElements(
      selectors.flatMap((selector) => getVisibleElementsBySelector(selector))
    )
      .filter((el) => {
        const textLength = normalizeText(el.textContent || '').length;
        const mediaCount = el.querySelectorAll('img, canvas, svg, video').length;
        return textLength > 0 || mediaCount > 0 || el.matches('main, article');
      })
      .slice(-8);
  }

  function getOutputMetrics() {
    const nodes = getOutputNodes();
    const lastFew = nodes.slice(-4);

    let textLength = 0;
    let mediaCount = 0;
    let codeCount = 0;

    for (const node of lastFew) {
      textLength += normalizeText(node.textContent || '').length;
      mediaCount += node.querySelectorAll('img, canvas, svg, video').length;
      codeCount += node.querySelectorAll('pre, code, table').length;
    }

    const busy = hasBusyIndicator() ? 1 : 0;
    const outputExists = nodes.length > 0 || textLength > 0 || mediaCount > 0 ? 1 : 0;
    const composer = getPrimaryComposer();
    const composerReady = isComposerInteractive(composer) ? 1 : 0;
    const sendReady = isSendButtonReady() ? 1 : 0;
    const readyForNextTurn = composerReady || sendReady ? 1 : 0;

    return {
      textLength,
      mediaCount,
      codeCount,
      busy,
      outputExists,
      composerReady,
      sendReady,
      readyForNextTurn,
      signature: `${nodes.length}:${textLength}:${mediaCount}:${codeCount}:${busy}:${composerReady}:${sendReady}`
    };
  }

  function resetTurnState() {
    trackedNetworkCount = 0;
    sawTrackedNetworkThisTurn = false;
    lastTrackedNetworkCompleteAt = 0;
    lastMeaningfulChangeAt = 0;
    lastBusySeenAt = 0;
    lastReadySeenAt = 0;
    lastOutputSignature = '';
    stableTickCount = 0;
  }

  function cleanupStartVerification() {
    pendingStart = null;

    if (startVerifyTimer) {
      clearInterval(startVerifyTimer);
      startVerifyTimer = null;
    }
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

  function notifyPromptStarted() {
    const now = Date.now();

    if (now - lastStartSignalAt < START_SIGNAL_COOLDOWN_MS) {
      return;
    }

    lastStartSignalAt = now;
    cleanupStartVerification();

    chrome.runtime.sendMessage({ type: 'LLM_PROMPT_STARTED' }, () => {
      chrome.runtime.lastError;
    });

    startCompletionMonitor();
  }

  function notifyCompleted() {
    cleanupMonitor();

    chrome.runtime.sendMessage({ type: 'LLM_RESPONSE_COMPLETED' }, () => {
      chrome.runtime.lastError;
    });
  }

  function evaluateStartEvidence(state) {
    const now = Date.now();
    const elapsed = now - state.createdAt;

    const currentMetrics = getOutputMetrics();
    const currentComposer = getPrimaryComposer();
    const currentComposerText = normalizeText(getComposerText(currentComposer));
    const previousComposerText = normalizeText(state.beforeComposerText);

    const composerCleared =
      previousComposerText.length > 0 &&
      currentComposerText.length <= Math.floor(previousComposerText.length * 0.3);

    const outputChanged = currentMetrics.signature !== state.beforeMetrics.signature;
    const busy = currentMetrics.busy === 1;
    const nextTurnNotReady = currentMetrics.readyForNextTurn === 0;

    return (
      (busy && elapsed > 220) ||
      (composerCleared && elapsed > 100) ||
      (busy && outputChanged) ||
      (nextTurnNotReady && outputChanged && elapsed > 220)
    );
  }

  function queueStartVerification(reason) {
    if (monitoring) return;

    cleanupStartVerification();
    signalExpectRequest();

    const composer = getPrimaryComposer();

    pendingStart = {
      reason,
      createdAt: Date.now(),
      beforeComposerText: getComposerText(composer),
      beforeMetrics: getOutputMetrics()
    };

    startVerifyTimer = setInterval(() => {
      if (!pendingStart) return;

      const elapsed = Date.now() - pendingStart.createdAt;

      if (evaluateStartEvidence(pendingStart)) {
        notifyPromptStarted();
        return;
      }

      if (elapsed > START_VERIFY_TIMEOUT_MS) {
        cleanupStartVerification();
      }
    }, START_VERIFY_INTERVAL_MS);
  }

  function markMeaningfulChange(metrics, busy, readyForNextTurn) {
    const now = Date.now();

    if (metrics.signature !== lastOutputSignature) {
      lastOutputSignature = metrics.signature;
      lastMeaningfulChangeAt = now;
      stableTickCount = 0;
    } else {
      stableTickCount += 1;
    }

    if (busy) {
      lastBusySeenAt = now;
    }

    if (readyForNextTurn) {
      lastReadySeenAt = now;
    }
  }

  function startCompletionMonitor() {
    if (monitoring) return;

    monitoring = true;
    promptStartedAt = Date.now();

    const initialMetrics = getOutputMetrics();
    const initialBusy = initialMetrics.busy === 1;
    const initialReady = initialMetrics.readyForNextTurn === 1;

    lastOutputSignature = initialMetrics.signature;
    lastMeaningfulChangeAt = Date.now();
    lastBusySeenAt = initialBusy ? Date.now() : 0;
    lastReadySeenAt = initialReady ? Date.now() : 0;
    stableTickCount = 0;
    trackedNetworkCount = 0;
    sawTrackedNetworkThisTurn = false;
    lastTrackedNetworkCompleteAt = 0;

    observer = new MutationObserver(() => {
      const metrics = getOutputMetrics();
      const busy = metrics.busy === 1;
      const ready = metrics.readyForNextTurn === 1;
      markMeaningfulChange(metrics, busy, ready);
    });

    observer.observe(document.documentElement || document, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true
    });

    pollTimer = setInterval(() => {
      const now = Date.now();
      const metrics = getOutputMetrics();
      const busy = metrics.busy === 1;
      const ready = metrics.readyForNextTurn === 1;

      markMeaningfulChange(metrics, busy, ready);

      const enoughTimePassed = now - promptStartedAt >= MIN_COMPLETION_MS;
      const noBusyLongEnough =
        lastBusySeenAt === 0 || now - lastBusySeenAt >= NO_BUSY_WINDOW_MS;
      const readyLongEnough =
        ready && lastReadySeenAt > 0 && now - lastReadySeenAt >= READY_WINDOW_MS;
      const quietEnough = now - lastMeaningfulChangeAt >= QUIET_WINDOW_MS;
      const networkSettled =
        sawTrackedNetworkThisTurn &&
        trackedNetworkCount === 0 &&
        lastTrackedNetworkCompleteAt > 0 &&
        now - lastTrackedNetworkCompleteAt >= NETWORK_SETTLE_MS;

      const networkBasedCompletion =
        enoughTimePassed &&
        networkSettled &&
        noBusyLongEnough &&
        (quietEnough || stableTickCount >= 1);

      const domFallbackCompletion =
        enoughTimePassed &&
        !sawTrackedNetworkThisTurn &&
        !busy &&
        noBusyLongEnough &&
        readyLongEnough &&
        (quietEnough || stableTickCount >= STABLE_TICKS_REQUIRED) &&
        metrics.outputExists === 1;

      const hardFallbackCompletion =
        now - promptStartedAt >= HARD_FALLBACK_COMPLETION_MS &&
        !busy &&
        noBusyLongEnough &&
        metrics.outputExists === 1;

      if (networkBasedCompletion || domFallbackCompletion || hardFallbackCompletion) {
        notifyCompleted();
      }
    }, COMPLETION_POLL_MS);
  }

  window.addEventListener(PAGE_NET_EVENT, (event) => {
    const detail = event?.detail || {};
    const eventProvider = detail.provider || 'generic';

    if (provider !== 'generic' && eventProvider !== provider) {
      return;
    }

    if (detail.phase === 'start') {
      trackedNetworkCount += 1;
      sawTrackedNetworkThisTurn = true;

      if (!monitoring) {
        notifyPromptStarted();
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

      const button = target.closest(
        'button, [role="button"], input[type="submit"], input[type="button"]'
      );

      if (!button) return;
      if (isPotentialStopControl(button)) return;

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
        (target instanceof HTMLElement &&
          (target.isContentEditable || target.getAttribute('role') === 'textbox'));

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

  window.addEventListener('beforeunload', () => {
    cleanupMonitor();
  });

  injectPageBridge();
}