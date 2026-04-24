const STORAGE_KEYS = {
  TARGET_TAB: 'targetTab',
  SETTINGS: 'settings'
};

const DEFAULT_SETTINGS = {
  autoPlayEnabled: true,
  autoPauseOnReturnEnabled: true,
  debugEnabled: false
};

const targetInfoEl = document.getElementById('targetInfo');
const runtimeInfoEl = document.getElementById('runtimeInfo');
const setCurrentTabBtn = document.getElementById('setCurrentTabBtn');
const clearTargetTabBtn = document.getElementById('clearTargetTabBtn');
const autoPlayEnabledEl = document.getElementById('autoPlayEnabled');
const autoPauseOnReturnEnabledEl = document.getElementById('autoPauseOnReturnEnabled');

function escapeHtml(text) {
  return String(text)
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
    return;
  }

  targetInfoEl.innerHTML = `
    <div class="target-title">${escapeHtml(targetTab.title || '제목 없음')}</div>
    <div class="target-url">${escapeHtml(targetTab.url || '')}</div>
    <div class="target-type">유형: ${escapeHtml(getTabTypeLabel(targetTab.url || ''))}</div>
  `;
}

async function refreshUI() {
  const runtimeState = await chrome.runtime.sendMessage({ type: 'GET_RUNTIME_STATE' });
  const targetTab = runtimeState?.targetTab || null;
  const settings = {
    ...DEFAULT_SETTINGS,
    ...(runtimeState?.settings || {})
  };
  const sessionCount = Object.keys(runtimeState?.sessions || {}).length;

  renderTargetInfo(targetTab);
  autoPlayEnabledEl.checked = settings.autoPlayEnabled;
  autoPauseOnReturnEnabledEl.checked = settings.autoPauseOnReturnEnabled;
  runtimeInfoEl.textContent = sessionCount > 0 ? `활성 세션 ${sessionCount}개` : '활성 세션 없음';
}

setCurrentTabBtn.addEventListener('click', async () => {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
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
  await saveSettings({ autoPlayEnabled: autoPlayEnabledEl.checked });
});

autoPauseOnReturnEnabledEl.addEventListener('change', async () => {
  await saveSettings({ autoPauseOnReturnEnabled: autoPauseOnReturnEnabledEl.checked });
});

refreshUI();
