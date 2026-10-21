// Búsqueda web con Tavily. El plan gratuito incluye 1.000 créditos por mes sin tarjeta;
// cada búsqueda "basic" consume 1 crédito.
const API = (process.env.TAVILY_BASE_URL || 'https://api.tavily.com').replace(/\/$/, '') + '/search';
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export async function buscar(consulta, { maxResultados = 5, excluir = [] } = {}) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw Object.assign(new Error('Falta TAVILY_API_KEY.'), { fatal: true });
  let ultimo;
  for (let i = 0; i < 4; i++) {
    let res;
    try {
      res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({
          query: consulta,
          search_depth: 'basic',
          max_results: maxResultados,
          include_raw_content: 'text',
          include_answer: false,
          ...(excluir.length ? { exclude_domains: excluir } : {}),
        }),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (e) {
      ultimo = e;
      await esperar(2000 * 2 ** i);
      continue;
    }
    if (res.ok) {
      const data = await res.json();
      return (data.results || [])
        .filter((r) => r.url)
        .map((r) => ({ url: r.url, titulo: r.title || r.url, extracto: r.content || '', texto: r.raw_content || '' }));
    }
    const texto = await res.text();
    if (res.status === 432 || res.status === 433) {
      throw Object.assign(new Error('Se agotaron los créditos de Tavily de este mes.'), { fatal: true });
    }
    if (res.status === 401) throw Object.assign(new Error('La clave TAVILY_API_KEY no es válida.'), { fatal: true });
    ultimo = new Error(`Tavily ${res.status}: ${texto.slice(0, 300)}`);
    if (res.status !== 429 && res.status < 500) throw ultimo;
    const retry = Number(res.headers.get('retry-after'));
    await esperar(Number.isFinite(retry) && retry > 0 ? retry * 1000 : 3000 * 2 ** i);
  }
  throw ultimo;
}
