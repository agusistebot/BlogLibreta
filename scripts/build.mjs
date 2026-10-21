// Genera el sitio estático en dist/ a partir de data/ y content/.
// Uso: npm run build   (variables opcionales: SITE_URL, BASE_PATH, LINK_MODE=relative, OUT_DIR)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import matter from 'gray-matter';
import { Marked } from 'marked';
import { SITE, DATA, POSTS_DIR, STATIC, DIST, ROOT, ESTADOS, POSTS_POR_PAGINA } from './lib/config.mjs';
import { readJSON, writeFile, copiarDir, esc, slugify, minutosLectura, hoyISO, sinAcentos } from './lib/util.mjs';
import { layout, setPagina, setVersion, u, abs } from './lib/templates.mjs';
import {
  paginaInicio, paginaPaises, paginaPais, paginaConvenciones, paginaConvencion, paginaEmpresas,
  paginaBlog, paginaPost, paginaAcerca, paginaAviso, pagina404,
} from './lib/pages.mjs';
import { generarOg, generarIcono, ogDisponible } from './lib/og.mjs';

const marked = new Marked({ gfm: true });
marked.use({
  renderer: {
    heading({ tokens, depth }) {
      const nivel = Math.min(Math.max(depth, 2), 4);
      const texto = this.parser.parseInline(tokens);
      const id = slugify(texto.replace(/<[^>]+>/g, ''));
      return `<h${nivel} id="${id}">${texto}</h${nivel}>\n`;
    },
    link({ href, title, tokens }) {
      const texto = this.parser.parseInline(tokens);
      const t = title ? ` title="${esc(title)}"` : '';
      if (href.startsWith('/')) return `<a href="${u(href)}"${t}>${texto}</a>`;
      return `<a href="${esc(href)}"${t} rel="noopener" target="_blank">${texto}</a>`;
    },
  },
});

// gray-matter convierte fechas YAML sin comillas en objetos Date.
const aISO = (v) => (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10);

function cargarPosts(paises) {
  if (!fs.existsSync(POSTS_DIR)) return [];
  const posts = [];
  for (const archivo of fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'))) {
    const { data, content } = matter(fs.readFileSync(path.join(POSTS_DIR, archivo), 'utf8'));
    if (data.borrador) continue;
    for (const campo of ['titulo', 'slug', 'fecha', 'descripcion']) {
      if (!data[campo]) throw new Error(`${archivo}: falta el campo "${campo}"`);
    }
    const fecha = aISO(data.fecha);
    const pais = paises.find((p) => p.iso2 === data.pais);
    posts.push({
      ...data,
      fecha,
      actualizado: data.actualizado ? aISO(data.actualizado) : fecha,
      cuerpo: content,
      palabras: content.split(/\s+/).filter(Boolean).length,
      minutos: minutosLectura(content),
      paisNombre: pais?.nombre,
      archivo,
    });
  }
  const slugs = new Set();
  for (const p of posts) {
    if (slugs.has(p.slug)) throw new Error(`Slug de post repetido: ${p.slug}`);
    slugs.add(p.slug);
  }
  return posts.sort((a, b) => b.fecha.localeCompare(a.fecha) || a.slug.localeCompare(b.slug));
}

function archivoDeRuta(ruta) {
  if (ruta.endsWith('.html')) return path.join(DIST, ruta);
  return path.join(DIST, ruta, 'index.html');
}

function hash(archivos) {
  const h = crypto.createHash('sha1');
  for (const a of archivos) h.update(fs.readFileSync(a));
  return h.digest('hex').slice(0, 10);
}

function rfc822(iso) {
  return new Date(`${iso}T12:00:00Z`).toUTCString();
}

