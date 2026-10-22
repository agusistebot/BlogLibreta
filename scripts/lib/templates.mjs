// Plantillas HTML compartidas: <head> con SEO, cabecera, columna de empresas y pie.
import { SITE, ESTADOS } from './config.mjs';
import { esc, fechaLarga } from './util.mjs';

let paginaActual = '/';
let versionAssets = '1';

export function setPagina(ruta) {
  paginaActual = ruta;
}
export function setVersion(v) {
  versionAssets = v;
}

// Enlace interno según el modo de publicación.
export function u(destino) {
  if (/^(https?:|mailto:|tel:|#|data:)/.test(destino)) return destino;
  const [ruta, hash] = destino.split('#');
  const sufijoHash = hash ? `#${hash}` : '';
  if (SITE.linkMode === 'relative') {
    const desde = paginaActual.split('/').filter(Boolean);
    if (!paginaActual.endsWith('/')) desde.pop();
    const hacia = ruta.split('/').filter(Boolean);
    let i = 0;
    while (i < desde.length && i < hacia.length && desde[i] === hacia[i]) i++;
    let rel = '../'.repeat(desde.length - i) + hacia.slice(i).join('/');
    if (ruta.endsWith('/')) rel += (rel && !rel.endsWith('/') ? '/' : '') + 'index.html';
    return (rel || 'index.html') + sufijoHash;
  }
  return SITE.basePath + ruta.replace(/^\//, '') + sufijoHash;
}

export function raiz() {
  if (SITE.linkMode !== 'relative') return SITE.basePath;
  const desde = paginaActual.split('/').filter(Boolean);
  if (!paginaActual.endsWith('/')) desde.pop();
  return '../'.repeat(desde.length) || './';
}

export function abs(ruta) {
  return SITE.url + (ruta.startsWith('/') ? ruta : `/${ruta}`);
}

export function ld(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
}

export const ORG_ID = `${SITE.url}/#organizacion`;
export const WEB_ID = `${SITE.url}/#sitio`;

export function ldOrganizacion() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE.name,
    url: `${SITE.url}/`,
    logo: { '@type': 'ImageObject', url: `${SITE.url}/apple-touch-icon.png`, width: 180, height: 180 },
  };
}

export function ldSitio() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEB_ID,
    url: `${SITE.url}/`,
    name: SITE.name,
    inLanguage: 'es',
    publisher: { '@id': ORG_ID },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE.url}/paises/?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function ldMigas(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([nombre, ruta], i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: nombre,
      item: abs(ruta),
    })),
  };
}

export function ldFaq(faq) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.pregunta,
      acceptedAnswer: { '@type': 'Answer', text: f.respuesta },
    })),
  };
}

export function migas(items) {
  return `<nav class="crumbs" aria-label="Ruta de navegación"><ol>${items
    .map(([nombre, ruta], i) =>
      i === items.length - 1
        ? `<li aria-current="page">${esc(nombre)}</li>`
        : `<li><a href="${u(ruta)}">${esc(nombre)}</a></li>`
    )
    .join('')}</ol></nav>`;
}

export function icono(estado, clase = 'ico') {
  return `<svg class="${clase}" aria-hidden="true" focusable="false"><use href="#s-${esc(estado)}"></use></svg>`;
}

export function estadoBadge(estado, texto) {
  const e = ESTADOS[estado] || ESTADOS['sin-verificar'];
  return `<span class="status">${icono(ESTADOS[estado] ? estado : 'sin-verificar')}${esc(texto || e.label)}</span>`;
}

export function faqHtml(faq) {
  return `<div class="faq">${faq
    .map((f) => `<details><summary>${esc(f.pregunta)}</summary><p>${esc(f.respuesta)}</p></details>`)
    .join('')}</div>`;
}

