// background.js

const STORAGE_KEYS = {
  TARGET_TAB: 'targetTab',
  SETTINGS: 'settings',
  SESSIONS: 'sessions'
};

async function getStorage(keys) {
  return chrome.storage.local.get(keys);
}

async function setStorage(data) {
  return chrome.storage.local.set(data);
}

async function removeStorage(keys) {
  return chrome.storage.local.remove(keys);
}

function isMediaPlatform(url = '') {
  return /youtube\.com|netflix\.com/i.test(url);
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

async function validateTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    return tab;
  } catch (error) {
    return null;
  }
}

async function getSessions() {
  const data = await getStorage(STORAGE_KEYS.SESSIONS);
  return data[STORAGE_KEYS.SESSIONS] || {};
}

async function saveSessions(sessions) {
  await setStorage({ [STORAGE_KEYS.SESSIONS]: sessions });
}

chrome.runtime.onInstalled.addListener(async () => {
  const data = await getStorage([STORAGE_KEYS.SETTINGS, STORAGE_KEYS.SESSIONS]);
  if (!data[STORAGE_KEYS.SETTINGS]) {
    await setStorage({
      [STORAGE_KEYS.SETTINGS]: {
        autoPlayEnabled: true
      }
    });
  }
  if (!data[STORAGE_KEYS.SESSIONS]) {
    await setStorage({
      [STORAGE_KEYS.SESSIONS]: {}
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === 'LLM_PROMPT_STARTED') {
        const sourceTab = sender.tab;
        if (!sourceTab?.id) {
          sendResponse({ ok: false, reason: 'NO_SOURCE_TAB' });
          return;
        }

        const data = await getStorage([STORAGE_KEYS.TARGET_TAB, STORAGE_KEYS.SETTINGS]);
        const targetTabData = data[STORAGE_KEYS.TARGET_TAB];
        const settings = data[STORAGE_KEYS.SETTINGS] || { autoPlayEnabled: true };

        if (!targetTabData?.tabId) {
          sendResponse({ ok: false, reason: 'NO_TARGET_TAB' });
          return;
        }

        const targetTab = await validateTab(targetTabData.tabId);
        if (!targetTab?.id) {
          await removeStorage(STORAGE_KEYS.TARGET_TAB);
          sendResponse({ ok: false, reason: 'TARGET_TAB_CLOSED' });
          return;
        }

        const sessions = await getSessions();
        sessions[String(sourceTab.id)] = {
          sourceTabId: sourceTab.id,
          sourceWindowId: sourceTab.windowId,
          targetTabId: targetTab.id,
          targetWindowId: targetTab.windowId,
          startedAt: Date.now(),
          targetUrl: targetTab.url || ''
        };
        await saveSessions(sessions);

        const focused = await focusTab(targetTab.id, targetTab.windowId);

        if (focused && settings.autoPlayEnabled && isMediaPlatform(targetTab.url || '')) {
          chrome.tabs.sendMessage(
            targetTab.id,
            { type: 'TRY_PLAY' },
            () => chrome.runtime.lastError
          );
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

        const validTargetTab = await validateTab(session.targetTabId);
        if (validTargetTab?.id && isMediaPlatform(session.targetUrl || validTargetTab.url || '')) {
          await new Promise((resolve) => {
            chrome.tabs.sendMessage(
              session.targetTabId,
              { type: 'TRY_PAUSE' },
              () => {
                chrome.runtime.lastError;
                resolve();
              }
            );
          });
        }

        const validSourceTab = await validateTab(session.sourceTabId);
        if (validSourceTab?.id) {
          await focusTab(session.sourceTabId, session.sourceWindowId);
        }

        delete sessions[String(sourceTab.id)];
        await saveSessions(sessions);

        sendResponse({ ok: true });
        return;
      }

      if (message.type === 'GET_RUNTIME_STATE') {
        const data = await getStorage([
          STORAGE_KEYS.TARGET_TAB,
          STORAGE_KEYS.SETTINGS,
          STORAGE_KEYS.SESSIONS
        ]);
        sendResponse({
          ok: true,
          targetTab: data[STORAGE_KEYS.TARGET_TAB] || null,
          settings: data[STORAGE_KEYS.SETTINGS] || { autoPlayEnabled: true },
          sessions: data[STORAGE_KEYS.SESSIONS] || {}
        });
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

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const data = await getStorage([STORAGE_KEYS.TARGET_TAB, STORAGE_KEYS.SESSIONS]);
  const targetTab = data[STORAGE_KEYS.TARGET_TAB];
  const sessions = data[STORAGE_KEYS.SESSIONS] || {};

  let shouldSaveSessions = false;

  if (targetTab?.tabId === tabId) {
    await removeStorage(STORAGE_KEYS.TARGET_TAB);
  }

  for (const [sourceTabId, session] of Object.entries(sessions)) {
    if (session.sourceTabId === tabId || session.targetTabId === tabId) {
      delete sessions[sourceTabId];
      shouldSaveSessions = true;
    }
  }

  if (shouldSaveSessions) {
    await saveSessions(sessions);
  }
});