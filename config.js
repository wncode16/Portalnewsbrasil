// Portal News Brasil - Config
// IMPORTANTE: se você hospedar APENAS no GitHub Pages, qualquer chave colocada aqui fica pública.
// Para esconder a chave, use um proxy (ex.: Cloudflare Worker) e preencha PROXY_BASE.

window.PORTAL_NEWS_CONFIG = {
  // Opção A (mais simples): colocar a chave aqui (fica pública)
  GNEWS_API_KEY: "68f099fea6b6fdef486091b6845b6638",

  // Opção B (recomendado): usar um proxy e NÃO expor a chave no front-end.
  // Exemplo: "https://portal-news-proxy.seudominio.workers.dev"
  PROXY_BASE: "",

  // Defaults
  lang: "pt",
  country: "br",
  pageSize: 12,
};
