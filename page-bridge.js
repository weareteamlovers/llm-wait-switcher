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

  const PROVIDER_RULES = {
    chatgpt: {
      hosts: [/(^|\.)openai\.com$/i, /(^|\.)chatgpt\.com$/i, /(^|\.)chat\.openai\.com$/i],
      paths: [/conversation/i, /responses/i, /backend-api/i, /messages/i, /completion/i, /chat-requirements/i]
    },
    claude: {
      hosts: [/(^|\.)claude\.ai$/i, /(^|\.)anthropic\.com$/i],
      paths: [/chat_conversations/i, /completion/i, /append_message/i, /retry_message/i, /messages/i]
    },
    gemini: {
      hosts: [/(^|\.)google\.com$/i, /(^|\.)googleapis\.com$/i, /(^|\.)googleusercontent\.com$/i],
      paths: [/generatecontent/i, /streamgeneratecontent/i, /batchexecute/i, /bard/i, /conversation/i, /content/i, /model/i]
    },
    copilot: {
      hosts: [/(^|\.)microsoft\.com$/i, /(^|\.)bing\.com$/i],
      paths: [/copilot/i, /conversation/i, /messages/i, /chat/i, /create/i]
    },
    grok: {
      hosts: [/(^|\.)grok\.com$/i, /(^|\.)x\.com$/i, /(^|\.)twitter\.com$/i],
      paths: [/chat/i, /conversation/i, /messages/i, /completion/i]
    },
    perplexity: {
      hosts: [/(^|\.)perplexity\.ai$/i],
      paths: [/search/i, /thread/i, /chat/i, /completion/i, /answer/i]
    },
    poe: {
      hosts: [/(^|\.)poe\.com$/i],
      paths: [/bot/i, /chat/i, /message/i, /completion/i]
    },
    deepseek: {
      hosts: [/(^|\.)deepseek\.com$/i],
      paths: [/chat/i, /completion/i, /message/i, /conversation/i]
    },
    mistral: {
      hosts: [/(^|\.)mistral\.ai$/i],
      paths: [/chat/i, /completion/i, /conversation/i, /message/i]
    },
    midjourney: {
      hosts: [/(^|\.)midjourney\.com$/i],
      paths: [/imagine/i, /job/i, /task/i, /generate/i, /message/i]
    },
    cursor: {
      hosts: [/(^|\.)cursor\.com$/i],
      paths: [/chat/i, /completion/i, /message/i, /conversation/i, /stream/i]
    },
    qwen: {
      hosts: [/(^|\.)qwen\.ai$/i],
      paths: [/chat/i, /completion/i, /conversation/i, /message/i]
    },
    kimi: {
      hosts: [/(^|\.)kimi\.com$/i],
      paths: [/chat/i, /completion/i, /conversation/i, /message/i]
    },
    generic: {
      hosts: [],
      paths: [/chat/i, /completion/i, /conversation/i, /message/i, /generate/i, /response/i, /stream/i]
    }
  };

  function dispatch(detail) {
    try {
      window.dispatchEvent(new CustomEvent(PAGE_NET_EVENT, { detail }));
    } catch {
      // ignore
    }
  }

  function getProviderFromHost(hostname) {
    if (/chatgpt\.com$|chat\.openai\.com$/i.test(hostname)) return 'chatgpt';
    if (/claude\.ai$|code\.claude\.com$/i.test(hostname)) return 'claude';
    if (/gemini\.google\.com$|aistudio\.google\.com$/i.test(hostname)) return 'gemini';
    if (/copilot\.microsoft\.com$/i.test(hostname)) return 'copilot';
    if (/grok\.com$/i.test(hostname)) return 'grok';
    if (/perplexity\.ai$/i.test(hostname)) return 'perplexity';
    if (/poe\.com$/i.test(hostname)) return 'poe';
    if (/deepseek\.com$/i.test(hostname)) return 'deepseek';
    if (/mistral\.ai$/i.test(hostname)) return 'mistral';
    if (/midjourney\.com$/i.test(hostname)) return 'midjourney';
    if (/cursor\.com$/i.test(hostname)) return 'cursor';
    if (/qwen\.ai$/i.test(hostname)) return 'qwen';
    if (/kimi\.com$/i.test(hostname)) return 'kimi';
    return 'generic';
  }

  function toAbsoluteUrl(urlLike) {
    try {
      return new URL(urlLike, location.href);
    } catch {
      return null;
    }
  }

  function getUrlString(input) {
    try {
      if (typeof input === 'string') return input;
      if (input instanceof Request) return input.url;
      if (input && typeof input.url === 'string') return input.url;
    } catch {
      // ignore
    }
    return '';
  }

  function getMethod(input, init) {
    try {
      if (init?.method) return String(init.method).toUpperCase();
      if (input instanceof Request && input.method) return String(input.method).toUpperCase();
      if (input?.method) return String(input.method).toUpperCase();
    } catch {
      // ignore
    }
    return 'GET';
  }

  function isExcludedUrl(urlString) {
    return /telemetry|analytics|segment|sentry|logging|metrics|track|traces|stats|beacon|csrf|csrf-token/i.test(urlString);
  }

  function matchHost(urlObj, provider) {
    if (!urlObj) return false;
    if (urlObj.hostname === location.hostname) return true;
    const rules = PROVIDER_RULES[provider] || PROVIDER_RULES.generic;
    return rules.hosts.some((pattern) => pattern.test(urlObj.hostname));
  }

  function matchPath(urlString, provider) {
    const rules = PROVIDER_RULES[provider] || PROVIDER_RULES.generic;
    return rules.paths.some((pattern) => pattern.test(urlString));
  }

  function shouldTrack(urlString, method, provider) {
    if (!urlString || isExcludedUrl(urlString)) return false;
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return false;

    const urlObj = toAbsoluteUrl(urlString);
    if (!urlObj) return false;
    if (!matchHost(urlObj, provider)) return false;

    const inExpectedWindow = Date.now() <= state.expectUntil;
    const lowerUrl = urlString.toLowerCase();
    const pathLooksLikeAi = matchPath(lowerUrl, provider);

    return pathLooksLikeAi && (inExpectedWindow || urlObj.hostname === location.hostname);
  }

  async function consumeResponseBody(response, id, urlString, provider) {
    try {
      const clone = response.clone();
      if (!clone.body || !clone.body.getReader) {
        dispatch({ phase: 'complete', id, url: urlString, provider, ok: response.ok });
        return;
      }

      const reader = clone.body.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      dispatch({ phase: 'complete', id, url: urlString, provider, ok: response.ok });
    } catch {
      dispatch({ phase: 'complete', id, url: urlString, provider, ok: false });
    }
  }

  window.addEventListener(PAGE_EXPECT_EVENT, (event) => {
    const provider = event?.detail?.provider || getProviderFromHost(location.hostname);
    state.provider = provider;
    state.expectUntil = Date.now() + 20000;
  });

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function patchedFetch(input, init) {
    const provider = state.provider || getProviderFromHost(location.hostname);
    const urlString = getUrlString(input);
    const method = getMethod(input, init);
    const track = shouldTrack(urlString, method, provider);
    let id = null;

    if (track) {
      id = `fetch-${++state.seq}`;
      dispatch({ phase: 'start', id, url: urlString, provider });
    }

    try {
      const response = await originalFetch(input, init);
      if (id) void consumeResponseBody(response, id, urlString, provider);
      return response;
    } catch (error) {
      if (id) {
        dispatch({ phase: 'complete', id, url: urlString, provider, ok: false });
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
    const track = shouldTrack(urlString, method, provider);
    let id = null;
    let finished = false;

    if (track) {
      id = `xhr-${++state.seq}`;
      dispatch({ phase: 'start', id, url: urlString, provider });

      const finish = (ok) => {
        if (finished) return;
        finished = true;
        dispatch({ phase: 'complete', id, url: urlString, provider, ok });
      };

      this.addEventListener('loadend', () => finish(true), { once: true });
      this.addEventListener('error', () => finish(false), { once: true });
      this.addEventListener('abort', () => finish(false), { once: true });
      this.addEventListener('timeout', () => finish(false), { once: true });
    }

    return originalXHRSend.call(this, body);
  };
})();
