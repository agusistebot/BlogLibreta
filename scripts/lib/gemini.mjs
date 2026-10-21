// Cliente mínimo de la API de Gemini (Google AI Studio).
// El nivel gratuito permite generar texto sin costo; la búsqueda de Google integrada ("grounding")
// solo está disponible en el nivel pago, por eso por defecto la búsqueda la hace Tavily (ver ia.mjs).
//
// Cuando un modelo está saturado (error 503) o agotó su cuota, se pasa al siguiente modelo de la
// lista en vez de insistir: cada modelo gratuito tiene su propia capacidad y su propia cuota.
import { MODELOS_GEMINI } from './config.mjs';

const BASE = (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/$/, '') + '/v1beta/models/';
const ESPERA_BASE = Number(process.env.GEMINI_ESPERA_MS || 4000);
const INTENTOS_POR_MODELO = Number(process.env.GEMINI_INTENTOS || 3);
const REINTENTABLES = new Set([429, 500, 502, 503, 504]);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

let preferido = null; // último modelo que respondió bien
const descartados = new Set(); // modelos inexistentes o sin cuota diaria en esta ejecución

export function modeloGemini() {
  return preferido || MODELOS_GEMINI.find((m) => !descartados.has(m)) || MODELOS_GEMINI[0];
}

function mensajeDeError(texto) {
  try {
    const j = JSON.parse(texto);
    return j.error?.message || texto.slice(0, 200);
  } catch {
    return texto.replace(/\s+/g, ' ').slice(0, 200);
  }
}

async function llamar(modelo, body) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Falta GEMINI_API_KEY.');
  let ultimo;
  for (let i = 0; i < INTENTOS_POR_MODELO; i++) {
    if (i > 0) await esperar(ESPERA_BASE * 2 ** (i - 1) + Math.random() * 1000);
    let res;
    try {
      res = await fetch(`${BASE}${encodeURIComponent(modelo)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(240_000),
      });
    } catch (e) {
      ultimo = Object.assign(new Error(`Sin respuesta de Gemini (${modelo}): ${e.message}`), { transitorio: true });
      continue;
    }
    if (res.ok) return res.json();
    const texto = await res.text();
    const error = Object.assign(new Error(`Gemini ${res.status} (${modelo}): ${mensajeDeError(texto)}`), {
      status: res.status,
      transitorio: REINTENTABLES.has(res.status),
    });
    // Clave inválida o sin permiso: no tiene sentido seguir con ningún país.
    if ([401, 403].includes(res.status) || (res.status === 400 && /API key|API_KEY/i.test(texto))) {
      error.fatal = true;
      error.message = `La clave GEMINI_API_KEY no es válida o no tiene acceso: ${mensajeDeError(texto)}`;
      throw error;
    }
    if (!error.transitorio) throw error;
    // Cuota diaria agotada: con este modelo no hay nada que hacer hasta mañana.
    if (res.status === 429 && /per ?day|PerDay|daily/i.test(texto)) {
      error.cuotaDiaria = true;
      throw error;
    }
    ultimo = error;
    // Límite por minuto: Gemini indica cuánto esperar.
    const sugerido = Number(texto.match(/"retryDelay":\s*"(\d+(?:\.\d+)?)s"/)?.[1]);
    if (res.status === 429 && Number.isFinite(sugerido) && sugerido > 0 && sugerido <= 90) {
      await esperar(sugerido * 1000);
    }
  }
  throw ultimo;
}

function procesar(data) {
  const candidato = data.candidates?.[0];
  if (!candidato) {
    const motivo = data.promptFeedback?.blockReason;
    throw new Error(`Gemini no devolvió respuesta${motivo ? ` (bloqueada: ${motivo})` : ''}.`);
  }
  if (candidato.finishReason === 'MAX_TOKENS') throw new Error('La respuesta de Gemini se cortó por longitud.');
  const texto = (candidato.content?.parts || [])
    .filter((p) => typeof p.text === 'string' && !p.thought)
    .map((p) => p.text)
    .join('');
  if (!texto.trim()) throw new Error(`Gemini devolvió una respuesta vacía (${candidato.finishReason || 'sin motivo'}).`);
  const meta = candidato.groundingMetadata || {};
  return {
    texto,
    chunks: (meta.groundingChunks || []).map((c) => c.web).filter((w) => w?.uri),
    uso: {
      input_tokens: data.usageMetadata?.promptTokenCount || 0,
      output_tokens: data.usageMetadata?.candidatesTokenCount || 0,
      busquedas: meta.webSearchQueries?.length || 0,
    },
  };
}

export async function generar({ system, prompt, maxTokens = 16384, buscarEnGoogle = false, json = false }) {
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: maxTokens,
      ...(json && !buscarEnGoogle ? { responseMimeType: 'application/json' } : {}),
    },
    ...(buscarEnGoogle ? { tools: [{ google_search: {} }] } : {}),
  };
  // Primero el último modelo que funcionó, después el resto en el orden configurado.
  const orden = [preferido, ...MODELOS_GEMINI].filter((m, i, a) => m && a.indexOf(m) === i && !descartados.has(m));
  if (!orden.length) {
    throw Object.assign(new Error('Ningún modelo de Gemini tiene cuota disponible hoy.'), { transitorio: true });
  }
  let ultimo;
  for (const [i, modelo] of orden.entries()) {
    try {
      const data = await llamar(modelo, body);
      preferido = modelo;
      return procesar(data);
    } catch (e) {
      ultimo = e;
      const siguiente = orden[i + 1];
      const pruebo = siguiente ? `; pruebo con ${siguiente}` : '';
      if (e.status === 404) {
        descartados.add(modelo);
        console.warn(`    ${modelo} no existe${pruebo}.`);
      } else if (e.cuotaDiaria) {
        descartados.add(modelo);
        console.warn(`    ${modelo} agotó su cuota gratuita de hoy${pruebo}.`);
      } else if (e.transitorio) {
        if (preferido === modelo) preferido = null;
        console.warn(`    ${modelo} no responde (${e.status || 'sin conexión'})${pruebo}.`);
      } else {
        throw e;
      }
    }
  }
  throw Object.assign(new Error(`Todos los modelos de Gemini fallaron. Último error: ${ultimo.message}`), {
    transitorio: Boolean(ultimo.transitorio || ultimo.cuotaDiaria),
  });
}

// Los enlaces de la búsqueda de Google vienen como redirecciones: se resuelven a la URL real.
export async function resolverRedireccion(uri) {
  try {
    const res = await fetch(uri, { redirect: 'manual', signal: AbortSignal.timeout(15_000) });
    const destino = res.headers.get('location');
    return destino && /^https?:\/\//.test(destino) ? destino : uri;
  } catch {
    return uri;
  }
}
