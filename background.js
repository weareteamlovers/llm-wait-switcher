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

const MEDIA_URL_RE = /youtube\.com|netflix\.com|disneyplus\.com|primevideo\.com|twitch\.tv|vimeo\.com/i;
const LLM_URL_RE = /(chatgpt\.com|chat\.openai\.com|claude\.ai|code\.claude\.com|gemini\.google\.com|aistudio\.google\.com|copilot\.microsoft\.com|grok\.com|perplexity\.ai|poe\.com|deepseek\.com|mistral\.ai|midjourney\.com|cursor\.com|qwen\.ai|kimi\.com)/i;

function isMediaUrl(url = '') {
  return MEDIA_URL_RE.test(url);
}

function isLlmUrl(url = '') {
  return LLM_URL_RE.test(url);
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
  } catch (error) {
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
  } catch (error) {
    return false;
  }
}

async function injectScriptIfNeeded(tabId, file) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [file]
    });
  } catch (error) {
    // Ignore restricted tabs or duplicate injections.
  }
}

async function maybeSendToPlayer(tabId, type) {
  try {
    await chrome.tabs.sendMessage(tabId, { type });
  } catch (error) {
    // Ignore message delivery errors.
  }
}

async function ensureContentScriptsForOpenTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (!tab.id || !tab.url) continue;
      if (isLlmUrl(tab.url)) {
        await injectScriptIfNeeded(tab.id, 'llm-content.js');
      }
      if (isMediaUrl(tab.url)) {
        await injectScriptIfNeeded(tab.id, 'player-content.js');
      }
    }
  } catch (error) {
    // Ignore startup injection failures.
  }
}