async function main() {
  const t0 = Date.now();
  const paises = readJSON(path.join(DATA, 'paises.json'), []).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const empresas = readJSON(path.join(DATA, 'empresas.json'), []);
  const convenciones = readJSON(path.join(DATA, 'convenciones.json'), []).sort((a, b) => a.orden - b.orden);
  const estado = readJSON(path.join(DATA, 'estado.json'), {});
  const posts = cargarPosts(paises);
  if (!paises.length) throw new Error('data/paises.json está vacío. Ejecutá npm run seed.');

  const fechas = [...paises.map((p) => p.actualizado), ...posts.map((p) => p.actualizado)].filter(Boolean).sort();
  const ultima = estado.ultimaEjecucion?.slice(0, 10) || fechas.at(-1) || hoyISO();
  const anio = new Date().getUTCFullYear();

  fs.rmSync(DIST, { recursive: true, force: true });
  copiarDir(STATIC, DIST);
  const fuentes = path.join(DIST, 'assets/fonts');
  fs.mkdirSync(fuentes, { recursive: true });
  for (const [pkg, archivo] of [
    ['@fontsource-variable/overpass', 'overpass-latin-wght-normal.woff2'],
    ['@fontsource-variable/source-serif-4', 'source-serif-4-latin-wght-normal.woff2'],
    ['@fontsource-variable/source-serif-4', 'source-serif-4-latin-wght-italic.woff2'],
  ]) {
    fs.copyFileSync(path.join(ROOT, 'node_modules', pkg, 'files', archivo), path.join(fuentes, archivo));
  }
  fs.writeFileSync(path.join(DIST, '.nojekyll'), '');
  setVersion(hash([path.join(STATIC, 'assets/site.css'), path.join(STATIC, 'assets/site.js')]));

  const paginas = [];
  const sitemap = [];
  const emitir = (pagina, lastmod) => {
    setPagina(pagina.ruta);
    const html = layout({ ...pagina, empresas, actualizacion: ultima, seccion: seccionDe(pagina.ruta) });
    writeFile(archivoDeRuta(pagina.ruta), html);
    paginas.push(pagina);
    if (!pagina.noindex) sitemap.push({ loc: abs(pagina.ruta), lastmod });
  };

  emitir(paginaInicio({ paises, posts, convenciones }), ultima);
  emitir(paginaPaises({ paises }), fechas.at(-1));
  for (const p of paises) emitir(paginaPais(p, { paises, posts, anio }), p.actualizado);
  emitir(paginaConvenciones({ convenciones }));
  for (const c of convenciones) emitir(paginaConvencion(c, { paises }));
  emitir(paginaEmpresas({ empresas, paises }), empresas.map((e) => e.revisado).sort().at(-1));

  const totalPaginas = Math.max(1, Math.ceil(posts.length / POSTS_POR_PAGINA));
  for (let i = 1; i <= totalPaginas; i++) emitir(paginaBlog({ posts, pagina: i, totalPaginas }), posts[0]?.actualizado);
  for (const post of posts) {
    setPagina(`/blog/${post.slug}/`);
    post.html = marked.parse(post.cuerpo);
    emitir(paginaPost(post, { paises }), post.actualizado);
  }
  emitir(paginaAcerca());
  emitir(paginaAviso());
  emitir(pagina404());

  // Índice del buscador
  writeFile(
    path.join(DIST, 'assets/paises.json'),
    JSON.stringify({
      estados: Object.fromEntries(Object.entries(ESTADOS).map(([k, e]) => [k, e.label])),
      paises: paises.map((p) => ({
        n: p.nombre,
        s: p.slug,
        e: p.requisito,
        k: sinAcentos(`${p.nombre} ${p.nombreEn} ${p.iso2}`).toLowerCase(),
      })),
    })
  );

  // sitemap.xml, robots.txt y feed.xml
  writeFile(
    path.join(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap
      .map((s) => `<url><loc>${esc(s.loc)}</loc>${s.lastmod ? `<lastmod>${s.lastmod}</lastmod>` : ''}</url>`)
      .join('\n')}\n</urlset>\n`
  );
  writeFile(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${abs('/sitemap.xml')}\n`);
  writeFile(
    path.join(DIST, 'feed.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>Road trips — ${esc(SITE.name)}</title>
<link>${abs('/blog/')}</link>
<atom:link href="${abs('/feed.xml')}" rel="self" type="application/rss+xml"/>
<description>Guías de road trips en español y requisitos del permiso internacional de conducir.</description>
<language>es</language>
${posts[0] ? `<lastBuildDate>${rfc822(posts[0].actualizado)}</lastBuildDate>` : ''}
${posts
  .slice(0, 30)
  .map(
    (p) => `<item><title>${esc(p.titulo)}</title><link>${abs(`/blog/${p.slug}/`)}</link><guid isPermaLink="true">${abs(`/blog/${p.slug}/`)}</guid><pubDate>${rfc822(p.fecha)}</pubDate><description>${esc(p.descripcion)}</description></item>`
  )
  .join('\n')}
</channel>
</rss>
`
  );

  // Imágenes para redes sociales
  let ogs = 0;
  if (ogDisponible() && process.env.SIN_OG !== '1') {
    const tareas = [
      ['og/default.png', { titulo: 'Permiso Internacional de Conducir, país por país', etiqueta: 'Libreta internacional', subtitulo: 'Convenciones de la ONU, requisitos por país y road trips' }],
      ...paises.map((p) => [`og/paises/${p.slug}.png`, { titulo: `Permiso internacional en ${p.nombre}`, etiqueta: (ESTADOS[p.requisito] || ESTADOS['sin-verificar']).label, subtitulo: '¿Lo piden para manejar? Requisitos y fuentes oficiales' }]),
      ...convenciones.map((c) => [`og/convenciones-onu/${c.slug}.png`, { titulo: c.nombre, etiqueta: c.organismo, subtitulo: 'Artículos sobre el permiso internacional, resumidos' }]),
      ...posts.map((p) => [`og/blog/${p.slug}.png`, { titulo: p.titulo, etiqueta: 'Road trip', subtitulo: p.paisNombre ? `${p.paisNombre} en auto` : '', color: '#1c6a46' }]),
    ];
    for (let i = 0; i < tareas.length; i += 16) {
      await Promise.all(
        tareas.slice(i, i + 16).map(async ([rel, datos]) => {
          const destino = path.join(DIST, rel);
          fs.mkdirSync(path.dirname(destino), { recursive: true });
          if (await generarOg(destino, datos)) ogs++;
        })
      );
    }
    await generarIcono(path.join(DIST, 'apple-touch-icon.png'));
  }

  console.log(
    `Sitio generado en ${path.relative(ROOT, DIST)}/: ${paginas.length} páginas, ${posts.length} posts, ${ogs} imágenes OG (${((Date.now() - t0) / 1000).toFixed(1)} s).`
  );
}

function seccionDe(ruta) {
  for (const s of ['/paises/', '/convenciones-onu/', '/empresas/', '/blog/']) if (ruta.startsWith(s)) return s;
  return null;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
