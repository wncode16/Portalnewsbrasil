/* Portal News Brasil (GitHub Pages)
   - UI inspirado no layout mobile do G1/GloboNews (header vermelho + cards)
   - Agora: SOMENTE suas notícias via Worker API: /api/posts
     Ex.: https://portalnewsbrasil03.wncode16.workers.dev/api/posts
*/

(() => {
  'use strict';

  const cfg = window.PORTAL_NEWS_CONFIG || {};
  const PAGE_SIZE = Number(cfg.pageSize || 12);

  // ✅ SUA API (Worker)
  // Você pode sobrescrever no config.js com:
  // OWN_API_BASE: "https://seu-worker.seu-subdominio.workers.dev"
  const BASE = String(cfg.OWN_API_BASE || 'https://portalnewsbrasil03.wncode16.workers.dev')
    .trim()
    .replace(/\/$/, '');
  const API_POSTS_URL = `${BASE}/api/posts`;

  // Categorias viram filtros por tags dos seus posts
  const CATEGORIES = [
    { id: 'general', label: 'Destaques', hint: 'geral', tag: null },
    { id: 'nation', label: 'Brasil', hint: 'país', tag: 'brasil' },
    { id: 'world', label: 'Mundo', hint: 'internacional', tag: 'mundo' },
    { id: 'business', label: 'Economia', hint: 'negócios', tag: 'economia' },
    { id: 'technology', label: 'Tecnologia', hint: 'tech', tag: 'tecnologia' },
    { id: 'sports', label: 'Esportes', hint: 'esportes', tag: 'esportes' },
    { id: 'entertainment', label: 'Entretenimento', hint: 'cultura', tag: 'entretenimento' },
    { id: 'science', label: 'Ciência', hint: 'ciência', tag: 'ciencia' },
    { id: 'health', label: 'Saúde', hint: 'saúde', tag: 'saude' },
  ];

  const state = {
    category: 'general',
    query: '',
    loading: false,

    // dados brutos
    allPosts: [],

    // após filtro (categoria/busca)
    filtered: [],

    // paginação local
    cursor: 0,
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

  function norm(s) {
    return String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
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

  // Converte seu post no “formato de card” que a UI já usa
  function postToCard(post) {
    return {
      id: post.id,
      title: post.title || '—',
      description: post.summary || post.description || '',
      image: post.image || '',
      publishedAt: post.publishedAt || post.date || '',
      source: { name: 'Portal News Brasil' },
      // não usamos link externo; abrimos modal
      url: '#',
      _raw: post,
    };
  }

  function renderFeatured(article) {
    if (!article) return;

    const title = article.title || '—';
    const src = (article.source && article.source.name) ? article.source.name : '';
    const time = article.publishedAt ? fmtTime(article.publishedAt) : '';
    const img = article.image || '';

    el.featuredMedia.classList.remove('skeleton');
    el.featuredTitle.classList.remove('skeleton-line');

    el.featuredMedia.style.backgroundImage = img ? `url('${img.replaceAll("'", "%27")}')` : 'none';
    el.featuredTitle.textContent = title;
    el.featuredMeta.textContent = [src, time].filter(Boolean).join(' • ');

    el.featuredMedia.style.cursor = 'pointer';
    el.featuredTitle.style.cursor = 'pointer';

    const open = () => openPostModal(article._raw);
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

      return `
        <article class="card" tabindex="0" role="button" data-id="${escapeHtml(a.id || '')}">
          <div class="card__img" style="background-image:${img ? `url('${img.replaceAll("'", "%27")}')` : 'none'}"></div>
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

    el.cards.querySelectorAll('.card').forEach((card) => {
      const open = () => {
        const id = card.getAttribute('data-id');
        const post = state.allPosts.find((p) => String(p.id) === String(id));
        if (post) openPostModal(post);
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

  function applyFilters() {
    const cat = CATEGORIES.find((c) => c.id === state.category) || CATEGORIES[0];
    const tagNeed = cat.tag; // null = todos
    const q = norm(state.query);

    let posts = [...state.allPosts];

    // ordena por data desc
    posts.sort((a, b) => {
      const da = new Date(a.publishedAt || a.date || 0).getTime();
      const db = new Date(b.publishedAt || b.date || 0).getTime();
      return db - da;
    });

    if (tagNeed) {
      posts = posts.filter((p) => {
        const tags = Array.isArray(p.tags) ? p.tags : [];
        const tagsNorm = tags.map(norm);
        return tagsNorm.includes(norm(tagNeed));
      });
    }

    if (q) {
      posts = posts.filter((p) => {
        const hay = norm(`${p.title || ''} ${p.summary || p.description || ''} ${p.content || ''}`);
        return hay.includes(q);
      });
    }

    state.filtered = posts;
    state.cursor = 0;
  }

  async function fetchAllPosts() {
    const res = await fetch(API_POSTS_URL, { method: 'GET' });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Erro ${res.status}: ${detail || res.statusText}`);
    }
    const data = await res.json(); // aqui precisa ser ARRAY JSON
    if (!Array.isArray(data)) return [];
    return data;
  }

  function renderNextPage({ reset }) {
    const slice = state.filtered.slice(state.cursor, state.cursor + PAGE_SIZE).map(postToCard);

    if (reset) {
      // featured = 1o item da lista filtrada
      const first = state.filtered[0] ? postToCard(state.filtered[0]) : null;
      renderFeatured(first);

      // cards = a partir do segundo item
      const rest = state.filtered.slice(1, 1 + PAGE_SIZE).map(postToCard);
      renderCards(rest, false);

      state.cursor = 1 + PAGE_SIZE;
    } else {
      renderCards(slice, true);
      state.cursor += PAGE_SIZE;
    }

    const total = state.filtered.length;
    const shown = Math.min(state.cursor, total);

    if (!total) setStatus('Nenhuma notícia encontrada.');
    else setStatus(`Mostrando ${shown} de ${total} notícias.`);

    // botão "mais"
    const hasMore = state.cursor < total;
    el.btnMore.style.display = hasMore ? '' : 'none';
  }

  async function load({ reset }) {
    if (state.loading) return;

    if (reset) {
      el.cards.innerHTML = '';
      el.featuredMedia.classList.add('skeleton');
      el.featuredTitle.classList.add('skeleton-line');
      el.featuredTitle.textContent = 'Carregando manchete…';
      el.featuredMeta.textContent = '';
    }

    setLoading(true);
    setStatus('Carregando…');

    try {
      // carrega do worker só quando resetar (refresh / troca de filtro / busca)
      if (reset || !state.allPosts.length) {
        state.allPosts = await fetchAllPosts();
        applyFilters();
        renderNextPage({ reset: true });
      } else {
        renderNextPage({ reset: false });
      }
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

  // ===== Modal (texto completo) =====
  function ensureModal() {
    if (document.getElementById('postModal')) return;

    const style = document.createElement('style');
    style.textContent = `
      .pn-modal{position:fixed;inset:0;z-index:9999;display:none}
      .pn-modal.is-open{display:block}
      .pn-modal__backdrop{position:absolute;inset:0;background:rgba(0,0,0,.55)}
      .pn-modal__sheet{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
        width:min(92vw,720px);max-height:86vh;overflow:auto;background:#fff;border-radius:14px;
        box-shadow:0 12px 40px rgba(0,0,0,.25);padding:16px}
      .pn-modal__close{border:none;background:#f2f2f2;border-radius:10px;padding:10px 12px;cursor:pointer}
      .pn-modal__title{font-size:20px;line-height:1.25;margin:12px 0 6px}
      .pn-modal__meta{color:#666;font-size:12px;margin-bottom:10px}
      .pn-modal__img{width:100%;border-radius:12px;display:none;margin:10px 0}
      .pn-modal__content{font-size:15px;line-height:1.55;color:#222;white-space:pre-wrap}
      .pn-modal__tags{margin-top:10px;color:#666;font-size:12px}
    `;
    document.head.appendChild(style);

    const modal = document.createElement('div');
    modal.id = 'postModal';
    modal.className = 'pn-modal';
    modal.innerHTML = `
      <div class="pn-modal__backdrop" data-close="1"></div>
      <div class="pn-modal__sheet" role="dialog" aria-modal="true">
        <button class="pn-modal__close" type="button" data-close="1">Fechar ✕</button>
        <h2 class="pn-modal__title" id="pnModalTitle"></h2>
        <div class="pn-modal__meta" id="pnModalMeta"></div>
        <img class="pn-modal__img" id="pnModalImg" alt="">
        <div class="pn-modal__content" id="pnModalContent"></div>
        <div class="pn-modal__tags" id="pnModalTags"></div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelectorAll('[data-close="1"]').forEach((x) => {
      x.addEventListener('click', closePostModal);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closePostModal();
    });
  }

  function openPostModal(post) {
    ensureModal();
    const modal = document.getElementById('postModal');
    const t = document.getElementById('pnModalTitle');
    const m = document.getElementById('pnModalMeta');
    const img = document.getElementById('pnModalImg');
    const c = document.getElementById('pnModalContent');
    const tags = document.getElementById('pnModalTags');

    t.textContent = post.title || '—';
    m.textContent = post.publishedAt ? fmtTime(post.publishedAt) : '';
    c.textContent = post.content || post.summary || post.description || '';

    const srcImg = (post.image || '').trim();
    if (srcImg) {
      img.src = srcImg;
      img.style.display = 'block';
    } else {
      img.removeAttribute('src');
      img.style.display = 'none';
    }

    const tgs = Array.isArray(post.tags) ? post.tags : [];
    tags.textContent = tgs.length ? `Tags: ${tgs.join(', ')}` : '';

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closePostModal() {
    const modal = document.getElementById('postModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }

  // ===== Eventos =====
  el.btnMenu.addEventListener('click', () => openDrawer(true));
  el.btnCloseMenu.addEventListener('click', () => openDrawer(false));
  el.drawerBackdrop.addEventListener('click', () => openDrawer(false));

  el.btnSearch.addEventListener('click', () => openSearch(true));
  el.btnSearchClose.addEventListener('click', () => openSearch(false));
  el.btnSearchGo.addEventListener('click', () => runSearch(el.searchInput.value));
  el.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runSearch(el.searchInput.value);
    if (e.key === 'Escape') openSearch(false);
  });

  el.btnRefresh.addEventListener('click', () => {
    state.allPosts = [];
    load({ reset: true });
  });
  el.btnMore.addEventListener('click', () => load({ reset: false }));

  document.querySelectorAll('.bottom-nav__item').forEach((btn) => {
    btn.addEventListener('click', () => selectCategory(btn.getAttribute('data-section')));
  });

  // Init
  renderNav();
  selectCategory('general');
})();
