const STORAGE_KEYS = {
  TARGET_TAB: 'targetTab',
  SETTINGS: 'settings'
};

const DEFAULT_SETTINGS = {
  autoPlayEnabled: true,
  autoPauseOnReturnEnabled: true
};

const targetInfoEl = document.getElementById('targetInfo');
const runtimeInfoEl = document.getElementById('runtimeInfo');
const tabSelectEl = document.getElementById('tabSelect');
const refreshTabsBtn = document.getElementById('refreshTabsBtn');
const saveSelectedTabBtn = document.getElementById('saveSelectedTabBtn');
const setCurrentTabBtn = document.getElementById('setCurrentTabBtn');
const clearTargetTabBtn = document.getElementById('clearTargetTabBtn');
const autoPlayEnabledEl = document.getElementById('autoPlayEnabled');
const autoPauseOnReturnEnabledEl = document.getElementById('autoPauseOnReturnEnabled');

function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function isMediaPlatform(url = '') {
  return /youtube\.com|netflix\.com|disneyplus\.com|primevideo\.com|twitch\.tv|vimeo\.com/i.test(url);
}

function isLlmUrl(url = '') {
  return /(chatgpt\.com|chat\.openai\.com|claude\.ai|code\.claude\.com|gemini\.google\.com|aistudio\.google\.com|copilot\.microsoft\.com|grok\.com|perplexity\.ai|poe\.com|deepseek\.com|mistral\.ai|midjourney\.com|cursor\.com|qwen\.ai|kimi\.com)/i.test(url);
}

function getTabTypeLabel(url = '') {
  if (isMediaPlatform(url)) return '지원 미디어 탭';
  if (isLlmUrl(url)) return '지원 AI 탭';
  return '일반 탭';
}

async function getStorage(keys) {
  return chrome.storage.local.get(keys);
}

async function setStorage(data) {
  return chrome.storage.local.set(data);
}

async function saveSettings(patch) {
  const data = await getStorage(STORAGE_KEYS.SETTINGS);
  const previous = {
    ...DEFAULT_SETTINGS,
    ...(data[STORAGE_KEYS.SETTINGS] || {})
  };

  await setStorage({
    [STORAGE_KEYS.SETTINGS]: {
      ...previous,
      ...patch
    }
  });
}

function renderTargetInfo(targetTab) {
  if (!targetTab) {
    targetInfoEl.textContent = '없음';
    targetInfoEl.classList.add('empty');
    return;
  }

  targetInfoEl.classList.remove('empty');
  targetInfoEl.innerHTML = `
    <div class="target-title">${escapeHtml(targetTab.title || '제목 없음')}</div>
    <div class="target-url">${escapeHtml(targetTab.url || '')}</div>
    <div class="target-type">유형: ${escapeHtml(getTabTypeLabel(targetTab.url || ''))}</div>
  `;
}

function getSelectableTabs(tabs) {
  return tabs.filter((tab) => {
    const url = tab.url || '';
    if (!tab.id) return false;
    if (!url || url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('chrome-extension://')) {
      return false;
    }
    return true;
  });
}

async function renderTabSelect(currentTargetTabId = null) {
  const tabs = await chrome.tabs.query({});
  const selectableTabs = getSelectableTabs(tabs);

  tabSelectEl.innerHTML = '';
  if (!selectableTabs.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = '선택 가능한 탭이 없습니다';
    tabSelectEl.appendChild(option);
    return;
  }

  for (const tab of selectableTabs) {
    const option = document.createElement('option');
    option.value = String(tab.id);
    const prefix = isMediaPlatform(tab.url || '') ? '[미디어]' : isLlmUrl(tab.url || '') ? '[AI]' : '[탭]';
    option.textContent = `${prefix} ${tab.title || '제목 없음'}`;
    option.selected = tab.id === currentTargetTabId;
    tabSelectEl.appendChild(option);
  }
}

async function refreshUI() {
  const runtimeState = await chrome.runtime.sendMessage({ type: 'GET_RUNTIME_STATE' });
  const targetTab = runtimeState?.targetTab || null;
  const settings = { ...DEFAULT_SETTINGS, ...(runtimeState?.settings || {}) };
  const sessionCount = Object.keys(runtimeState?.sessions || {}).length;

  renderTargetInfo(targetTab);
  await renderTabSelect(targetTab?.tabId || null);

  autoPlayEnabledEl.checked = settings.autoPlayEnabled;
  autoPauseOnReturnEnabledEl.checked = settings.autoPauseOnReturnEnabled;
  runtimeInfoEl.textContent = sessionCount > 0 ? `활성 세션 ${sessionCount}개` : '활성 세션 없음';
}

refreshTabsBtn.addEventListener('click', async () => {
  await refreshUI();
});

saveSelectedTabBtn.addEventListener('click', async () => {
  const tabId = Number(tabSelectEl.value);
  if (!tabId) return;
  await chrome.runtime.sendMessage({ type: 'SET_TARGET_TAB', tabId });
  await refreshUI();
});

setCurrentTabBtn.addEventListener('click', async () => {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const currentTab = tabs[0];
  if (!currentTab?.id) return;

  await chrome.runtime.sendMessage({ type: 'SET_TARGET_TAB', tabId: currentTab.id });
  await refreshUI();
});

clearTargetTabBtn.addEventListener('click', async () => {
  await chrome.storage.local.remove(STORAGE_KEYS.TARGET_TAB);
  await refreshUI();
});

autoPlayEnabledEl.addEventListener('change', async () => {
  await saveSettings({ autoPlayEnabled: autoPlayEnabledEl.checked });
});

autoPauseOnReturnEnabledEl.addEventListener('change', async () => {
  await saveSettings({ autoPauseOnReturnEnabled: autoPauseOnReturnEnabledEl.checked });
});

refreshUI();