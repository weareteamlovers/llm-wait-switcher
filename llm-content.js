if (!globalThis.__LLM_WAIT_SWITCHER_LLM_LOADED__) {
  globalThis.__LLM_WAIT_SWITCHER_LLM_LOADED__ = true;

  const START_VERIFY_INTERVAL_MS = 250;
  const START_VERIFY_TIMEOUT_MS = 6000;
  const START_SIGNAL_COOLDOWN_MS = 1200;

  const COMPLETION_POLL_MS = 800;
  const MIN_COMPLETION_MS = 2500;
  const QUIET_WINDOW_MS = 2600;
  const STABLE_TICKS_REQUIRED = 4;

  const SEND_KEYWORDS = [
    'send',
    'submit',
    'ask',
    'run',
    'generate',
    'create',
    'imagine',
    'render',
    'start',
    'continue',
    '전송',
    '보내기',
    '질문',
    '생성',
    '만들기',
    '실행',
    '이미지 생성',
    '보내기'
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

  const IGNORE_SEND_KEYWORDS = [
    'retry',
    'regenerate',
    'copy',
    'share',
    'login',
    'sign in',
    'sign up',
    'settings',
    'profile',
    'delete',
    'remove'
  ];

  const PROVIDERS = [
    {
      id: 'chatgpt',
      host: /(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/i,
      sendSelectors: [
        'button[data-testid="send-button"]',
        'button[aria-label*="Send"]'
      ],
      stopSelectors: [
        'button[data-testid="stop-button"]',
        'button[aria-label*="Stop"]'
      ],
      outputSelectors: [
        '[data-message-author-role="assistant"]',
        '[data-testid*="assistant"]',
        '.markdown'
      ],
      busySelectors: [
        'button[data-testid="stop-button"]',
        '[aria-label*="Stop"]'
      ]
    },
    {
      id: 'claude',
      host: /(^|\.)claude\.ai$|(^|\.)code\.claude\.com$/i,
      sendSelectors: [
        'button[aria-label*="Send"]',
        'button[title*="Send"]'
      ],
      stopSelectors: [
        'button[aria-label*="Stop"]',
        'button[aria-label*="Cancel"]'
      ],
      outputSelectors: [
        '[data-testid*="assistant"]',
        '[class*="prose"]',
        'article'
      ],
      busySelectors: [
        '[aria-busy="true"]',
        '[role="progressbar"]'
      ]
    },
    {
      id: 'gemini',
      host: /(^|\.)gemini\.google\.com$|(^|\.)aistudio\.google\.com$/i,
      sendSelectors: [
        'button[aria-label*="Send"]',
        'button[aria-label*="Run"]'
      ],
      stopSelectors: [
        'button[aria-label*="Stop"]',
        'button[aria-label*="Cancel"]'
      ],
      outputSelectors: [
        '[data-test-id*="response"]',
        '[class*="response"]',
        'main'
      ],
      busySelectors: [
        '[aria-busy="true"]',
        '[role="progressbar"]'
      ]
    },
    {
      id: 'copilot',
      host: /(^|\.)copilot\.microsoft\.com$/i,
      sendSelectors: [
        'button[aria-label*="Send"]',
        'button[aria-label*="Submit"]'
      ],
      stopSelectors: [
        'button[aria-label*="Stop"]',
        'button[aria-label*="Cancel"]'
      ],
      outputSelectors: [
        '[data-testid*="message"]',
        'main'
      ],
      busySelectors: [
        '[aria-busy="true"]',
        '[role="progressbar"]'
      ]
    },
    {
      id: 'grok',
      host: /(^|\.)grok\.com$/i,
      sendSelectors: [
        'button[aria-label*="Send"]',
        'button[aria-label*="Submit"]'
      ],
      stopSelectors: [
        'button[aria-label*="Stop"]',
        'button[aria-label*="Cancel"]'
      ],
      outputSelectors: [
        '[data-testid*="assistant"]',
        '[class*="message"]',
        'main'
      ],
      busySelectors: [
        '[aria-busy="true"]',
        '[role="progressbar"]'
      ]
    },
    {
      id: 'perplexity',
      host: /(^|\.)perplexity\.ai$/i,
      sendSelectors: [
        'button[aria-label*="Send"]',
        'button[aria-label*="Ask"]'
      ],
      stopSelectors: [
        'button[aria-label*="Stop"]',
        'button[aria-label*="Cancel"]'
      ],
      outputSelectors: [
        '[class*="answer"]',
        '[class*="thread"]',
        'main'
      ],
      busySelectors: [
        '[aria-busy="true"]',
        '[role="progressbar"]'
      ]
    },
    {
      id: 'poe',
      host: /(^|\.)poe\.com$/i,
      sendSelectors: [
        'button[aria-label*="Send"]',
        'button[aria-label*="Submit"]'
      ],
      stopSelectors: [
        'button[aria-label*="Stop"]',
        'button[aria-label*="Cancel"]'
      ],
      outputSelectors: [
        '[class*="Message"]',
        '[class*="ChatMessage"]',
        'main'
      ],
      busySelectors: [
        '[aria-busy="true"]',
        '[role="progressbar"]'
      ]
    },
    {
      id: 'deepseek',
      host: /(^|\.)deepseek\.com$/i,
      sendSelectors: [
        'button[aria-label*="Send"]',
        'button[aria-label*="Submit"]'
      ],
      stopSelectors: [
        'button[aria-label*="Stop"]',
        'button[aria-label*="Cancel"]'
      ],
      outputSelectors: [
        '[class*="message"]',
        '[class*="answer"]',
        'main'
      ],
      busySelectors: [
        '[aria-busy="true"]',
        '[role="progressbar"]'
      ]
    },
    {
      id: 'mistral',
      host: /(^|\.)mistral\.ai$/i,
      sendSelectors: [
        'button[aria-label*="Send"]',
        'button[aria-label*="Submit"]'
      ],
      stopSelectors: [
        'button[aria-label*="Stop"]',
        'button[aria-label*="Cancel"]'
      ],
      outputSelectors: [
        '[class*="message"]',
        '[class*="response"]',
        'main'
      ],
      busySelectors: [
        '[aria-busy="true"]',
        '[role="progressbar"]'
      ]
    },
    {
      id: 'midjourney',
      host: /(^|\.)midjourney\.com$/i,
      sendSelectors: [
        'button[aria-label*="Generate"]',
        'button[aria-label*="Create"]',
        'button[aria-label*="Imagine"]'
      ],
      stopSelectors: [
        'button[aria-label*="Stop"]',
        'button[aria-label*="Cancel"]'
      ],
      outputSelectors: [
        'main',
        '[class*="grid"]',
        '[class*="feed"]'
      ],
      busySelectors: [
        '[aria-busy="true"]',
        '[role="progressbar"]',
        'progress'
      ]
    },
    {
      id: 'cursor',
      host: /(^|\.)cursor\.com$/i,
      sendSelectors: [
        'button[aria-label*="Send"]',
        'button[aria-label*="Submit"]',
        'button[aria-label*="Run"]'
      ],
      stopSelectors: [
        'button[aria-label*="Stop"]',
        'button[aria-label*="Cancel"]'
      ],
      outputSelectors: [
        '[data-testid*="assistant"]',
        '[class*="message"]',
        'main'
      ],
      busySelectors: [
        '[aria-busy="true"]',
        '[role="progressbar"]'
      ]
    },
    {
      id: 'qwen',
      host: /(^|\.)qwen\.ai$/i,
      sendSelectors: [
        'button[aria-label*="Send"]',
        'button[aria-label*="Submit"]'
      ],
      stopSelectors: [
        'button[aria-label*="Stop"]',
        'button[aria-label*="Cancel"]'
      ],
      outputSelectors: [
        '[class*="message"]',
        '[class*="answer"]',
        'main'
      ],
      busySelectors: [
        '[aria-busy="true"]',
        '[role="progressbar"]'
      ]
    },
    {
      id: 'kimi',
      host: /(^|\.)kimi\.com$/i,
      sendSelectors: [
        'button[aria-label*="Send"]',
        'button[aria-label*="Submit"]'
      ],
      stopSelectors: [
        'button[aria-label*="Stop"]',
        'button[aria-label*="Cancel"]'
      ],
      outputSelectors: [
        '[class*="message"]',
        '[class*="answer"]',
        'main'
      ],
      busySelectors: [
        '[aria-busy="true"]',
        '[role="progressbar"]'
      ]
    }
  ];

  function normalizeText(text = '') {
    return String(text).replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function isVisible(element) {
    if (!(element instanceof Element)) return false;
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  function elementText(element) {
    if (!(element instanceof Element)) return '';

    return normalizeText(
      [
        element.textContent,
        element.getAttribute('aria-label'),
        element.getAttribute('title'),
        element.getAttribute('data-testid'),
        element.getAttribute('data-state'),
        element.getAttribute('name')
      ]
        .filter(Boolean)
        .join(' ')
    );
  }

  function getProvider() {
    const host = location.hostname;
    return (
      PROVIDERS.find((provider) => provider.host.test(host)) || {
        id: 'generic',
        sendSelectors: [],
        stopSelectors: [],
        outputSelectors: ['main', '[role="main"]', 'article'],
        busySelectors: ['[aria-busy="true"]', '[role="progressbar"]']
      }
    );
  }

  const provider = getProvider();

  function dedupeElements(elements) {
    const seen = new Set();
    const result = [];

    for (const element of elements) {
      if (!(element instanceof Element)) continue;
      if (seen.has(element)) continue;
      seen.add(element);
      result.push(element);
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

  function getComposerCandidates() {
    const selectors = [
      'textarea',
      '[contenteditable="true"]',
      '[role="textbox"]',
      'input[type="text"]',
      'input:not([type])'
    ];

    return dedupeElements(
      selectors.flatMap((selector) => getVisibleElementsBySelector(selector))
    )
      .filter((element) => {
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          if (element.disabled || element.readOnly) return false;
        }

        const rect = element.getBoundingClientRect();
        return rect.width >= 120 && rect.height >= 18;
      })
      .sort((a, b) => {
        const rectA = a.getBoundingClientRect();
        const rectB = b.getBoundingClientRect();

        if (rectB.bottom !== rectA.bottom) {
          return rectB.bottom - rectA.bottom;
        }

        return rectB.width * rectB.height - rectA.width * rectA.height;
      });
  }

  function getPrimaryComposer() {
    return getComposerCandidates()[0] || null;
  }

  function getComposerText(element) {
    if (!element) return '';

    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
      return element.value || '';
    }

    return element.textContent || '';
  }

  function isPotentialSendButton(button) {
    if (!(button instanceof Element) || !isVisible(button)) return false;
    if (button.matches('[disabled], [aria-disabled="true"]')) return false;

    const text = elementText(button);

    if (!text) return false;
    if (IGNORE_SEND_KEYWORDS.some((keyword) => text.includes(keyword))) return false;

    if (provider.sendSelectors.some((selector) => button.matches(selector))) {
      return true;
    }

    return SEND_KEYWORDS.some((keyword) => text.includes(keyword));
  }

  function isPotentialStopControl(element) {
    if (!(element instanceof Element) || !isVisible(element)) return false;

    if (provider.stopSelectors.some((selector) => element.matches(selector))) {
      return true;
    }

    const text = elementText(element);
    return STOP_KEYWORDS.some((keyword) => text.includes(keyword));
  }

  function hasActiveStopControl() {
    const specific = provider.stopSelectors.flatMap((selector) =>
      getVisibleElementsBySelector(selector)
    );

    if (specific.some((element) => isPotentialStopControl(element))) {
      return true;
    }

    const generic = Array.from(
      document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]')
    ).filter(isVisible);

    return generic.some((element) => isPotentialStopControl(element));
  }

  function hasBusyIndicator() {
    const selectors = [
      ...provider.busySelectors,
      '[aria-busy="true"]',
      '[role="progressbar"]',
      'progress',
      '[role="status"]',
      '[data-state="loading"]',
      '[class*="loading"]',
      '[class*="spinner"]',
      '[class*="typing"]'
    ];

    const nodes = dedupeElements(
      selectors.flatMap((selector) => getVisibleElementsBySelector(selector))
    ).slice(0, 80);

    for (const node of nodes) {
      const text = elementText(node);
      if (
        BUSY_KEYWORDS.some((keyword) => text.includes(keyword)) ||
        node.matches('[aria-busy="true"], [role="progressbar"], progress')
      ) {
        return true;
      }
    }

    const buttons = Array.from(document.querySelectorAll('button, [role="button"]'))
      .filter(isVisible)
      .slice(0, 80);

    return buttons.some((button) => {
      const text = elementText(button);
      return BUSY_KEYWORDS.some((keyword) => text.includes(keyword));
    });
  }

  function getOutputRoots() {
    const selectors = [
      ...provider.outputSelectors,
      '[data-message-author-role="assistant"]',
      '[data-testid*="assistant"]',
      '[class*="assistant"]',
      '[class*="response"]',
      '[class*="answer"]',
      '[class*="message"]',
      'main',
      '[role="main"]',
      'article'
    ];

    const roots = dedupeElements(
      selectors.flatMap((selector) => getVisibleElementsBySelector(selector))
    ).filter((element) => {
      const textLength = normalizeText(element.textContent || '').length;
      const mediaCount = element.querySelectorAll('img, canvas, video, svg').length;
      return textLength > 0 || mediaCount > 0 || element.matches('main, [role="main"], article');
    });

    if (roots.length > 0) {
      return roots.slice(0, 6);
    }

    const main = document.querySelector('main, [role="main"]');
    if (main instanceof Element && isVisible(main)) {
      return [main];
    }

    return [document.body];
  }

  function getOutputMetrics() {
    let textLength = 0;
    let mediaCount = 0;
    let busyNodeCount = 0;

    for (const root of getOutputRoots()) {
      const text = normalizeText(root.textContent || '');
      textLength += Math.min(text.length, 12000);
      mediaCount += root.querySelectorAll('img, canvas, video, svg').length;
      busyNodeCount += root.querySelectorAll('[aria-busy="true"], [role="progressbar"], progress').length;
    }

    if (hasActiveStopControl()) {
      busyNodeCount += 1;
    }

    const signature = `${textLength}:${mediaCount}:${busyNodeCount}`;

    return {
      textLength,
      mediaCount,
      busyNodeCount,
      signature,
      total: textLength + mediaCount * 250 + busyNodeCount * 100
    };
  }

  let monitoring = false;
  let completionObserver = null;
  let completionTimer = null;
  let verifyTimer = null;
  let pendingAction = null;

  let promptStartedAt = 0;
  let lastStartSignalAt = 0;
  let lastMutationAt = 0;
  let lastOutputSignature = '';
  let stableTickCount = 0;

  function clearPendingAction() {
    pendingAction = null;

    if (verifyTimer) {
      clearInterval(verifyTimer);
      verifyTimer = null;
    }
  }

  function cleanupMonitor() {
    monitoring = false;
    clearPendingAction();

    if (completionObserver) {
      completionObserver.disconnect();
      completionObserver = null;
    }

    if (completionTimer) {
      clearInterval(completionTimer);
      completionTimer = null;
    }

    stableTickCount = 0;
    lastOutputSignature = '';
  }

  function notifyPromptStarted() {
    const now = Date.now();

    if (now - lastStartSignalAt < START_SIGNAL_COOLDOWN_MS) {
      return;
    }

    lastStartSignalAt = now;
    clearPendingAction();

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

    const outputChanged =
      currentMetrics.signature !== state.beforeMetrics.signature ||
      currentMetrics.total > state.beforeMetrics.total + 40;

    const composerChanged = currentComposerText !== previousComposerText;
    const composerCleared =
      previousComposerText.length > 0 &&
      currentComposerText.length <= Math.max(0, Math.floor(previousComposerText.length * 0.25));

    const busy = hasBusyIndicator() || hasActiveStopControl();

    if (busy && (outputChanged || composerChanged || elapsed > 800)) {
      return true;
    }

    if (outputChanged && (composerChanged || elapsed > 1200)) {
      return true;
    }

    if (composerCleared && busy) {
      return true;
    }

    return false;
  }

  function queueStartVerification(reason) {
    if (monitoring) return;

    const now = Date.now();

    if (pendingAction && now - pendingAction.createdAt < 500) {
      return;
    }

    clearPendingAction();

    const composer = getPrimaryComposer();

    pendingAction = {
      reason,
      createdAt: now,
      beforeMetrics: getOutputMetrics(),
      beforeComposerText: getComposerText(composer)
    };

    verifyTimer = setInterval(() => {
      if (!pendingAction) return;

      const elapsed = Date.now() - pendingAction.createdAt;

      if (evaluateStartEvidence(pendingAction)) {
        notifyPromptStarted();
        return;
      }

      if (elapsed > START_VERIFY_TIMEOUT_MS) {
        clearPendingAction();
      }
    }, START_VERIFY_INTERVAL_MS);
  }

  function startCompletionMonitor() {
    if (monitoring) return;

    monitoring = true;
    promptStartedAt = Date.now();
    lastMutationAt = Date.now();
    lastOutputSignature = getOutputMetrics().signature;
    stableTickCount = 0;

    completionObserver = new MutationObserver(() => {
      lastMutationAt = Date.now();

      const currentSignature = getOutputMetrics().signature;

      if (currentSignature === lastOutputSignature) {
        stableTickCount += 1;
      } else {
        stableTickCount = 0;
        lastOutputSignature = currentSignature;
      }
    });

    completionObserver.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true
    });

    completionTimer = setInterval(() => {
      const now = Date.now();
      const metrics = getOutputMetrics();
      const busy = hasBusyIndicator() || hasActiveStopControl() || metrics.busyNodeCount > 0;

      if (metrics.signature === lastOutputSignature) {
        stableTickCount += 1;
      } else {
        stableTickCount = 0;
        lastOutputSignature = metrics.signature;
        lastMutationAt = now;
      }

      const enoughTime = now - promptStartedAt > MIN_COMPLETION_MS;
      const quietEnough = now - lastMutationAt > QUIET_WINDOW_MS;

      if (enoughTime && !busy && (quietEnough || stableTickCount >= STABLE_TICKS_REQUIRED)) {
        notifyCompleted();
        return;
      }

      if (enoughTime && quietEnough && stableTickCount >= STABLE_TICKS_REQUIRED + 4) {
        notifyCompleted();
      }
    }, COMPLETION_POLL_MS);
  }

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest('button, [role="button"], input[type="submit"]');
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

      if (!(target instanceof Element)) return;

      const inputLike = target.closest(
        'textarea, [contenteditable="true"], [role="textbox"], input[type="text"], input:not([type])'
      );

      if (!inputLike) return;

      const isEnter = event.key === 'Enter';
      const likelySendShortcut =
        (isEnter && !event.shiftKey && !event.altKey) ||
        ((event.metaKey || event.ctrlKey) && isEnter);

      if (!likelySendShortcut) return;

      queueStartVerification('keydown');
    },
    true
  );

  window.addEventListener('beforeunload', () => {
    cleanupMonitor();
  });
}