const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
<symbol id="s-obligatorio" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#1f4fa0"/><rect x="7.6" y="5.8" width="8.8" height="12.4" rx="1.3" fill="none" stroke="#fff" stroke-width="1.9"/><path d="M10 9.8h4M10 12.6h4M10 15.2h2.4" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></symbol>
<symbol id="s-recomendado" viewBox="0 0 24 24"><path d="M12 2.4 22.8 21H1.2z" fill="#fff" stroke="#c21f2e" stroke-width="2.4" stroke-linejoin="round"/><path d="M12 9.2v5.2" stroke="#111" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.3" fill="#111"/></symbol>
<symbol id="s-depende" viewBox="0 0 24 24"><path d="M12 .9 23.1 12 12 23.1.9 12z" fill="#fff" stroke="#3a4148" stroke-width="1"/><path d="M12 4.6 19.4 12 12 19.4 4.6 12z" fill="#f2b600"/></symbol>
<symbol id="s-no-requerido" viewBox="0 0 24 24"><rect x="1" y="1" width="22" height="22" rx="4" fill="#1c6a46"/><path d="m6.6 12.4 3.6 3.6 7.3-7.9" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="s-sin-verificar" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.4" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3.2 2.4"/><circle cx="7.9" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="16.1" cy="12" r="1.4" fill="currentColor"/></symbol>
<symbol id="i-chat" viewBox="0 0 24 24"><path d="M4 4.5h16a1.5 1.5 0 0 1 1.5 1.5v9.5A1.5 1.5 0 0 1 20 17H10l-5 4v-4H4a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 4 4.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></symbol>
<symbol id="i-mail" viewBox="0 0 24 24"><rect x="2.5" y="5" width="19" height="14" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5" fill="none" stroke="currentColor" stroke-width="1.8"/></symbol>
<symbol id="i-tel" viewBox="0 0 24 24"><path d="M6.6 3.5h3l1.5 4.2-2 1.4a11 11 0 0 0 5.8 5.8l1.4-2 4.2 1.5v3A2 2 0 0 1 18.4 20 15.4 15.4 0 0 1 4 5.6a2 2 0 0 1 2.6-2.1z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></symbol>
<symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 10.6v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="7.4" r="1.25" fill="currentColor"/></symbol>
<symbol id="i-doc" viewBox="0 0 24 24"><path d="M6 2.8h8.2L19 7.6v12.1a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.7V4.3A1.5 1.5 0 0 1 6.5 2.8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m8.6 14.2 2.3 2.3 4.6-4.9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-cal" viewBox="0 0 24 24"><rect x="3.2" y="4.6" width="17.6" height="16" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3.2 9.4h17.6M8 2.8v3.6M16 2.8v3.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="m9 14.6 2 2 4-4.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
</svg>`;

const ICONO_CONTACTO = { whatsapp: 'i-chat', email: 'i-mail', telefono: 'i-tel' };
const ETIQUETA_CONTACTO = { whatsapp: 'WhatsApp', email: 'Correo', telefono: 'Teléfono' };

// Los correos se cortan en la arroba y no en el guion.
function valorContacto(c) {
  if (c.tipo !== 'email' || !c.valor.includes('@')) return esc(c.valor);
  const [usuario, dominio] = c.valor.split('@');
  return `<span class="nw">${esc(usuario)}</span><wbr>@${esc(dominio)}`;
}

export function columnaEmpresas(empresas) {
  const items = empresas
    .map((e) => {
      const grupos = new Map();
      for (const c of e.contactos) grupos.set(c.pais, [...(grupos.get(c.pais) || []), c]);
      const contactos = [...grupos.entries()]
        .map(
          ([pais, lista]) =>
            `${grupos.size > 1 ? `<p class="c-pais">${esc(pais)}</p>` : ''}<ul class="contactos">${lista
              .map(
                (c) =>
                  `<li><svg class="ico" aria-hidden="true"><use href="#${ICONO_CONTACTO[c.tipo]}"></use></svg><a href="${esc(c.href)}"${c.tipo === 'whatsapp' ? ' rel="noopener" target="_blank"' : ''} aria-label="${esc(`${ETIQUETA_CONTACTO[c.tipo]} de ${e.nombre}${grupos.size > 1 ? ` en ${pais}` : ''}: ${c.valor}`)}">${valorContacto(c)}</a></li>`
              )
              .join('')}</ul>`
        )
        .join('');
      const aviso = e.limitacion
        ? `<p class="aviso">${icono('recomendado')}<span>${esc(e.limitacion)}</span></p>`
        : '';
      return `<section class="empresa${e.destacada ? ' destacada' : ''}" aria-labelledby="emp-${e.id}">
