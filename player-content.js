(() => {
  if (globalThis.__LLM_WAIT_SWITCHER_PLAYER_LOADED__) return;
  globalThis.__LLM_WAIT_SWITCHER_PLAYER_LOADED__ = true;

  function getMediaElements() {
    return Array.from(document.querySelectorAll('video, audio')).filter((el) => {
      try {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      } catch {
        return false;
      }
    });
  }

  function getPrimaryMedia() {
    const media = getMediaElements();
    if (media.length === 0) return null;
    media.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return rb.width * rb.height - ra.width * ra.height;
    });
    return media[0] || null;
  }

  async function tryPlay() {
    const media = getPrimaryMedia();
    if (!media) return { ok: false, reason: 'NO_MEDIA' };
    try {
      media.muted = false;
      await media.play();
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : String(error) };
    }
  }

  async function tryPause() {
    const media = getPrimaryMedia();
    if (!media) return { ok: false, reason: 'NO_MEDIA' };
    try {
      media.pause();
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : String(error) };
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    (async () => {
      if (message?.type === 'TRY_PLAY') {
        sendResponse(await tryPlay());
        return;
      }
      if (message?.type === 'TRY_PAUSE') {
        sendResponse(await tryPause());
        return;
      }
      sendResponse({ ok: false, reason: 'UNKNOWN_MESSAGE' });
    })();
    return true;
  });
})();
