const STORAGE_KEYS = {
  TARGET_TAB: 'targetTab',
  SETTINGS: 'settings',
  SESSIONS: 'sessions'
};

const DEFAULT_SETTINGS = {
  autoPlayEnabled: true,
  autoPauseOnReturnEnabled: true,
  debugEnabled: false
};

const LLM_URL_PATTERNS = [
  /^https:\/\/chatgpt\.com\//i,
  /^https:\/\/chat\.openai\.com\//i,
  /^https:\/\/claude\.ai\//i,
  /^https:\/\/code\.claude\.com\//i,
  /^https:\/\/gemini\.google\.com\//i,
  /^https:\/\/aistudio\.google\.com\//i,
  /^https:\/\/copilot\.microsoft\.com\//i,
  /^https:\/\/grok\.com\//i,
  /^https:\/\/www\.perplexity\.ai\//i,
  /^https:\/\/poe\.com\//i,
  /^https:\/\/chat\.deepseek\.com\//i,
  /^https:\/\/chat\.mistral\.ai\//i,
  /^https:\/\/www\.midjourney\.com\//i,
  /^https:\/\/alpha\.midjourney\.com\//i,
  /^https:\/\/cursor\.com\//i,
  /^https:\/\/chat\.qwen\.ai\//i,
  /^https:\/\/qwen\.ai\//i,
  /^https:\/\/www\.kimi\.com\//i,
  /^https:\/\/kimi\.com\//i
];

const MEDIA_URL_PATTERNS = [
  /youtube\.com/i,
  /netflix\.com/i,
  /disneyplus\.com/i,
  /primevideo\.com/i,
  /twitch\.tv/i,
  /vimeo\.com/i
];

function matchesAny(url = '', patterns = []) {
  return patterns.some((pattern) => pattern.test(url));
}

function isLlmUrl(url = '') {
  return matchesAny(url, LLM_URL_PATTERNS);
}

function isMediaUrl(url = '') {
  return matchesAny(url, MEDIA_URL_PATTERNS);
}

async function getStorage(keys) {
  return chrome.storage.local.get(keys);
}

async function setStorage(data) {
  return chrome.storage.local.set(data);
}

async function removeStorage(keys) {
  return chrome.storage.local.remove(keys);
}

async function getSettings() {
  const data = await getStorage(STORAGE_KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...(data[STORAGE_KEYS.SETTINGS] || {}) };
}

async function getSessions() {
  const data = await getStorage(STORAGE_KEYS.SESSIONS);
  return data[STORAGE_KEYS.SESSIONS] || {};
}

async function saveSessions(sessions) {
  await setStorage({ [STORAGE_KEYS.SESSIONS]: sessions });
}

async function validateTab(tabId) {
  try {
    return await chrome.tabs.get(tabId);
  } catch {
    return null;
  }
}

async function focusTab(tabId, windowId) {
  try {
    if (typeof windowId === 'number') {
      await chrome.windows.update(windowId, { focused: true });
    }
    await chrome.tabs.update(tabId, { active: true });
    return true;
  } catch {
    return false;
  }
}

async function injectIfNeeded(tabId, file) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: [file] });
  } catch {
    // ignore tabs where injection is unsupported
  }
}

async function ensureScriptsForExistingTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (!tab.id || !tab.url) continue;
      if (isLlmUrl(tab.url)) await injectIfNeeded(tab.id, 'llm-content.js');
      if (isMediaUrl(tab.url)) await injectIfNeeded(tab.id, 'player-content.js');
    }
  } catch {
    // ignore
  }
}

