// Capa común para investigar con IA + búsqueda web, con tres combinaciones posibles:
//
//   gemini + tavily  (por defecto, gratis): Tavily busca y Gemini, en su nivel gratuito, redacta
//                    usando solo esos resultados.
//   gemini + google  (nivel pago de Gemini): Gemini busca con Google Search integrado.
//   claude           (pago): Claude busca con su herramienta de búsqueda web.
//
// Se elige con las variables AI_PROVIDER (gemini | claude) y SEARCH_PROVIDER (tavily | google).
// Si no se indican, se usa Gemini (si hay GEMINI_API_KEY) con Tavily para buscar.
import { MODELO as MODELO_CLAUDE } from './config.mjs';
import { preguntarConBusqueda } from './claude.mjs';
import { generar, modeloGemini, resolverRedireccion } from './gemini.mjs';
import { buscar } from './tavily.mjs';
import { normalizarUrl, hoyISO } from './util.mjs';

export function proveedor() {
  const elegido = (process.env.AI_PROVIDER || '').toLowerCase();
  if (elegido === 'claude' || elegido === 'gemini') return elegido;
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.ANTHROPIC_API_KEY) return 'claude';
  return 'gemini';
}

export function buscador() {
  if (proveedor() === 'claude') return 'claude';
  const elegido = (process.env.SEARCH_PROVIDER || '').toLowerCase();
  if (elegido === 'tavily' || elegido === 'google') return elegido;
  // Google Search integrado solo funciona en el nivel pago de Gemini: hay que pedirlo explícitamente.
  return 'tavily';
}

export function descripcion() {
  if (proveedor() === 'claude') return MODELO_CLAUDE;
  return `${modeloGemini()} + ${buscador() === 'tavily' ? 'Tavily' : 'Google Search'}`;
}

export function verificarClaves() {
  const ruta = 'GitHub → Settings → Secrets and variables → Actions → New repository secret';
  if (proveedor() === 'claude') {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error(`Falta ANTHROPIC_API_KEY (${ruta}).`);
    return;
  }
  if (!process.env.GEMINI_API_KEY) throw new Error(`Falta GEMINI_API_KEY, que se crea gratis en Google AI Studio (${ruta}).`);
  if (buscador() === 'tavily' && !process.env.TAVILY_API_KEY) {
    throw new Error(`Falta TAVILY_API_KEY, que se crea gratis en tavily.com (${ruta}).`);
  }
}

// Pausa entre llamadas para no superar los límites por minuto del nivel gratuito de Gemini.
export function pausaEntreLlamadas() {
  return proveedor() === 'gemini' ? Number(process.env.PAUSA_MS || 6000) : 0;
}

function limpiarTexto(texto, max) {
  const limpio = String(texto || '').replace(/\s+/g, ' ').trim();
  return limpio.length > max ? `${limpio.slice(0, max)}…` : limpio;
}

/**
 * Investiga en la web y devuelve la respuesta del modelo junto con las URLs que realmente
 * aparecieron en la búsqueda (las únicas que se aceptan como fuentes).
 * `consultas` son las búsquedas a hacer cuando el modelo no busca por su cuenta (modo Tavily).
 */
export async function investigar({ system, prompt, consultas = [], maxTokens = 16000, maxBusquedas = 6, excluir = [] }) {
  if (proveedor() === 'claude') {
    const r = await preguntarConBusqueda({
      system,
      prompt,
      maxTokens: Math.min(maxTokens, 16000),
      maxBusquedas,
      dominiosBloqueados: excluir,
    });
    return { ...r, resultados: [], complementar: false };
  }

  if (buscador() === 'tavily') {
    const vistos = new Map();
    let busquedas = 0;
    for (const consulta of consultas.slice(0, maxBusquedas)) {
      try {
        const resultados = await buscar(consulta, { maxResultados: 5, excluir });
        busquedas++;
        for (const r of resultados) {
          const clave = normalizarUrl(r.url);
          if (!vistos.has(clave)) vistos.set(clave, r);
        }
      } catch (e) {
        if (e.fatal) throw e;
        console.warn(`    Búsqueda fallida "${consulta}": ${e.message}`);
      }
    }
    const resultados = [...vistos.values()].slice(0, 18);
    if (!resultados.length) throw new Error('La búsqueda web no devolvió resultados.');
    const contexto = resultados
      .map((r, i) => `[${i + 1}] ${r.titulo}\nURL: ${r.url}\n${limpiarTexto(r.texto || r.extracto, 3500)}`)
      .join('\n\n---\n\n');
    const g = await generar({
      system,
      prompt: `${prompt}\n\nRESULTADOS DE BÚSQUEDA WEB (obtenidos el ${hoyISO()}). Son las únicas fuentes que podés usar y citar. Copiá cada URL exactamente como aparece.\n\n${contexto}`,
      maxTokens,
      json: true,
    });
    return {
      texto: g.texto,
      urls: new Set(resultados.map((r) => normalizarUrl(r.url))),
      resultados: resultados.map((r) => ({ url: r.url, titulo: r.titulo })),
      uso: { ...g.uso, busquedas },
      complementar: false,
    };
  }

  // Gemini con Google Search integrado (requiere el nivel pago de la API de Gemini).
  const g = await generar({ system, prompt, maxTokens, buscarEnGoogle: true });
  const resueltos = await Promise.all(
    g.chunks.map(async (c) => ({ url: await resolverRedireccion(c.uri), titulo: c.title || '' }))
  );
  const resultados = resueltos.filter((r) => /^https?:\/\//.test(r.url) && !r.url.includes('grounding-api-redirect'));
  return {
    texto: g.texto,
    urls: new Set(resultados.map((r) => normalizarUrl(r.url))),
    resultados,
    uso: g.uso,
    // Las URLs que el modelo escribe en su respuesta pueden no coincidir con las de la búsqueda:
    // si faltan fuentes válidas, se completan con las páginas que Google efectivamente consultó.
    complementar: true,
  };
}

// Generación sin búsqueda (por ejemplo, para elegir la próxima ruta del blog).
export async function generarSinBusqueda({ system, prompt, maxTokens = 4000 }) {
  if (proveedor() === 'claude') {
    const r = await preguntarConBusqueda({ system, prompt, maxTokens, maxBusquedas: 1 });
    return r.texto;
  }
  const g = await generar({ system, prompt, maxTokens, json: true });
  return g.texto;
}
