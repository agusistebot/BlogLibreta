// Cliente mínimo de la API de Gemini (Google AI Studio).
// El nivel gratuito permite generar texto sin costo; la búsqueda de Google integrada ("grounding")
// solo está disponible en el nivel pago, por eso por defecto la búsqueda la hace Tavily (ver ia.mjs).
import { MODELOS_GEMINI } from './config.mjs';

const BASE = (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/$/, '') + '/v1beta/models/';
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
let modeloActivo = null;

export function modeloGemini() {
  return modeloActivo || MODELOS_GEMINI[0];
}

async function llamar(modelo, body, intentos = 6) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Falta GEMINI_API_KEY.');
  let ultimo;
  for (let i = 0; i < intentos; i++) {
    let res;
    try {
      res = await fetch(`${BASE}${encodeURIComponent(modelo)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(300_000),
      });
    } catch (e) {
      ultimo = e;
      await esperar(3000 * 2 ** i);
      continue;
    }
    if (res.ok) return res.json();
    const texto = await res.text();
    ultimo = Object.assign(new Error(`Gemini ${res.status}: ${texto.slice(0, 400)}`), { status: res.status });
    if (![429, 500, 502, 503, 504].includes(res.status)) throw ultimo;
    // En el nivel gratuito, Gemini indica cuánto esperar cuando se supera el límite por minuto.
    const sugerido = Number(texto.match(/"retryDelay":\s*"(\d+(?:\.\d+)?)s"/)?.[1]);
    await esperar(Number.isFinite(sugerido) && sugerido > 0 ? (sugerido + 2) * 1000 : 5000 * 2 ** i);
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

// Prueba los modelos configurados en orden: si uno ya no existe, pasa al siguiente.
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
  const modelos = modeloActivo ? [modeloActivo] : MODELOS_GEMINI;
  let ultimo;
  for (const modelo of modelos) {
    try {
      const data = await llamar(modelo, body);
      modeloActivo = modelo;
      return procesar(data);
    } catch (e) {
      ultimo = e;
      if (e.status === 404) {
        console.warn(`    El modelo ${modelo} no está disponible; pruebo el siguiente.`);
        continue;
      }
      throw e;
    }
  }
  throw ultimo;
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
