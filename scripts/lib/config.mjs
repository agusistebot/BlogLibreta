import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const DATA = path.join(ROOT, 'data');
export const CONTENT = path.join(ROOT, 'content');
export const POSTS_DIR = path.join(CONTENT, 'blog');
export const STATIC = path.join(ROOT, 'static');
export const DIST = path.join(ROOT, process.env.OUT_DIR || 'dist');

export const SITE = {
  name: 'Permiso Internacional de Conducir',
  domain: 'permisointernacionaldeconducir.com',
  // URL pública (para canonical, sitemap y Open Graph).
  url: (process.env.SITE_URL || 'https://permisointernacionaldeconducir.com').replace(/\/$/, ''),
  // Subcarpeta donde se publica (ej. "/mi-repo/" en usuario.github.io/mi-repo). Con dominio propio: "/".
  basePath: (process.env.BASE_PATH || '/').replace(/\/?$/, '/'),
  // "relative": enlaces relativos con index.html explícito, para abrir el sitio sin servidor.
  linkMode: process.env.LINK_MODE || 'absolute',
  lang: 'es',
  ogLocale: 'es_LA',
  themeColor: '#4b525a',
  description:
    'Todo sobre el Permiso Internacional de Conducir (libreta internacional): qué dicen las convenciones de la ONU, si lo piden en cada país, dónde tramitarlo y road trips por el mundo.',
};

// Cantidad de países a revisar en cada actualización semanal.
export const PAISES_POR_EJECUCION = 10;
export const POSTS_POR_PAGINA = 10;

// Modelos de Gemini a probar en orden (variable GEMINI_MODEL, separados por coma).
// Todos tienen nivel gratuito en la API de Gemini.
export const MODELOS_GEMINI = (process.env.GEMINI_MODEL || 'gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash-lite')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

// Modelo de Claude, solo si se elige AI_PROVIDER=claude (variable ANTHROPIC_MODEL).
export const MODELO = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
export const WEB_SEARCH_TOOL = process.env.WEB_SEARCH_TOOL || 'web_search_20250305';

export const ESTADOS = {
  obligatorio: {
    label: 'Obligatorio',
    corto: 'Lo exigen',
    explicacion: 'Las fuentes oficiales indican que hay que llevar el permiso internacional junto con la licencia.',
  },
  recomendado: {
    label: 'Recomendado',
    corto: 'Conviene llevarlo',
    explicacion: 'No siempre es exigido por la ley, pero lo piden autoridades, rentadoras o aseguradoras en ciertos casos.',
  },
  depende: {
    label: 'Depende de tu licencia',
    corto: 'Depende',
    explicacion: 'La exigencia cambia según el país que emitió tu licencia o el tiempo de estadía.',
  },
  'no-requerido': {
    label: 'No requerido',
    corto: 'No hace falta',
    explicacion: 'Las fuentes oficiales indican que alcanza con la licencia nacional para turistas.',
  },
  'sin-verificar': {
    label: 'En verificación',
    corto: 'En verificación',
    explicacion: 'Todavía no revisamos este país en fuentes oficiales. Se actualiza automáticamente.',
  },
};
