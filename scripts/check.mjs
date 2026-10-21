// Control de calidad del build: enlaces internos, etiquetas SEO básicas y JSON-LD válido.
// Falla (exit 1) si encuentra problemas, para que no se publique un sitio roto.
import fs from 'node:fs';
import path from 'node:path';
import { DIST, SITE } from './lib/config.mjs';

const errores = [];
const avisos = [];

function htmls(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? htmls(p) : e.name.endsWith('.html') ? [p] : [];
  });
}

function resolver(desdeArchivo, href) {
  const limpio = href.split('#')[0].split('?')[0];
  if (!limpio) return null;
  let destino;
  if (limpio.startsWith('/')) {
    destino = path.join(DIST, limpio.slice(SITE.basePath.length - 1));
  } else {
    destino = path.resolve(path.dirname(desdeArchivo), limpio);
  }
  if (limpio.endsWith('/')) destino = path.join(destino, 'index.html');
  return destino;
}

if (!fs.existsSync(DIST)) {
  console.error('No existe dist/. Ejecutá npm run build primero.');
  process.exit(1);
}

const archivos = htmls(DIST);
const titulos = new Map();
for (const archivo of archivos) {
  const rel = path.relative(DIST, archivo);
  const html = fs.readFileSync(archivo, 'utf8');
  const titulo = html.match(/<title>([^<]*)<\/title>/)?.[1];
  const desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1];
  const h1 = (html.match(/<h1[\s>]/g) || []).length;
  if (!titulo) errores.push(`${rel}: sin <title>`);
  else if (titulo.length > 70) avisos.push(`${rel}: título largo (${titulo.length})`);
  if (!desc) errores.push(`${rel}: sin meta description`);
  else if (desc.length > 165) avisos.push(`${rel}: descripción larga (${desc.length})`);
  if (h1 !== 1) errores.push(`${rel}: tiene ${h1} <h1>`);
  if (!html.includes('rel="canonical"')) errores.push(`${rel}: sin canonical`);
  if (titulo && !rel.startsWith('404')) {
    if (titulos.has(titulo)) avisos.push(`${rel}: título repetido con ${titulos.get(titulo)}`);
    titulos.set(titulo, rel);
  }
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      JSON.parse(m[1]);
    } catch {
      errores.push(`${rel}: JSON-LD inválido`);
    }
  }
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const href = m[1].replace(/&amp;/g, '&');
    if (/^(https?:|mailto:|tel:|#|data:)/.test(href)) continue;
    const destino = resolver(archivo, href);
    if (destino && !fs.existsSync(destino)) errores.push(`${rel}: enlace roto ${href}`);
  }
}

const sitemap = fs.readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
for (const url of urls) {
  const ruta = url.replace(SITE.url, '');
  const destino = path.join(DIST, ruta, ruta.endsWith('/') ? 'index.html' : '');
  if (!fs.existsSync(destino)) errores.push(`sitemap: ${url} no existe`);
}

for (const a of avisos.slice(0, 20)) console.warn(`aviso: ${a}`);
if (avisos.length > 20) console.warn(`… y ${avisos.length - 20} avisos más`);
if (errores.length) {
  for (const e of errores.slice(0, 50)) console.error(`error: ${e}`);
  console.error(`${errores.length} errores en ${archivos.length} páginas.`);
  process.exit(1);
}
console.log(`OK: ${archivos.length} páginas, ${urls.length} URLs en el sitemap, sin enlaces rotos.`);
