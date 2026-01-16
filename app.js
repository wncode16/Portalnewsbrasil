/* Portal News Brasil (GitHub Pages)
   - UI inspirado no layout mobile do G1/GloboNews (header vermelho + cards)
   - Dados via GNews API (top-headlines / search)
   Parâmetros (category/lang/country/max/page/from) estão na documentação oficial. 
*/

(() => {
  'use strict';

  const cfg = window.PORTAL_NEWS_CONFIG || {};
  const PAGE_SIZE = Number(cfg.pageSize || 12);
  const LANG = (cfg.lang || 'pt').trim();
  const COUNTRY = (cfg.country || 'br').trim();

  const CATEGORIES = [
    { id: 'general', label: 'Destaques', hint: 'geral' },
    { id: 'nation', label: 'Brasil', hint: 'país' },
    { id: 'world', label: 'Mundo', hint: 'internacional' },
    { id: 'business', label: 'Economia', hint: 'negócios' },
    { id: 'technology', label: 'Tecnologia', hint: 'tech' },
    { id: 'sports', label: 'Esportes', hint: 'esportes' },
    { id: 'entertainment', label: 'Entretenimento', hint: 'cultura' },
    { id: 'science', label: 'Ciência', hint: 'ciência' },
    { id: 'health', label: 'Saúde', hint: 'saúde' },
  ];

  const state = {
    category: 'general',
    query: '',
    page: 1,
    loading: false,
    articles: [],
  };

  const el = {
    drawer: document.getElementById('drawer'),
    drawerBackdrop: document.getElementById('drawerBackdrop'),
    btnMenu: document.getElementById('btnMenu'),
    btnCloseMenu: document.getElementById('btnCloseMenu'),
    sectionNav: document.getElementById('sectionNav'),

    search: document.getElementById('search'),
    btnSearch: document.getElementById('btnSearch'),
    btnSearchClose: document.getElementById('btnSearchClose'),
    btnSearchGo: document.getElementById('btnSearchGo'),
    searchInput: document.getElementById('searchInput'),

    featuredMedia: document.getElementById('featuredMedia'),
    featuredTitle: document.getElementById('featuredTitle'),
    featuredMeta: document.getElementById('featuredMeta'),

    listTitle: document.getElementById('listTitle'),
    status: document.getElementById('status'),
    cards: document.getElementById('cards'),
    btnMore: document.getElementById('btnMore'),
    btnRefresh: document.getElementById('btnRefresh'),
  };

  function fromLast24hISO() {
    return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function fmtTime(iso) {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return '';
    }
  }

  function getBaseUrl() {
    const proxy = (cfg.PROXY_BASE || '').trim();
    if (proxy) return proxy.replace(/\/$/, '');
    return 'https://gnews.io/api/v4';
  }

  function ensureApiKeyIfNeeded(params) {
    // Se você NÃO estiver usando proxy, precisa colocar a chave no config.js.
    // No proxy, a chave fica no servidor.
    const usingProxy = Boolean((cfg.PROXY_BASE || '').trim());
    if (usingProxy) return;

    const key = (cfg.GNEWS_API_KEY || '').trim();
    if (!key || key.includes('COLE_SUA_CHAVE')) {
      throw new Error('Cole sua chave da GNews em config.js (GNEWS_API_KEY) ou configure um PROXY_BASE.');
    }
    params.set('apikey', key);
  }

  function buildUrl() {
    const base = getBaseUrl();
    const isSearch = Boolean(state.query && state.query.trim());
    const endpoint = isSearch ? 'search' : 'top-headlines';

    const params = new URLSearchParams();
    params.set('lang', LANG);
    params.set('country', COUNTRY);
    params.set('max', String(PAGE_SIZE));
    params.set('page', String(state.page));
    params.set('from', fromLast24hISO());

    if (isSearch) {
      params.set('q', state.query.trim());
      params.set('sortby', 'publishedAt');
      params.set('in', 'title,description');
    } else {
      params.set('category', state.category);
    }

    ensureApiKeyIfNeeded(params);
    return `${base}/${endpoint}?${params.toString()}`;
  }

  function setStatus(text) {
    el.status.textContent = text || '';
  }

  function setLoading(isLoading) {
    state.loading = isLoading;
    el.btnMore.disabled = isLoading;
    el.btnRefresh.disabled = isLoading;
    el.btnMore.textContent = isLoading ? 'Carregando…' : 'Carregar mais';
  }

  function openDrawer(open) {
    el.drawer.classList.toggle('is-open', open);
    el.drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
  }

  function openSearch(open) {
    el.search.classList.toggle('is-open', open);
    el.search.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) setTimeout(() => el.searchInput.focus(), 0);
  }

  function renderNav() {
    el.sectionNav.innerHTML = CATEGORIES.map((c) => {
      const active = !state.query && c.id === state.category;
      return `
        <button class="drawer__item ${active ? 'is-active' : ''}" data-category="${c.id}">
          <span>${c.label}</span>
          <small>${c.hint}</small>
        </button>
      `;
    }).join('');

    el.sectionNav.querySelectorAll('[data-category]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectCategory(btn.getAttribute('data-category'));
        openDrawer(false);
      });
    });
  }

  function renderFeatured(article) {
    if (!article) return;

    const title = article.title || '—';
    const src = (article.source && article.source.name) ? article.source.name : '';
    const time = article.publishedAt ? fmtTime(article.publishedAt) : '';
    const img = article.image || '';

    el.featuredMedia.classList.remove('skeleton');
    el.featuredTitle.classList.remove('skeleton-line');

    el.featuredMedia.style.backgroundImage = img ? `url('${img.replaceAll("'", "%27") }')` : 'none';
    el.featuredTitle.textContent = title;
    el.featuredMeta.textContent = [src, time].filter(Boolean).join(' • ');

    // Clique abre a matéria
    const url = article.url || '#';
    el.featuredMedia.style.cursor = url !== '#' ? 'pointer' : 'default';
    el.featuredTitle.style.cursor = url !== '#' ? 'pointer' : 'default';

    const open = () => {
      if (url && url !== '#') window.open(url, '_blank', 'noopener');
    };

    el.featuredMedia.onclick = open;
    el.featuredTitle.onclick = open;
  }

  function renderCards(articles, append) {
    const html = (articles || []).map((a) => {
      const title = escapeHtml(a.title || '');
      const desc = escapeHtml(a.description || '');
      const img = a.image || '';
      const src = escapeHtml((a.source && a.source.name) ? a.source.name : '');
      const time = a.publishedAt ? fmtTime(a.publishedAt) : '';
      const url = a.url || '#';

      return `
        <article class="card" tabindex="0" role="link" data-url="${escapeHtml(url)}">
          <div class="card__img" style="background-image:${img ? `url('${img.replaceAll("'", "%27") }')` : 'none'}"></div>
          <div class="card__content">
            <h3 class="card__title">${title}</h3>
            <div class="card__meta">
              <span class="card__source">${src}</span>
              ${time ? `<span class="card__time">${time}</span>` : ''}
            </div>
            ${desc ? `<p class="card__desc">${desc}</p>` : ''}
          </div>
        </article>
      `;
    }).join('');

    if (append) el.cards.insertAdjacentHTML('beforeend', html);
    else el.cards.innerHTML = html;

    // Delegation
    el.cards.querySelectorAll('.card').forEach((card) => {
      const open = () => {
        const url = card.getAttribute('data-url');
        if (url && url !== '#') window.open(url, '_blank', 'noopener');
      };
      card.addEventListener('click', open);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      });
    });
  }

  async function load({ reset }) {
    if (state.loading) return;

    if (reset) {
      state.page = 1;
      state.articles = [];
      el.cards.innerHTML = '';
      el.featuredMedia.classList.add('skeleton');
      el.featuredTitle.classList.add('skeleton-line');
      el.featuredTitle.textContent = 'Carregando manchete…';
      el.featuredMeta.textContent = '';
    }

    setLoading(true);
    setStatus('Carregando…');

    try {
      const url = buildUrl();
      const res = await fetch(url);
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Erro ${res.status}: ${detail || res.statusText}`);
      }

      const data = await res.json();
      const articles = Array.isArray(data.articles) ? data.articles : [];

      if (reset) {
        renderFeatured(articles[0]);
        renderCards(articles.slice(1), false);
        state.articles = articles;
      } else {
        renderCards(articles, true);
        state.articles = state.articles.concat(articles);
      }

      if (!state.articles.length) setStatus('Nenhuma notícia encontrada nas últimas 24h.');
      else setStatus(`Mostrando ${state.articles.length} notícias (últimas 24h).`);

      state.page += 1;
    } catch (err) {
      console.error(err);
      setStatus(`⚠️ ${err?.message || 'Falha ao carregar notícias'}`);
    } finally {
      setLoading(false);
    }
  }

  function selectCategory(cat) {
    state.category = cat || 'general';
    state.query = '';
    el.searchInput.value = '';

    const title = CATEGORIES.find((c) => c.id === state.category)?.label || 'Destaques';
    el.listTitle.textContent = title;

    document.querySelectorAll('.bottom-nav__item').forEach((b) => {
      b.classList.toggle('is-active', b.getAttribute('data-section') === state.category);
    });

    renderNav();
    load({ reset: true });
  }

  function runSearch(q) {
    state.query = (q || '').trim();
    if (!state.query) {
      selectCategory(state.category);
      return;
    }
    el.listTitle.textContent = `Busca: ${state.query}`;
    openSearch(false);
    renderNav();
    load({ reset: true });
  }

  // Eventos (menu)
  el.btnMenu.addEventListener('click', () => openDrawer(true));
  el.btnCloseMenu.addEventListener('click', () => openDrawer(false));
  el.drawerBackdrop.addEventListener('click', () => openDrawer(false));

  // Eventos (busca)
  el.btnSearch.addEventListener('click', () => openSearch(true));
  el.btnSearchClose.addEventListener('click', () => openSearch(false));
  el.btnSearchGo.addEventListener('click', () => runSearch(el.searchInput.value));
  el.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runSearch(el.searchInput.value);
    if (e.key === 'Escape') openSearch(false);
  });

  // Eventos (listagem)
  el.btnRefresh.addEventListener('click', () => load({ reset: true }));
  el.btnMore.addEventListener('click', () => load({ reset: false }));

  // Bottom nav
  document.querySelectorAll('.bottom-nav__item').forEach((btn) => {
    btn.addEventListener('click', () => selectCategory(btn.getAttribute('data-section')));
  });

  // Init
  renderNav();
  selectCategory('general');
})();
