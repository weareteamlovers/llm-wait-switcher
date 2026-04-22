if (!globalThis.__LLM_WAIT_SWITCHER_LLM_LOADED__) {
  globalThis.__LLM_WAIT_SWITCHER_LLM_LOADED__ = true;

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
    '응답 중지',
    '생성 중지',
    '중지',
    '취소'
  ];

  const COPY_KEYWORDS = [
    'copy',
    'copy response',
    'copy text',
    'copy message',
    '복사',
    '답변 복사',
    '응답 복사',
    '텍스트 복사'
  ];

  const IGNORE_COPY_KEYWORDS = [
    'copy link',
    'copy url',
    'copy invite',
    'copy code block',
    'copy prompt',
    'copy conversation'
  ];

  const START_SIGNAL_COOLDOWN_MS = 1400;
  const START_VERIFY_INTERVAL_MS = 250;
  const START_VERIFY_TIMEOUT_MS = 5000;

  const COMPLETION_POLL_MS = 900;
  const MIN_COMPLETION_MS = 5000;
  const QUIET_WINDOW_MS = 4200;
  const NO_BUSY_WINDOW_MS = 1800;
  const STABLE_TICKS_REQUIRED = 5;

  let monitoring = false;
  let observer = null;
  let pollTimer = null;
  let startVerifyTimer = null;

  let promptStartedAt = 0;
  let lastStartSignalAt = 0;

  let lastMeaningfulChangeAt = 0;
  let lastBusySeenAt = 0;
  let lastOutputSignature = '';
  let stableTickCount = 0;

  let pendingStart = null;

  function normalizeText(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
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

  function getPrimaryComposer() {
    const candidates = Array.from(
      document.querySelectorAll(
        'textarea, [contenteditable="true"], [role="textbox"], input[type="text"], input:not([type])'
      )
    ).filter(isVisible);

    candidates.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return rb.bottom - ra.bottom;
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

  function isPotentialSendButton(button) {
    if (!(button instanceof Element) || !isVisible(button)) return false;
    if (button.matches('[disabled], [aria-disabled="true"]')) return false;

    if (
      button.matches('button[data-testid="send-button"]') ||
      button.matches('button[aria-label*="Send"]') ||
      button.matches('button[aria-label*="전송"]')
    ) {
      return true;
    }

    const text = elementText(button);
    if (!text) return false;
    if (STOP_KEYWORDS.some((keyword) => text.includes(keyword))) return false;

    return SEND_KEYWORDS.some((keyword) => text.includes(keyword));
  }

  function isPotentialStopButton(button) {
    if (!(button instanceof Element) || !isVisible(button)) return false;

    if (
      button.matches('button[data-testid="stop-button"]') ||
      button.matches('button[aria-label*="Stop"]') ||
      button.matches('button[aria-label*="Cancel"]') ||
      button.matches('button[aria-label*="중지"]') ||
      button.matches('button[aria-label*="취소"]')
    ) {
      return true;
    }

    const text = elementText(button);
    if (!text) return false;

    return STOP_KEYWORDS.some((keyword) => text.includes(keyword));
  }

  function hasStopButton() {
    const controls = Array.from(
      document.querySelectorAll(
        'button, [role="button"], input[type="button"], input[type="submit"]'
      )
    ).filter(isVisible);

    return controls.some((button) => isPotentialStopButton(button));
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

    for (const selector of busySelectors) {
      const nodes = Array.from(document.querySelectorAll(selector)).filter(isVisible);
      if (nodes.length > 0) return true;
    }

    const statusNodes = Array.from(
      document.querySelectorAll('[role="status"], [aria-live], button, [role="button"]')
    ).filter(isVisible);

    const busyWords = [
      'thinking',
      'generating',
      'processing',
      'rendering',
      'searching',
      'working',
      '답변 생성',
      '생성 중',
      '생각 중',
      '처리 중',
      '렌더링 중',
      '검색 중'
    ];

    return statusNodes.some((node) => {
      const text = elementText(node);
      return busyWords.some((word) => text.includes(word));
    });
  }

  function getAssistantNodes() {
    const selectors = [
      '[data-message-author-role="assistant"]',
      '[data-testid*="assistant"]',
      '[class*="assistant"]',
      'main article',
      '[class*="message"]',
      '[class*="response"]',
      '[class*="answer"]'
    ];

    const seen = new Set();
    const nodes = [];

    for (const selector of selectors) {
      let found = [];
      try {
        found = Array.from(document.querySelectorAll(selector));
      } catch (error) {
        found = [];
      }

      for (const node of found) {
        if (!(node instanceof Element)) continue;
        if (!isVisible(node)) continue;
        if (seen.has(node)) continue;

        const textLength = normalizeText(node.textContent || '').length;
        const mediaCount = node.querySelectorAll('img, canvas, svg, video').length;

        if (textLength === 0 && mediaCount === 0 && !node.matches('main, article')) {
          continue;
        }

        seen.add(node);
        nodes.push(node);
      }
    }

    return nodes;
  }

  function getLatestAssistantNode() {
    const nodes = getAssistantNodes();
    return nodes.length ? nodes[nodes.length - 1] : null;
  }

  function getNearbyCopySearchRoots(baseNode) {
    if (!(baseNode instanceof Element)) return [];

    const roots = [baseNode];

    if (baseNode.parentElement) roots.push(baseNode.parentElement);
    if (baseNode.parentElement?.parentElement) roots.push(baseNode.parentElement.parentElement);

    const next = baseNode.nextElementSibling;
    if (next) roots.push(next);

    return [...new Set(roots)];
  }

  function isPotentialCopyControl(control) {
    if (!(control instanceof Element) || !isVisible(control)) return false;

    const text = elementText(control);
    if (!text) return false;

    if (IGNORE_COPY_KEYWORDS.some((keyword) => text.includes(keyword))) {
      return false;
    }

    if (
      control.matches('button[aria-label*="Copy"]') ||
      control.matches('button[aria-label*="복사"]') ||
      control.matches('[data-testid*="copy"]') ||
      control.matches('[title*="Copy"]') ||
      control.matches('[title*="복사"]')
    ) {
      return true;
    }

    return COPY_KEYWORDS.some((keyword) => text.includes(keyword));
  }

  function hasResponseCopyAffordance() {
    const latestNode = getLatestAssistantNode();
    if (!latestNode) return false;

    const roots = getNearbyCopySearchRoots(latestNode);

    for (const root of roots) {
      const controls = Array.from(
        root.querySelectorAll(
          'button, [role="button"], [data-testid], [title], .copy, [class*="copy"]'
        )
      ).filter(isVisible);

      if (controls.some((control) => isPotentialCopyControl(control))) {
        return true;
      }
    }

    return false;
  }

  function getOutputMetrics() {
    const assistantNodes = getAssistantNodes();
    const lastFew = assistantNodes.slice(-4);

    let textLength = 0;
    let imageCount = 0;
    let codeCount = 0;

    for (const node of lastFew) {
      textLength += normalizeText(node.textContent || '').length;
      imageCount += node.querySelectorAll('img, canvas, svg, video').length;
      codeCount += node.querySelectorAll('pre, code, table').length;
    }

    const busy = hasBusyIndicator() ? 1 : 0;
    const hasCopy = hasResponseCopyAffordance() ? 1 : 0;

    return {
      assistantCount: assistantNodes.length,
      textLength,
      imageCount,
      codeCount,
      busy,
      hasCopy,
      signature: `${assistantNodes.length}:${textLength}:${imageCount}:${codeCount}:${busy}:${hasCopy}`
    };
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

    stableTickCount = 0;
    lastMeaningfulChangeAt = 0;
    lastBusySeenAt = 0;
    lastOutputSignature = '';
  }

  function notifyPromptStarted() {
    const now = Date.now();

    if (now - lastStartSignalAt < START_SIGNAL_COOLDOWN_MS) return;

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

  function queueStartVerification(reason) {
    if (monitoring) return;

    cleanupStartVerification();

    const composer = getPrimaryComposer();

    pendingStart = {
      reason,
      createdAt: Date.now(),
      beforeComposerText: normalizeText(getComposerText(composer)),
      beforeMetrics: getOutputMetrics()
    };

    startVerifyTimer = setInterval(() => {
      if (!pendingStart) return;

      const now = Date.now();
      const elapsed = now - pendingStart.createdAt;
      const composerNow = getPrimaryComposer();
      const composerTextNow = normalizeText(getComposerText(composerNow));
      const metricsNow = getOutputMetrics();

      const composerCleared =
        pendingStart.beforeComposerText.length > 0 &&
        composerTextNow.length <= Math.floor(pendingStart.beforeComposerText.length * 0.3);

      const outputChanged = metricsNow.signature !== pendingStart.beforeMetrics.signature;
      const busy = metricsNow.busy === 1;

      if ((busy && elapsed > 250) || (composerCleared && elapsed > 120) || (busy && outputChanged)) {
        notifyPromptStarted();
        return;
      }

      if (elapsed > START_VERIFY_TIMEOUT_MS) {
        cleanupStartVerification();
      }
    }, START_VERIFY_INTERVAL_MS);
  }

  function markMeaningfulChange(metrics, busy) {
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
  }

  function startCompletionMonitor() {
    if (monitoring) return;

    monitoring = true;
    promptStartedAt = Date.now();

    const initialMetrics = getOutputMetrics();
    const initialBusy = initialMetrics.busy === 1;

    lastOutputSignature = initialMetrics.signature;
    lastMeaningfulChangeAt = Date.now();
    lastBusySeenAt = initialBusy ? Date.now() : 0;
    stableTickCount = 0;

    observer = new MutationObserver(() => {
      const metrics = getOutputMetrics();
      const busy = metrics.busy === 1;
      markMeaningfulChange(metrics, busy);
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true
    });

    pollTimer = setInterval(() => {
      const now = Date.now();
      const metrics = getOutputMetrics();
      const busy = metrics.busy === 1;
      const copyReady = metrics.hasCopy === 1;

      markMeaningfulChange(metrics, busy);

      const enoughTimePassed = now - promptStartedAt >= MIN_COMPLETION_MS;
      const quietEnough = now - lastMeaningfulChangeAt >= QUIET_WINDOW_MS;
      const noBusyLongEnough =
        lastBusySeenAt === 0 || now - lastBusySeenAt >= NO_BUSY_WINDOW_MS;

      const copyBasedCompletion =
        enoughTimePassed &&
        copyReady &&
        !busy &&
        noBusyLongEnough &&
        stableTickCount >= 2;

      const conservativeCompletion =
        enoughTimePassed &&
        !busy &&
        noBusyLongEnough &&
        quietEnough &&
        stableTickCount >= STABLE_TICKS_REQUIRED;

      if (copyBasedCompletion || conservativeCompletion) {
        notifyCompleted();
      }
    }, COMPLETION_POLL_MS);
  }

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest(
        'button, [role="button"], input[type="submit"], input[type="button"]'
      );

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
}