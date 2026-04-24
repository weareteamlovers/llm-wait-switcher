(() => {
  if (window.__LLM_WAIT_SWITCHER_PAGE_BRIDGE__) return;
  window.__LLM_WAIT_SWITCHER_PAGE_BRIDGE__ = true;

  const PAGE_NET_EVENT = 'LLM_WAIT_SWITCHER_NET_EVENT';

  const state = {
    seq: 0
  };

  function dispatch(detail) {
    try {
      window.dispatchEvent(new CustomEvent(PAGE_NET_EVENT, { detail }));
    } catch (error) {
      // Ignore bridge dispatch failures.
    }
  }

  function getProviderFromHost(hostname) {
    const host = String(hostname || '').toLowerCase();
    if (host.endsWith('chatgpt.com') || host.endsWith('chat.openai.com')) return 'chatgpt';
    if (host.endsWith('claude.ai') || host.endsWith('code.claude.com')) return 'claude';
    if (host.endsWith('gemini.google.com') || host.endsWith('aistudio.google.com')) return 'gemini';
    if (host.endsWith('copilot.microsoft.com')) return 'copilot';
    if (host.endsWith('grok.com')) return 'grok';
    if (host.endsWith('perplexity.ai')) return 'perplexity';
    if (host.endsWith('poe.com')) return 'poe';
    if (host.endsWith('deepseek.com')) return 'deepseek';
    if (host.endsWith('mistral.ai')) return 'mistral';
    if (host.endsWith('midjourney.com')) return 'midjourney';
    if (host.endsWith('cursor.com')) return 'cursor';
    if (host.endsWith('qwen.ai')) return 'qwen';
    if (host.endsWith('kimi.com')) return 'kimi';
    return 'generic';
  }

  const provider = getProviderFromHost(location.hostname);

  function toAbsoluteUrl(urlLike) {
    try {
      return new URL(urlLike, location.href);
    } catch (error) {
      return null;
    }
  }

  function extractUrl(input) {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.href;
    if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
    if (input && typeof input.url === 'string') return input.url;
    return '';
  }

  function extractMethod(input, init) {
    const inputMethod =
      (typeof Request !== 'undefined' && input instanceof Request && input.method) ||
      input?.method ||
      init?.method ||
      'GET';
    return String(inputMethod || 'GET').toUpperCase();
  }

  function isExcluded(urlString) {
    return /auth|login|logout|telemetry|analytics|tracking|favicon|assets|static|\.css(\?|$)|\.js(\?|$)|\.png(\?|$)|\.jpg(\?|$)|\.svg(\?|$)/i.test(
      urlString
    );
  }

  function matchesProviderUrl(urlString, urlObj, currentProvider) {
    if (!urlObj) return false;
    const host = urlObj.hostname.toLowerCase();
    const s = urlString.toLowerCase();

    if (currentProvider === 'chatgpt') {
      return host.includes('openai') && /(conversation|responses|backend-api|messages|completion|chat-requirements)/.test(s);
    }
    if (currentProvider === 'claude') {
      return host.includes('claude.ai') && /(chat_conversations|append_message|retry_message|completion|messages)/.test(s);
    }
    if (currentProvider === 'gemini') {
      return host.includes('google') && /(generatecontent|streamgeneratecontent|batchexecute|bard|conversation|model|content)/.test(s);
    }
    if (currentProvider === 'copilot') {
      return /(copilot|chat|conversation|message|response)/.test(s);
    }
    if (currentProvider === 'grok') {
      return /(grok|conversation|response|chat|message|completion)/.test(s);
    }
    if (currentProvider === 'perplexity') {
      return /(perplexity|chat|thread|message|response)/.test(s);
    }
    if (currentProvider === 'poe') {
      return /(poe|chat|message|bot|conversation|answer)/.test(s);
    }
    if (currentProvider === 'deepseek') {
      return /(deepseek|chat|conversation|message|response|completion)/.test(s);
    }
    if (currentProvider === 'mistral') {
      return /(mistral|chat|conversation|message|completion)/.test(s);
    }
    if (currentProvider === 'midjourney') {
      return /(midjourney|imagine|job|task|message|chat)/.test(s);
    }
    if (currentProvider === 'cursor') {
      return /(cursor|chat|conversation|message|completion)/.test(s);
    }
    if (currentProvider === 'qwen') {
      return /(qwen|chat|conversation|message|response|completion)/.test(s);
    }
    if (currentProvider === 'kimi') {
      return /(kimi|chat|conversation|message|response|completion)/.test(s);
    }

    return /(chat|conversation|message|response|completion|generate|stream|assistant|prompt|append|retry|model)/.test(s);
  }

  function shouldTrackRequest(urlString, method) {
    if (!urlString) return false;
    if (!['POST', 'PUT', 'PATCH'].includes(method)) return false;
    if (isExcluded(urlString)) return false;

    const urlObj = toAbsoluteUrl(urlString);
    if (!urlObj) return false;

    return matchesProviderUrl(urlString, urlObj, provider);
  }

  async function consumeFetchBody(response, id, urlString) {
    try {
      const clone = response.clone();
      if (!clone.body || typeof clone.body.getReader !== 'function') {
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

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function patchedFetch(input, init) {
    const urlString = extractUrl(input);
    const method = extractMethod(input, init);
    const shouldTrack = shouldTrackRequest(urlString, method);
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
        consumeFetchBody(response, id, urlString);
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

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function patchedOpen(method, url, ...rest) {
    this.__lwsMethod = String(method || 'GET').toUpperCase();
    this.__lwsUrl = typeof url === 'string' ? url : '';
    return originalOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function patchedSend(body) {
    const urlString = this.__lwsUrl || '';
    const method = this.__lwsMethod || 'GET';
    const shouldTrack = shouldTrackRequest(urlString, method);
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
      this.addEventListener('timeout', () => finish(false), { once: true });
    }

    return originalSend.call(this, body);
  };
})();