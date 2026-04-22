if (!globalThis.__LLM_WAIT_SWITCHER_LLM_LOADED__) {
  globalThis.__LLM_WAIT_SWITCHER_LLM_LOADED__ = true;

  const SEND_KEYWORDS = ['send', '전송'];
  const STOP_KEYWORDS = ['stop', '중지', '응답 중지', '생성 중지'];

  let monitoring = false;
  let observer = null;
  let pollTimer = null;
  let lastMutationAt = 0;
  let lastAssistantLength = 0;
  let stableCount = 0;
  let promptStartedAt = 0;
  let lastStartSignalAt = 0;

  function normalizeText(text) {
    return (text || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function elementText(el) {
    return normalizeText(
      [
        el?.textContent,
        el?.getAttribute?.('aria-label'),
        el?.getAttribute?.('title'),
        el?.getAttribute?.('data-testid')
      ]
        .filter(Boolean)
        .join(' ')
    );
  }

  function isPotentialSendButton(button) {
    if (!button) return false;
    const text = elementText(button);
    return SEND_KEYWORDS.some((keyword) => text.includes(keyword));
  }

  function hasStopButton() {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.some((button) => {
      const text = elementText(button);
      return STOP_KEYWORDS.some((keyword) => text.includes(keyword));
    });
  }

  function getAssistantTextLength() {
    const selectors = [
      '[data-message-author-role="assistant"]',
      '[data-testid*="assistant"]',
      '[class*="assistant"]'
    ];

    for (const selector of selectors) {
      const nodes = document.querySelectorAll(selector);
      if (nodes.length > 0) {
        const last = nodes[nodes.length - 1];
        return normalizeText(last.textContent).length;
      }
    }

    return 0;
  }

  function cleanupMonitor() {
    monitoring = false;

    if (observer) {
      observer.disconnect();
      observer = null;
    }

    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }

    stableCount = 0;
    lastAssistantLength = 0;
  }

  function notifyPromptStarted() {
    const now = Date.now();
    if (now - lastStartSignalAt < 1200) return;
    lastStartSignalAt = now;

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

  function startCompletionMonitor() {
    if (monitoring) return;

    monitoring = true;
    promptStartedAt = Date.now();
    lastMutationAt = Date.now();
    lastAssistantLength = getAssistantTextLength();
    stableCount = 0;

    observer = new MutationObserver(() => {
      lastMutationAt = Date.now();

      const currentLength = getAssistantTextLength();
      if (currentLength === lastAssistantLength) {
        stableCount += 1;
      } else {
        stableCount = 0;
        lastAssistantLength = currentLength;
      }
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true
    });

    pollTimer = setInterval(() => {
      const now = Date.now();
      const noRecentMutation = now - lastMutationAt > 2500;
      const enoughTimePassed = now - promptStartedAt > 2500;
      const stopGone = !hasStopButton();

      const currentLength = getAssistantTextLength();
      if (currentLength === lastAssistantLength) {
        stableCount += 1;
      } else {
        stableCount = 0;
        lastAssistantLength = currentLength;
      }

      if (enoughTimePassed && stopGone && (noRecentMutation || stableCount >= 4)) {
        notifyCompleted();
      }
    }, 700);
  }

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest('button');
      if (button && isPotentialSendButton(button)) {
        notifyPromptStarted();
      }
    },
    true
  );

  document.addEventListener(
    'keydown',
    (event) => {
      const target = event.target;
      const isTextLike =
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if (!isTextLike) return;

      if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.altKey) {
        notifyPromptStarted();
      }
    },
    true
  );
}