async function cleanupInvalidState() {
  const data = await getStorage([STORAGE_KEYS.TARGET_TAB, STORAGE_KEYS.SESSIONS]);
  const targetTab = data[STORAGE_KEYS.TARGET_TAB];
  const sessions = data[STORAGE_KEYS.SESSIONS] || {};
  let sessionsChanged = false;

  if (targetTab?.tabId) {
    const validTarget = await validateTab(targetTab.tabId);
    if (!validTarget?.id) {
      await removeStorage(STORAGE_KEYS.TARGET_TAB);
    }
  }

  for (const [sourceTabId, session] of Object.entries(sessions)) {
    const sourceValid = await validateTab(session.sourceTabId);
    const targetValid = await validateTab(session.targetTabId);
    if (!sourceValid?.id || !targetValid?.id) {
      delete sessions[sourceTabId];
      sessionsChanged = true;
    }
  }

  if (sessionsChanged) {
    await saveSessions(sessions);
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const data = await getStorage([STORAGE_KEYS.SETTINGS, STORAGE_KEYS.SESSIONS]);
  await setStorage({
    [STORAGE_KEYS.SETTINGS]: { ...DEFAULT_SETTINGS, ...(data[STORAGE_KEYS.SETTINGS] || {}) },
    [STORAGE_KEYS.SESSIONS]: data[STORAGE_KEYS.SESSIONS] || {}
  });
  await ensureContentScriptsForOpenTabs();
  await cleanupInvalidState();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureContentScriptsForOpenTabs();
  await cleanupInvalidState();
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!tab.url) return;
  if (changeInfo.status === 'complete') {
    if (isLlmUrl(tab.url)) {
      await injectScriptIfNeeded(tabId, 'llm-content.js');
    }
    if (isMediaUrl(tab.url)) {
      await injectScriptIfNeeded(tabId, 'player-content.js');
    }
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const data = await getStorage([STORAGE_KEYS.TARGET_TAB, STORAGE_KEYS.SESSIONS]);
  const targetTab = data[STORAGE_KEYS.TARGET_TAB];
  const sessions = data[STORAGE_KEYS.SESSIONS] || {};
  let changed = false;

  if (targetTab?.tabId === tabId) {
    await removeStorage(STORAGE_KEYS.TARGET_TAB);
  }

  for (const [sourceTabId, session] of Object.entries(sessions)) {
    if (session.sourceTabId === tabId || session.targetTabId === tabId) {
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
      if (message.type === 'SET_TARGET_TAB') {
        const targetTab = await validateTab(message.tabId);
        if (!targetTab?.id) {
          sendResponse({ ok: false, reason: 'TAB_NOT_FOUND' });
          return;
        }

        await setStorage({
          [STORAGE_KEYS.TARGET_TAB]: {
            tabId: targetTab.id,
            windowId: targetTab.windowId,
            title: targetTab.title || '',
            url: targetTab.url || ''
          }
        });

        sendResponse({ ok: true });
        return;
      }

      if (message.type === 'GET_RUNTIME_STATE') {
        await cleanupInvalidState();
        const data = await getStorage([STORAGE_KEYS.TARGET_TAB, STORAGE_KEYS.SETTINGS, STORAGE_KEYS.SESSIONS]);
        sendResponse({
          ok: true,
          targetTab: data[STORAGE_KEYS.TARGET_TAB] || null,
          settings: { ...DEFAULT_SETTINGS, ...(data[STORAGE_KEYS.SETTINGS] || {}) },
          sessions: data[STORAGE_KEYS.SESSIONS] || {}
        });
        return;
      }

      if (message.type === 'LLM_PROMPT_STARTED') {
        const sourceTab = sender.tab;
        if (!sourceTab?.id || !sourceTab.url) {
          sendResponse({ ok: false, reason: 'NO_SOURCE_TAB' });
          return;
        }

        const data = await getStorage(STORAGE_KEYS.TARGET_TAB);
        const targetTabData = data[STORAGE_KEYS.TARGET_TAB];
        if (!targetTabData?.tabId) {
          sendResponse({ ok: false, reason: 'NO_TARGET_TAB' });
          return;
        }

        const targetTab = await validateTab(targetTabData.tabId);
        if (!targetTab?.id || !targetTab.url) {
          await removeStorage(STORAGE_KEYS.TARGET_TAB);
          sendResponse({ ok: false, reason: 'TARGET_TAB_CLOSED' });
          return;
        }

        if (targetTab.id === sourceTab.id) {
          sendResponse({ ok: false, reason: 'TARGET_EQUALS_SOURCE' });
          return;
        }

        const sessions = await getSessions();
        const existing = sessions[String(sourceTab.id)];
        if (existing) {
          sendResponse({ ok: true, duplicate: true });
          return;
        }

        sessions[String(sourceTab.id)] = {
          sourceTabId: sourceTab.id,
          sourceWindowId: sourceTab.windowId,
          sourceUrl: sourceTab.url,
          targetTabId: targetTab.id,
          targetWindowId: targetTab.windowId,
          targetUrl: targetTab.url,
          createdAt: Date.now()
        };
        await saveSessions(sessions);

        if (isMediaUrl(targetTab.url)) {
          await injectScriptIfNeeded(targetTab.id, 'player-content.js');
        }

        const focused = await focusTab(targetTab.id, targetTab.windowId);
        const settings = await getSettings();

        if (focused && settings.autoPlayEnabled && isMediaUrl(targetTab.url)) {
          await maybeSendToPlayer(targetTab.id, 'TRY_PLAY');
        }

        sendResponse({ ok: true });
        return;
      }

      if (message.type === 'LLM_RESPONSE_COMPLETED') {
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
        const targetTab = await validateTab(session.targetTabId);

        if (settings.autoPauseOnReturnEnabled && targetTab?.id && isMediaUrl(targetTab.url || session.targetUrl || '')) {
          await injectScriptIfNeeded(targetTab.id, 'player-content.js');
          await maybeSendToPlayer(targetTab.id, 'TRY_PAUSE');
        }

        const sourceValid = await validateTab(session.sourceTabId);
        if (sourceValid?.id) {
          await focusTab(sourceValid.id, session.sourceWindowId);
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

ensureContentScriptsForOpenTabs();