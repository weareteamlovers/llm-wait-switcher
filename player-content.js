if (!globalThis.__LLM_WAIT_SWITCHER_PLAYER_LOADED__) {
  globalThis.__LLM_WAIT_SWITCHER_PLAYER_LOADED__ = true;

  const PLAY_KEYWORDS = [
    'play',
    'resume',
    'watch',
    '재생',
    '계속',
    '다시 재생'
  ];

  const PAUSE_KEYWORDS = [
    'pause',
    '일시중지',
    '멈춤',
    '중지'
  ];

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

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
        element.getAttribute('data-uia')
      ]
        .filter(Boolean)
        .join(' ')
    );
  }

  function getMediaElements() {
    return Array.from(document.querySelectorAll('video, audio'))
      .filter((media) => {
        if (!(media instanceof HTMLMediaElement)) return false;
        const rect = media.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .sort((a, b) => {
        const rectA = a.getBoundingClientRect();
        const rectB = b.getBoundingClientRect();
        return rectB.width * rectB.height - rectA.width * rectA.height;
      });
  }

  function getPrimaryMedia() {
    return getMediaElements()[0] || null;
  }

  async function tryMediaPlay(media) {
    if (!(media instanceof HTMLMediaElement)) return false;

    try {
      await media.play();
      await sleep(400);
      return !media.paused;
    } catch (error) {
      return false;
    }
  }

  async function tryMediaPause(media) {
    if (!(media instanceof HTMLMediaElement)) return false;

    try {
      media.pause();
      await sleep(300);
      return media.paused;
    } catch (error) {
      return false;
    }
  }

  function dispatchKey(key, code) {
    const event = new KeyboardEvent('keydown', {
      key,
      code,
      bubbles: true,
      cancelable: true
    });

    const activeElement = document.activeElement;
    if (activeElement instanceof Element) {
      activeElement.dispatchEvent(event);
    }

    document.dispatchEvent(event);
  }

  function clickButtonByKeywords(keywords) {
    const controls = Array.from(
      document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]')
    ).filter(isVisible);

    for (const control of controls) {
      const text = elementText(control);
      if (keywords.some((keyword) => text.includes(keyword))) {
        control.click();
        return true;
      }
    }

    return false;
  }

  async function genericPlay(platform = 'generic') {
    const media = getPrimaryMedia();

    if (await tryMediaPlay(media)) {
      return { ok: true, platform, method: 'media.play()' };
    }

    if (clickButtonByKeywords(PLAY_KEYWORDS)) {
      await sleep(500);
      const afterClick = getPrimaryMedia();
      if (afterClick instanceof HTMLMediaElement && !afterClick.paused) {
        return { ok: true, platform, method: 'button.click()' };
      }
    }

    dispatchKey(' ', 'Space');
    await sleep(400);

    const afterSpace = getPrimaryMedia();
    if (afterSpace instanceof HTMLMediaElement && !afterSpace.paused) {
      return { ok: true, platform, method: 'keyboard:space' };
    }

    return { ok: false, platform };
  }

  async function genericPause(platform = 'generic') {
    const media = getPrimaryMedia();

    if (media instanceof HTMLMediaElement && !media.paused && (await tryMediaPause(media))) {
      return { ok: true, platform, method: 'media.pause()' };
    }

    if (clickButtonByKeywords(PAUSE_KEYWORDS)) {
      await sleep(400);
      const afterClick = getPrimaryMedia();
      if (afterClick instanceof HTMLMediaElement && afterClick.paused) {
        return { ok: true, platform, method: 'button.click()' };
      }
    }

    dispatchKey(' ', 'Space');
    await sleep(400);

    const afterSpace = getPrimaryMedia();
    if (afterSpace instanceof HTMLMediaElement && afterSpace.paused) {
      return { ok: true, platform, method: 'keyboard:space' };
    }

    return { ok: false, platform };
  }

  async function playYouTube() {
    const media = getPrimaryMedia();

    if (await tryMediaPlay(media)) {
      return { ok: true, platform: 'youtube', method: 'media.play()' };
    }

    const button = document.querySelector('.ytp-play-button');
    if (button instanceof HTMLElement) {
      button.click();
      await sleep(500);

      const afterClick = getPrimaryMedia();
      if (afterClick instanceof HTMLMediaElement && !afterClick.paused) {
        return { ok: true, platform: 'youtube', method: 'button.click()' };
      }
    }

    dispatchKey('k', 'KeyK');
    await sleep(400);

    const afterKey = getPrimaryMedia();
    if (afterKey instanceof HTMLMediaElement && !afterKey.paused) {
      return { ok: true, platform: 'youtube', method: 'keyboard:k' };
    }

    return { ok: false, platform: 'youtube' };
  }

  async function pauseYouTube() {
    const media = getPrimaryMedia();

    if (media instanceof HTMLMediaElement && !media.paused && (await tryMediaPause(media))) {
      return { ok: true, platform: 'youtube', method: 'media.pause()' };
    }

    const button = document.querySelector('.ytp-play-button');
    if (button instanceof HTMLElement) {
      button.click();
      await sleep(400);

      const afterClick = getPrimaryMedia();
      if (afterClick instanceof HTMLMediaElement && afterClick.paused) {
        return { ok: true, platform: 'youtube', method: 'button.click()' };
      }
    }

    dispatchKey('k', 'KeyK');
    await sleep(400);

    const afterKey = getPrimaryMedia();
    if (afterKey instanceof HTMLMediaElement && afterKey.paused) {
      return { ok: true, platform: 'youtube', method: 'keyboard:k' };
    }

    return { ok: false, platform: 'youtube' };
  }

  async function playNetflix() {
    const media = getPrimaryMedia();

    if (await tryMediaPlay(media)) {
      return { ok: true, platform: 'netflix', method: 'media.play()' };
    }

    const button =
      document.querySelector('button[data-uia="player-play-pause"]') ||
      document.querySelector('button[aria-label*="Play"]') ||
      document.querySelector('button[aria-label*="재생"]');

    if (button instanceof HTMLElement) {
      button.click();
      await sleep(500);

      const afterClick = getPrimaryMedia();
      if (afterClick instanceof HTMLMediaElement && !afterClick.paused) {
        return { ok: true, platform: 'netflix', method: 'button.click()' };
      }
    }

    dispatchKey(' ', 'Space');
    await sleep(400);

    const afterSpace = getPrimaryMedia();
    if (afterSpace instanceof HTMLMediaElement && !afterSpace.paused) {
      return { ok: true, platform: 'netflix', method: 'keyboard:space' };
    }

    return { ok: false, platform: 'netflix' };
  }

  async function pauseNetflix() {
    const media = getPrimaryMedia();

    if (media instanceof HTMLMediaElement && !media.paused && (await tryMediaPause(media))) {
      return { ok: true, platform: 'netflix', method: 'media.pause()' };
    }

    const button =
      document.querySelector('button[data-uia="player-play-pause"]') ||
      document.querySelector('button[aria-label*="Pause"]') ||
      document.querySelector('button[aria-label*="일시중지"]');

    if (button instanceof HTMLElement) {
      button.click();
      await sleep(400);

      const afterClick = getPrimaryMedia();
      if (afterClick instanceof HTMLMediaElement && afterClick.paused) {
        return { ok: true, platform: 'netflix', method: 'button.click()' };
      }
    }

    dispatchKey(' ', 'Space');
    await sleep(400);

    const afterSpace = getPrimaryMedia();
    if (afterSpace instanceof HTMLMediaElement && afterSpace.paused) {
      return { ok: true, platform: 'netflix', method: 'keyboard:space' };
    }

    return { ok: false, platform: 'netflix' };
  }

  function getPlatform() {
    const host = location.hostname;

    if (host.includes('youtube.com')) return 'youtube';
    if (host.includes('netflix.com')) return 'netflix';
    if (host.includes('disneyplus.com')) return 'disneyplus';
    if (host.includes('primevideo.com')) return 'primevideo';
    if (host.includes('twitch.tv')) return 'twitch';
    if (host.includes('vimeo.com')) return 'vimeo';

    return 'generic';
  }

  async function tryPlayForCurrentSite() {
    const platform = getPlatform();

    if (platform === 'youtube') return playYouTube();
    if (platform === 'netflix') return playNetflix();

    return genericPlay(platform);
  }

  async function tryPauseForCurrentSite() {
    const platform = getPlatform();

    if (platform === 'youtube') return pauseYouTube();
    if (platform === 'netflix') return pauseNetflix();

    return genericPause(platform);
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TRY_PLAY') {
      (async () => {
        const result = await tryPlayForCurrentSite();
        sendResponse(result);
      })();
      return true;
    }

    if (message.type === 'TRY_PAUSE') {
      (async () => {
        const result = await tryPauseForCurrentSite();
        sendResponse(result);
      })();
      return true;
    }

    return false;
  });
}