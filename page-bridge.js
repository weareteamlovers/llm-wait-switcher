(() => {
  if (window.__LLM_WAIT_SWITCHER_PAGE_BRIDGE__) return;
  window.__LLM_WAIT_SWITCHER_PAGE_BRIDGE__ = true;

  const PAGE_EXPECT_EVENT = 'LLM_WAIT_SWITCHER_EXPECT_REQUEST';
  const PAGE_NET_EVENT = 'LLM_WAIT_SWITCHER_NET_EVENT';

  const state = {
    expectUntil: 0,
    provider: 'generic',
    seq: 0
  };

  function dispatch(detail) {
    try {
      window.dispatchEvent(new CustomEvent(PAGE_NET_EVENT, { detail }));
    } catch (error) {}
  }

  function getProviderFromHost(host) {
    if (/chatgpt\.com$|chat\.openai\.com$/i.test(host)) return 'chatgpt';
    if (/gemini\.google\.com$|aistudio\.google\.com$/i.test(host)) return 'gemini';
    if (/claude\.ai$|code\.claude\.com$/i.test(host)) return 'claude';
    if (/copilot\.microsoft\.com$/i.test(host)) return 'copilot';
    if (/grok\.com$/i.test(host)) return 'grok';
    if (/perplexity\.ai$/i.test(host)) return 'perplexity';
    if (/poe\.com$/i.test(host)) return 'poe';
    if (/deepseek\.com$/i.test(host)) return 'deepseek';
    if (/mistral\.ai$/i.test(host)) return 'mistral';
    if (/midjourney\.com$/i.test(host)) return 'midjourney';
    if (/cursor\.com$/i.test(host)) return 'cursor';
    if (/qwen\.ai$/i.test(host)) return 'qwen';
    if (/kimi\.com$/i.test(host)) return 'kimi';
    return 'generic';
  }

  function toAbsoluteUrl(urlLike) {
    try {
      return new URL(urlLike, location.href);
    } catch (error) {
      return null;
    }
  }

  function getUrlString(input) {
    try {
      if (typeof input === 'string') return input;
      if (input instanceof Request) return input.url;
      if (input && typeof input.url === 'string') return input.url;
    } catch (error) {}
    return '';
  }

  function getMethod(input, init) {
    try {
      if (init && init.method) return String(init.method).toUpperCase();
      if (input instanceof Request && input.method) return String(input.method).toUpperCase();
      if (input && input.method) return String(input.method).toUpperCase();
    } catch (error) {}
    return 'GET';
  }

  function isExcludedUrl(urlString) {
    return /telemetry|analytics|segment|sentry|logging|metrics|track|traces|stats|beacon/i.test(
      urlString
    );
  }

  function isRelevantHost(urlObj, provider) {
    const host = urlObj.hostname;
    if (host === location.hostname) return true;

    if (provider === 'chatgpt') {
      return /(^|\.)openai\.com$|(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/i.test(host);
    }

    if (provider === 'gemini') {
      return /(^|\.)google\.com$|(^|\.)googleapis\.com$|(^|\.)googleusercontent\.com$/i.test(host);
    }

    if (provider === 'claude') {
      return /(^|\.)claude\.ai$|(^|\.)anthropic\.com$/i.test(host);
    }

    if (provider === 'copilot') {
      return /(^|\.)microsoft\.com$|(^|\.)bing\.com$/i.test(host);
    }

    if (provider === 'grok') {
      return /(^|\.)grok\.com$|(^|\.)x\.com$|(^|\.)twitter\.com$/i.test(host);
    }

    return false;
  }

  function isLikelyGenerationRequest(urlString, method, provider) {
    if (method === 'GET') return false;
    if (!urlString || isExcludedUrl(urlString)) return false;
    if (Date.now() > state.expectUntil) return false;

    const urlObj = toAbsoluteUrl(urlString);
    if (!urlObj) return false;
    if (!isRelevantHost(urlObj, provider)) return false;

    const s = urlString.toLowerCase();

    if (provider === 'chatgpt') {
      return /conversation|responses|backend-api|messages|completion|chat-requirements/.test(s);
    }

    if (provider === 'gemini') {
      return /generatecontent|streamgeneratecontent|batchexecute|bard|conversation|content|model/.test(
        s
      );
    }

    if (provider === 'claude') {
      return /chat_conversations|completion|append_message|retry_message|messages/.test(s);
    }

    return true;
  }

  async function consumeResponseBody(response, id, urlString, provider) {
    try {
      const clone = response.clone();

      if (!clone.body || !clone.body.getReader) {
        dispatch({
          phase: 'complete',
          id,
          url: urlString,
          provider,
          ok: response.ok
        });
        return;
      }

      const reader = clone.body.getReader();

      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      dispatch({
        phase: 'complete',
        id,
        url: urlString,
        provider,
        ok: response.ok
      });
    } catch (error) {
      dispatch({
        phase: 'complete',
        id,
        url: urlString,
        provider,
        ok: false
      });
    }
  }

  window.addEventListener(PAGE_EXPECT_EVENT, (event) => {
    const provider = event?.detail?.provider || getProviderFromHost(location.hostname);
    state.provider = provider;
    state.expectUntil = Date.now() + 15000;
  });

  const originalFetch = window.fetch.bind(window);

  window.fetch = async function patchedFetch(input, init) {
    const provider = state.provider || getProviderFromHost(location.hostname);
    const urlString = getUrlString(input);
    const method = getMethod(input, init);
    const shouldTrack = isLikelyGenerationRequest(urlString, method, provider);

    let id = null;

    if (shouldTrack) {
      id = `fetch-${++state.seq}`;
      dispatch({
        phase: 'start',
        id,
        url: urlString,
        provider
      });
    }

    try {
      const response = await originalFetch(input, init);

      if (id) {
        consumeResponseBody(response, id, urlString, provider);
      }

      return response;
    } catch (error) {
      if (id) {
        dispatch({
          phase: 'complete',
          id,
          url: urlString,
          provider,
          ok: false
        });
      }
      throw error;
    }
  };

  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function patchedOpen(method, url, ...rest) {
    this.__lwsMethod = String(method || 'GET').toUpperCase();
    this.__lwsUrl = typeof url === 'string' ? url : '';
    return originalXHROpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function patchedSend(body) {
    const provider = state.provider || getProviderFromHost(location.hostname);
    const urlString = this.__lwsUrl || '';
    const method = this.__lwsMethod || 'GET';
    const shouldTrack = isLikelyGenerationRequest(urlString, method, provider);

    let id = null;
    let finished = false;

    if (shouldTrack) {
      id = `xhr-${++state.seq}`;
      dispatch({
        phase: 'start',
        id,
        url: urlString,
        provider
      });

      const finish = (ok) => {
        if (finished) return;
        finished = true;

        dispatch({
          phase: 'complete',
          id,
          url: urlString,
          provider,
          ok
        });
      };

      this.addEventListener('loadend', () => finish(true), { once: true });
      this.addEventListener('error', () => finish(false), { once: true });
      this.addEventListener('abort', () => finish(false), { once: true });
    }

    return originalXHRSend.call(this, body);
  };
})();