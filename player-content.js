if (!globalThis.__LLM_WAIT_SWITCHER_PLAYER_LOADED__) {
  globalThis.__LLM_WAIT_SWITCHER_PLAYER_LOADED__ = true;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function tryVideoPlay(video) {
    if (!video) return false;

    try {
      await video.play();
      await sleep(500);
      return !video.paused;
    } catch (error) {
      return false;
    }
  }

  async function tryVideoPause(video) {
    if (!video) return false;

    try {
      video.pause();
      await sleep(300);
      return video.paused;
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
    document.dispatchEvent(event);
  }

  async function playYouTube() {
    const video = document.querySelector('video');

    if (await tryVideoPlay(video)) {
      return { ok: true, platform: 'youtube', method: 'video.play()' };
    }

    const playButton = document.querySelector('.ytp-play-button');
    if (playButton) {
      playButton.click();
      await sleep(500);

      const videoAfterClick = document.querySelector('video');
      if (videoAfterClick && !videoAfterClick.paused) {
        return { ok: true, platform: 'youtube', method: 'button.click()' };
      }
    }

    dispatchKey('k', 'KeyK');
    await sleep(500);

    const videoAfterKey = document.querySelector('video');
    if (videoAfterKey && !videoAfterKey.paused) {
      return { ok: true, platform: 'youtube', method: 'keyboard:k' };
    }

    return { ok: false, platform: 'youtube' };
  }

  async function pauseYouTube() {
    const video = document.querySelector('video');

    if (video && !video.paused && (await tryVideoPause(video))) {
      return { ok: true, platform: 'youtube', method: 'video.pause()' };
    }

    const playButton = document.querySelector('.ytp-play-button');
    if (playButton) {
      playButton.click();
      await sleep(400);

      const videoAfterClick = document.querySelector('video');
      if (videoAfterClick && videoAfterClick.paused) {
        return { ok: true, platform: 'youtube', method: 'button.click()' };
      }
    }

    dispatchKey('k', 'KeyK');
    await sleep(400);

    const videoAfterKey = document.querySelector('video');
    if (videoAfterKey && videoAfterKey.paused) {
      return { ok: true, platform: 'youtube', method: 'keyboard:k' };
    }

    return { ok: false, platform: 'youtube' };
  }

  async function playNetflix() {
    const video = document.querySelector('video');

    if (await tryVideoPlay(video)) {
      return { ok: true, platform: 'netflix', method: 'video.play()' };
    }

    const playButton =
      document.querySelector('button[data-uia="player-play-pause"]') ||
      document.querySelector('button[aria-label*="Play"]') ||
      document.querySelector('button[aria-label*="재생"]');

    if (playButton) {
      playButton.click();
      await sleep(500);

      const videoAfterClick = document.querySelector('video');
      if (videoAfterClick && !videoAfterClick.paused) {
        return { ok: true, platform: 'netflix', method: 'button.click()' };
      }
    }

    dispatchKey(' ', 'Space');
    await sleep(500);

    const videoAfterSpace = document.querySelector('video');
    if (videoAfterSpace && !videoAfterSpace.paused) {
      return { ok: true, platform: 'netflix', method: 'keyboard:space' };
    }

    dispatchKey('Enter', 'Enter');
    await sleep(500);

    const videoAfterEnter = document.querySelector('video');
    if (videoAfterEnter && !videoAfterEnter.paused) {
      return { ok: true, platform: 'netflix', method: 'keyboard:enter' };
    }

    return { ok: false, platform: 'netflix' };
  }

  async function pauseNetflix() {
    const video = document.querySelector('video');

    if (video && !video.paused && (await tryVideoPause(video))) {
      return { ok: true, platform: 'netflix', method: 'video.pause()' };
    }

    const pauseButton =
      document.querySelector('button[data-uia="player-play-pause"]') ||
      document.querySelector('button[aria-label*="Pause"]') ||
      document.querySelector('button[aria-label*="일시중지"]');

    if (pauseButton) {
      pauseButton.click();
      await sleep(400);

      const videoAfterClick = document.querySelector('video');
      if (videoAfterClick && videoAfterClick.paused) {
        return { ok: true, platform: 'netflix', method: 'button.click()' };
      }
    }

    dispatchKey(' ', 'Space');
    await sleep(400);

    const videoAfterSpace = document.querySelector('video');
    if (videoAfterSpace && videoAfterSpace.paused) {
      return { ok: true, platform: 'netflix', method: 'keyboard:space' };
    }

    dispatchKey('Enter', 'Enter');
    await sleep(400);

    const videoAfterEnter = document.querySelector('video');
    if (videoAfterEnter && videoAfterEnter.paused) {
      return { ok: true, platform: 'netflix', method: 'keyboard:enter' };
    }

    return { ok: false, platform: 'netflix' };
  }

  async function tryPlayForCurrentSite() {
    const host = location.hostname;

    if (host.includes('youtube.com')) {
      return playYouTube();
    }

    if (host.includes('netflix.com')) {
      return playNetflix();
    }

    return { ok: false, reason: 'UNSUPPORTED_SITE' };
  }

  async function tryPauseForCurrentSite() {
    const host = location.hostname;

    if (host.includes('youtube.com')) {
      return pauseYouTube();
    }

    if (host.includes('netflix.com')) {
      return pauseNetflix();
    }

    return { ok: false, reason: 'UNSUPPORTED_SITE' };
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
  });
}