(() => {
  if (window.__LLM_WAIT_SWITCHER_PLAYER_LOADED__) return;
  window.__LLM_WAIT_SWITCHER_PLAYER_LOADED__ = true;

  function getMediaCandidates() {
    const nodes = Array.from(document.querySelectorAll('video, audio'));
    return nodes.filter((node) => {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    }).sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return (rb.width * rb.height) - (ra.width * ra.height);
    });
  }

  async function tryPlay() {
    const media = getMediaCandidates()[0];
    if (!media) return { ok: false, reason: 'NO_MEDIA' };

    try {
      media.muted = false;
      await media.play();
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: 'PLAY_FAILED' };
    }
  }

  function tryPause() {
    const media = getMediaCandidates()[0];
    if (!media) return { ok: false, reason: 'NO_MEDIA' };

    try {
      media.pause();
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: 'PAUSE_FAILED' };
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
      if (message.type === 'TRY_PLAY') {
        sendResponse(await tryPlay());
        return;
      }
      if (message.type === 'TRY_PAUSE') {
        sendResponse(tryPause());
        return;
      }
      sendResponse({ ok: false, reason: 'UNKNOWN_MESSAGE' });
    })();
    return true;
  });
})();