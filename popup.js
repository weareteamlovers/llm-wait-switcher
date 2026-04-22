const STORAGE_KEYS = {
  TARGET_TAB: 'targetTab',
  SETTINGS: 'settings'
};

const targetInfoEl = document.getElementById('targetInfo');
const setCurrentTabBtn = document.getElementById('setCurrentTabBtn');
const clearTargetTabBtn = document.getElementById('clearTargetTabBtn');
const autoPlayEnabledEl = document.getElementById('autoPlayEnabled');

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

async function refreshUI() {
  const data = await getStorage([STORAGE_KEYS.TARGET_TAB, STORAGE_KEYS.SETTINGS]);
  const targetTab = data[STORAGE_KEYS.TARGET_TAB] || null;
  const settings = data[STORAGE_KEYS.SETTINGS] || { autoPlayEnabled: true };

  renderTargetInfo(targetTab);
  autoPlayEnabledEl.checked = settings.autoPlayEnabled !== false;
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
  const data = await getStorage(STORAGE_KEYS.SETTINGS);
  const prev = data[STORAGE_KEYS.SETTINGS] || {};

  await setStorage({
    [STORAGE_KEYS.SETTINGS]: {
      ...prev,
      autoPlayEnabled: autoPlayEnabledEl.checked
    }
  });
});

refreshUI();