async function initStorage() {
  const data = await getStorage([STORAGE_KEYS.SETTINGS, STORAGE_KEYS.SESSIONS]);
  await setStorage({
    [STORAGE_KEYS.SETTINGS]: {
      ...DEFAULT_SETTINGS,
      ...(data[STORAGE_KEYS.SETTINGS] || {})
    },
    [STORAGE_KEYS.SESSIONS]: data[STORAGE_KEYS.SESSIONS] || {}
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  await initStorage();
  await ensureScriptsForExistingTabs();
});

chrome.runtime.onStartup.addListener(async () => {
  await initStorage();
  await ensureScriptsForExistingTabs();
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;
  if (isLlmUrl(tab.url)) await injectIfNeeded(tabId, 'llm-content.js');
  if (isMediaUrl(tab.url)) await injectIfNeeded(tabId, 'player-content.js');
});

chrome.tabs.onRemoved.addListener(async (removedTabId) => {
  const data = await getStorage([STORAGE_KEYS.TARGET_TAB, STORAGE_KEYS.SESSIONS]);
  const targetTab = data[STORAGE_KEYS.TARGET_TAB];
  const sessions = data[STORAGE_KEYS.SESSIONS] || {};

  if (targetTab?.tabId === removedTabId) {
    await removeStorage(STORAGE_KEYS.TARGET_TAB);
  }

  let changed = false;
  for (const [sourceTabId, session] of Object.entries(sessions)) {
    if (session.sourceTabId === removedTabId || session.targetTabId === removedTabId) {
      delete sessions[sourceTabId];
      changed = true;
    }
  }

  if (changed) {
    await saveSessions(sessions);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message?.type === 'GET_RUNTIME_STATE') {
        const data = await getStorage([
          STORAGE_KEYS.TARGET_TAB,
          STORAGE_KEYS.SETTINGS,
          STORAGE_KEYS.SESSIONS
        ]);
        sendResponse({
          ok: true,
          targetTab: data[STORAGE_KEYS.TARGET_TAB] || null,
          settings: { ...DEFAULT_SETTINGS, ...(data[STORAGE_KEYS.SETTINGS] || {}) },
          sessions: data[STORAGE_KEYS.SESSIONS] || {}
        });
        return;
      }

      if (message?.type === 'LLM_PROMPT_STARTED') {
        const sourceTab = sender.tab;
        if (!sourceTab?.id) {
          sendResponse({ ok: false, reason: 'NO_SOURCE_TAB' });
          return;
        }

        const data = await getStorage(STORAGE_KEYS.TARGET_TAB);
        const target = data[STORAGE_KEYS.TARGET_TAB];
        if (!target?.tabId) {
          sendResponse({ ok: false, reason: 'NO_TARGET_TAB' });
          return;
        }

        if (target.tabId === sourceTab.id) {
          sendResponse({ ok: false, reason: 'TARGET_EQUALS_SOURCE' });
          return;
        }

        const targetTab = await validateTab(target.tabId);
        if (!targetTab?.id) {
          await removeStorage(STORAGE_KEYS.TARGET_TAB);
          sendResponse({ ok: false, reason: 'TARGET_TAB_CLOSED' });
          return;
        }

        const sessions = await getSessions();
        sessions[String(sourceTab.id)] = {
          sourceTabId: sourceTab.id,
          sourceWindowId: sourceTab.windowId,
          sourceUrl: sourceTab.url || '',
          sourceTitle: sourceTab.title || '',
          targetTabId: targetTab.id,
          targetWindowId: targetTab.windowId,
          targetUrl: targetTab.url || target.url || '',
          targetTitle: targetTab.title || target.title || '',
          startedAt: Date.now()
        };
        await saveSessions(sessions);

        const settings = await getSettings();
        if (isMediaUrl(targetTab.url || '')) {
          await injectIfNeeded(targetTab.id, 'player-content.js');
        }

        await focusTab(targetTab.id, targetTab.windowId);

        if (settings.autoPlayEnabled && isMediaUrl(targetTab.url || '')) {
          chrome.tabs.sendMessage(targetTab.id, { type: 'TRY_PLAY' }, () => {
            void chrome.runtime.lastError;
          });
        }

        sendResponse({ ok: true });
        return;
      }

      if (message?.type === 'LLM_RESPONSE_COMPLETED') {
        const sourceTab = sender.tab;
        if (!sourceTab?.id) {
          sendResponse({ ok: false, reason: 'NO_SOURCE_TAB' });
          return;
        }

        const sessions = await getSessions();
        const session = sessions[String(sourceTab.id)];
        if (!session) {
          sendResponse({ ok: false, reason: 'NO_SESSION' });
          return;
        }

        const settings = await getSettings();
        const validTarget = await validateTab(session.targetTabId);
        if (
          validTarget?.id &&
          settings.autoPauseOnReturnEnabled &&
          isMediaUrl(validTarget.url || session.targetUrl || '')
        ) {
          await injectIfNeeded(validTarget.id, 'player-content.js');
          await new Promise((resolve) => {
            chrome.tabs.sendMessage(validTarget.id, { type: 'TRY_PAUSE' }, () => {
              void chrome.runtime.lastError;
              resolve();
            });
          });
        }

        const validSource = await validateTab(session.sourceTabId);
        if (validSource?.id) {
          await focusTab(validSource.id, session.sourceWindowId);
        }

        delete sessions[String(sourceTab.id)];
        await saveSessions(sessions);
        sendResponse({ ok: true });
        return;
      }

      sendResponse({ ok: false, reason: 'UNKNOWN_MESSAGE' });
    } catch (error) {
      sendResponse({
        ok: false,
        reason: 'INTERNAL_ERROR',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  })();

  return true;
});

ensureScriptsForExistingTabs();
