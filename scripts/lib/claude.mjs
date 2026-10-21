// Cliente mínimo de la API de Claude con la herramienta de búsqueda web del servidor.
// Devuelve el texto final y el conjunto de URLs que aparecieron en los resultados de búsqueda,
// para que solo se puedan citar fuentes realmente encontradas.
import { MODELO, WEB_SEARCH_TOOL } from './config.mjs';
import { normalizarUrl } from './util.mjs';

const API = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '') + '/v1/messages';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function llamar(body, intentos = 5) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('Falta ANTHROPIC_API_KEY (agregala como secret del repositorio).');
  let ultimoError;
  for (let i = 0; i < intentos; i++) {
    let res;
    try {
      res = await fetch(API, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(300_000),
      });
    } catch (e) {
      ultimoError = Object.assign(new Error(`Sin respuesta de la API de Claude: ${e.message}`), { transitorio: true });
      await esperar(2000 * 2 ** i);
      continue;
    }
    if (res.ok) return res.json();
    const texto = await res.text();
    const reintentable = [408, 409, 429, 500, 502, 503, 504, 529].includes(res.status);
    ultimoError = Object.assign(new Error(`API ${res.status}: ${texto.slice(0, 400)}`), { status: res.status, transitorio: reintentable });
    if (!reintentable) throw ultimoError;
    const retry = Number(res.headers.get('retry-after'));
    await esperar(Number.isFinite(retry) && retry > 0 ? retry * 1000 : 3000 * 2 ** i);
  }
  throw ultimoError;
}

export async function preguntarConBusqueda({ system, prompt, maxTokens = 8000, maxBusquedas = 6, dominiosBloqueados }) {
  const herramienta = { type: WEB_SEARCH_TOOL, name: 'web_search', max_uses: maxBusquedas };
  if (dominiosBloqueados?.length) herramienta.blocked_domains = dominiosBloqueados;
  const messages = [{ role: 'user', content: prompt }];
  const urls = new Set();
  let textoFinal = '';
  let uso = { input_tokens: 0, output_tokens: 0, busquedas: 0 };

  for (let vuelta = 0; vuelta < 6; vuelta++) {
    const data = await llamar({ model: MODELO, max_tokens: maxTokens, system, messages, tools: [herramienta] });
    uso.input_tokens += data.usage?.input_tokens || 0;
    uso.output_tokens += data.usage?.output_tokens || 0;
    uso.busquedas += data.usage?.server_tool_use?.web_search_requests || 0;
    const partes = [];
    for (const bloque of data.content || []) {
      if (bloque.type === 'web_search_tool_result' && Array.isArray(bloque.content)) {
        for (const r of bloque.content) if (r.url) urls.add(normalizarUrl(r.url));
      }
      if (bloque.type === 'text') {
        partes.push(bloque.text);
        for (const c of bloque.citations || []) if (c.url) urls.add(normalizarUrl(c.url));
      }
    }
    textoFinal += partes.join('');
    if (data.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: data.content });
      continue;
    }
    if (data.stop_reason === 'max_tokens') throw new Error('La respuesta se cortó por max_tokens.');
    break;
  }
  return { texto: textoFinal, urls, uso };
}

// Extrae el último objeto JSON de la respuesta (idealmente dentro de ```json ... ```).
export function extraerJson(texto) {
  const bloques = [...texto.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1]);
  const candidatos = bloques.length ? bloques.reverse() : [texto.slice(texto.indexOf('{'), texto.lastIndexOf('}') + 1)];
  for (const c of candidatos) {
    try {
      return JSON.parse(c.trim());
    } catch {
      /* probar el siguiente */
    }
  }
  throw new Error('La respuesta no contiene un JSON válido.');
}

// Conserva solo las fuentes cuya URL apareció en la búsqueda (o en la lista de permitidas).
export function filtrarFuentes(fuentes, urlsEncontradas, permitidas = []) {
  const ok = new Set([...urlsEncontradas, ...permitidas.map(normalizarUrl)]);
  const vistas = new Set();
  return (Array.isArray(fuentes) ? fuentes : [])
    .filter((f) => f && typeof f.url === 'string' && /^https?:\/\//.test(f.url))
    .map((f) => ({ titulo: String(f.titulo || f.url).trim().slice(0, 180), url: f.url.trim() }))
    .filter((f) => {
      const n = normalizarUrl(f.url);
      if (vistas.has(n) || !ok.has(n)) return false;
      vistas.add(n);
      return true;
    });
}