<h3 id="emp-${e.id}"><a href="${esc(e.web)}" rel="noopener">${esc(e.nombre)}</a>${e.destacada ? '<span class="tag">Destacado</span>' : ''}</h3>
<a class="web" href="${esc(e.web)}" rel="noopener">${esc(e.webTexto)}</a>
<p class="estado">${esc(e.estado)}</p>
<p>${esc(e.modalidad)}</p>
${e.horario ? `<p class="muted">${esc(e.horario)}</p>` : ''}
${contactos}
${aviso}
</section>`;
    })
    .join('\n');
  return `<div class="empresas"><div class="empresas-box">
<h2>Dónde tramitar la libreta internacional</h2>
<p class="intro">Empresas y entidades que la gestionan en Uruguay y Argentina.</p>
${items}
<p class="pie">Modalidad y contactos según el sitio de cada entidad. <a href="${u('/empresas/')}">Ver emisores en otros países</a>.</p>
</div></div>`;
}

const NAV = [
  ['/paises/', 'Países'],
  ['/convenciones-onu/', 'Convenciones ONU'],
  ['/empresas/', 'Dónde tramitarla'],
  ['/blog/', 'Road trips'],
];

function tituloCompleto(titulo) {
  const sufijo = ' | Permiso Internacional';
  if (!titulo) return SITE.name;
  return titulo.length + sufijo.length <= 65 && !titulo.includes('Permiso Internacional') ? titulo + sufijo : titulo;
}

export function layout({
  ruta,
  titulo,
  descripcion,
  contenido,
  empresas,
  jsonld = [],
  og = '/og/default.png',
  ogTipo = 'website',
  noindex = false,
  seccion,
  publicado,
  modificado,
  actualizacion,
}) {
  setPagina(ruta);
  const canonical = abs(ruta);
  const t = tituloCompleto(titulo);
  const robots = noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';
  const nav = NAV.map(
    ([href, label]) => `<a href="${u(href)}"${seccion === href ? ' aria-current="page"' : ''}>${label}</a>`
  ).join('');
  const meta = [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${esc(t)}</title>`,
    `<meta name="description" content="${esc(descripcion)}">`,
    `<meta name="robots" content="${robots}">`,
    `<link rel="canonical" href="${esc(canonical)}">`,
    `<link rel="alternate" hreflang="es" href="${esc(canonical)}">`,
    `<link rel="alternate" hreflang="x-default" href="${esc(canonical)}">`,
    `<meta property="og:site_name" content="${esc(SITE.name)}">`,
    `<meta property="og:locale" content="${SITE.ogLocale}">`,
    `<meta property="og:type" content="${ogTipo}">`,
    `<meta property="og:title" content="${esc(titulo || SITE.name)}">`,
    `<meta property="og:description" content="${esc(descripcion)}">`,
    `<meta property="og:url" content="${esc(canonical)}">`,
    `<meta property="og:image" content="${esc(abs(og))}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(titulo || SITE.name)}">`,
    `<meta name="twitter:description" content="${esc(descripcion)}">`,
    `<meta name="twitter:image" content="${esc(abs(og))}">`,
    publicado ? `<meta property="article:published_time" content="${publicado}">` : '',
    modificado ? `<meta property="article:modified_time" content="${modificado}">` : '',
    `<meta name="theme-color" content="${SITE.themeColor}">`,
    `<meta name="format-detection" content="telephone=no">`,
    `<link rel="icon" href="${u('/favicon.svg')}" type="image/svg+xml">`,
    `<link rel="apple-touch-icon" href="${u('/apple-touch-icon.png')}">`,
    `<link rel="preload" href="${u('/assets/fonts/figtree-latin-wght-normal.woff2')}" as="font" type="font/woff2" crossorigin>`,
    `<link rel="preload" href="${u('/assets/fonts/public-sans-latin-wght-normal.woff2')}" as="font" type="font/woff2" crossorigin>`,
    `<link rel="stylesheet" href="${u('/assets/site.css')}?v=${versionAssets}">`,
    `<link rel="alternate" type="application/rss+xml" title="Road trips — ${esc(SITE.name)}" href="${abs('/feed.xml')}">`,
    ...jsonld.map(ld),
  ]
    .filter(Boolean)
    .join('\n');

  return `<!doctype html>
<html lang="es">
<head>
${meta}
</head>
<body data-root="${raiz()}" data-suffix="${SITE.linkMode === 'relative' ? 'index.html' : ''}">
<a class="skip" href="#contenido">Saltar al contenido</a>
${SPRITE}
<div class="topbar">
<div class="wrap topbar-inner">
<p><svg class="ico" aria-hidden="true" focusable="false"><use href="#i-info"></use></svg>Guía informativa independiente sobre el Permiso Internacional de Conducir</p>
</div>
</div>
<header class="masthead">
<div class="wrap masthead-inner">
<a class="brand" href="${u('/')}" aria-label="${esc(SITE.name)}, inicio"><img class="brand-emblem" src="${u('/assets/emblema.svg')}" alt="" width="74" height="60"><span class="brand-name"><span class="brand-l1">Permiso Internacional</span> <span class="brand-l2">de Conducir</span><span class="brand-sub">La libreta internacional, país por país</span></span></a>
<ul class="masthead-meta">
<li><svg class="ico" aria-hidden="true" focusable="false"><use href="#i-doc"></use></svg>Fuentes oficiales citadas</li>
<li><svg class="ico" aria-hidden="true" focusable="false"><use href="#i-cal"></use></svg>Fichas revisadas cada semana</li>
</ul>
</div>
<nav class="nav" aria-label="Secciones"><div class="wrap nav-inner">${nav}</div></nav>
</header>
<div class="layout">
<main id="contenido">
${contenido}
</main>
<aside aria-label="Dónde tramitar la libreta internacional">
${columnaEmpresas(empresas)}
</aside>
</div>
<footer class="contratapa">
<div class="wrap contratapa-inner">
<div class="contratapa-marca">
<img class="footer-emblem" src="${u('/assets/emblema.svg')}" alt="" width="62" height="50" loading="lazy" decoding="async">
<h2>Permiso Internacional de Conducir</h2>
<p>Guía independiente sobre la libreta internacional de conducir. No pertenece a la ONU, a ningún gobierno ni a los automóvil clubes mencionados.</p>
<p>Las fichas de países se revisan automáticamente cada semana con fuentes citadas.${actualizacion ? ` Última actualización: ${fechaLarga(actualizacion)}.` : ''}</p>
</div>
<div>
<h2>Secciones</h2>
<ul>
<li><a href="${u('/paises/')}">Requisitos por país</a></li>
<li><a href="${u('/empresas/')}">Dónde tramitar la libreta</a></li>
<li><a href="${u('/blog/')}">Road trips</a></li>
<li><a href="${abs('/feed.xml')}">RSS del blog</a></li>
</ul>
</div>
<div>
<h2>Convenciones</h2>
<ul>
<li><a href="${u('/convenciones-onu/ginebra-1949/')}">Ginebra 1949</a></li>
<li><a href="${u('/convenciones-onu/viena-1968/')}">Viena 1968</a></li>
<li><a href="${u('/convenciones-onu/washington-1943/')}">Washington 1943</a></li>
<li><a href="${u('/convenciones-onu/paris-1926/')}">París 1926</a></li>
</ul>
</div>
<div>
<h2>Sobre el sitio</h2>
<ul>
<li><a href="${u('/acerca/')}">Cómo hacemos las fichas</a></li>
<li><a href="${u('/aviso-legal/')}">Aviso legal y privacidad</a></li>
</ul>
</div>
</div>
<div class="contratapa-base">
<div class="wrap">
<p>© ${new Date().getUTCFullYear()} ${esc(SITE.domain)}</p>
<p>Información de carácter general. Antes de viajar, confirmá los requisitos con la autoridad de tránsito o el consulado del país de destino.</p>
</div>
</div>
</footer>
<script src="${u('/assets/site.js')}?v=${versionAssets}" defer></script>
</body>
</html>
`;
}
