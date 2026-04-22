const STORAGE_KEYS = {
  TARGET_TAB: 'targetTab',
  SETTINGS: 'settings'
};

const DEFAULT_SETTINGS = {
  autoPlayEnabled: true,
  autoPauseOnReturnEnabled: true
};

const targetInfoEl = document.getElementById('targetInfo');
const setCurrentTabBtn = document.getElementById('setCurrentTabBtn');
const clearTargetTabBtn = document.getElementById('clearTargetTabBtn');
const autoPlayEnabledEl = document.getElementById('autoPlayEnabled');
const autoPauseOnReturnEnabledEl = document.getElementById('autoPauseOnReturnEnabled');

async function getStorage(keys) {
  return chrome.storage.local.get(keys);
}

async function setStorage(data) {
  return chrome.storage.local.set(data);
}

function isMediaPlatform(url = '') {
  return /youtube\.com|netflix\.com/i.test(url);
}

function renderTargetInfo(targetTab) {
  if (!targetTab) {
    targetInfoEl.textContent = '없음';
    return;
  }

  const mediaText = isMediaPlatform(targetTab.url) ? '영상 플랫폼' : '일반 탭';
  targetInfoEl.innerHTML = `
    <strong>${escapeHtml(targetTab.title || '제목 없음')}</strong><br />
    ${escapeHtml(targetTab.url || '')}<br />
    유형: ${mediaText}
  `;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function saveSettings(patch) {
  const data = await getStorage(STORAGE_KEYS.SETTINGS);
  const prev = {
    ...DEFAULT_SETTINGS,
    ...(data[STORAGE_KEYS.SETTINGS] || {})
  };

  await setStorage({
    [STORAGE_KEYS.SETTINGS]: {
      ...prev,
      ...patch
    }
  });
}

async function refreshUI() {
  const data = await getStorage([STORAGE_KEYS.TARGET_TAB, STORAGE_KEYS.SETTINGS]);
  const targetTab = data[STORAGE_KEYS.TARGET_TAB] || null;
  const settings = {
    ...DEFAULT_SETTINGS,
    ...(data[STORAGE_KEYS.SETTINGS] || {})
  };

  renderTargetInfo(targetTab);
  autoPlayEnabledEl.checked = settings.autoPlayEnabled;
  autoPauseOnReturnEnabledEl.checked = settings.autoPauseOnReturnEnabled;
}

setCurrentTabBtn.addEventListener('click', async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];

  if (!currentTab?.id) return;

  await setStorage({
    [STORAGE_KEYS.TARGET_TAB]: {
      tabId: currentTab.id,
      windowId: currentTab.windowId,
      title: currentTab.title || '',
      url: currentTab.url || ''
    }
  });

  await refreshUI();
});

clearTargetTabBtn.addEventListener('click', async () => {
  await chrome.storage.local.remove(STORAGE_KEYS.TARGET_TAB);
  await refreshUI();
});

autoPlayEnabledEl.addEventListener('change', async () => {
  await saveSettings({
    autoPlayEnabled: autoPlayEnabledEl.checked
  });
});

autoPauseOnReturnEnabledEl.addEventListener('change', async () => {
  await saveSettings({
    autoPauseOnReturnEnabled: autoPauseOnReturnEnabledEl.checked
  });
});

refreshUI();