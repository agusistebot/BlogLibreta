// Contenido de cada tipo de página. Devuelven el HTML de <main> y los datos SEO.
import { SITE, ESTADOS, POSTS_POR_PAGINA } from './config.mjs';
import { esc, fechaLarga, recortar, hostname, sinAcentos } from './util.mjs';
import {
  u, abs, migas, ldMigas, ldFaq, ldOrganizacion, ldSitio, estadoBadge, icono, faqHtml, ORG_ID, WEB_ID,
} from './templates.mjs';

const MODELO_TEXTO = {
  '1949': 'Modelo de Ginebra 1949 (vale 1 año)',
  '1968': 'Modelo de Viena 1968 (hasta 3 años)',
  ambas: 'Modelos de Ginebra 1949 y Viena 1968',
  ninguna: 'No es parte de Ginebra ni de Viena',
  desconocido: 'Sin confirmar',
};

const ORDEN_REGIONES = ['América del Sur', 'América Central y Caribe', 'América del Norte', 'Europa', 'Asia', 'Medio Oriente', 'África', 'Oceanía'];

function siNo(valor, conv) {
  return valor
    ? `<span class="check"><span class="yes">Sí</span> <a href="${u(`/convenciones-onu/${conv}/`)}">ver convención</a></span>`
    : '<span class="no">No es parte</span>';
}

function listaFuentes(fuentes) {
  return `<ol class="fuentes">${fuentes
    .map(
      (f) =>
        `<li><a href="${esc(f.url)}" rel="noopener" target="_blank">${esc(f.titulo)}</a> <span class="host">(${esc(hostname(f.url))}${f.consultado ? `, consultado el ${fechaLarga(f.consultado)}` : ''})</span></li>`
    )
    .join('')}</ol>`;
}

function claveBusqueda(p) {
  return sinAcentos(`${p.nombre} ${p.nombreEn} ${p.iso2}`).toLowerCase();
}

function conveniosTexto(p) {
  const c = [];
  if (p.convenios.ginebra1949) c.push('Ginebra 1949');
  if (p.convenios.viena1968) c.push('Viena 1968');
  return c.length ? c.join(' y ') : 'Ninguna';
}

function listaPosts(posts) {
  return `<ul class="posts">${posts
    .map(
      (p) => `<li><h3><a href="${u(`/blog/${p.slug}/`)}">${esc(p.titulo)}</a></h3>
<p class="meta"><time datetime="${p.fecha}">${fechaLarga(p.fecha)}</time>, ${p.minutos} min de lectura${p.paisNombre ? `, ${esc(p.paisNombre)}` : ''}</p>
<p>${esc(p.resumen || p.descripcion)}</p></li>`
    )
    .join('')}</ul>`;
}

// ---------------------------------------------------------------- Inicio
export function paginaInicio({ paises, posts, convenciones }) {
  const destacados = [...paises]
    .filter((p) => !['AR', 'UY'].includes(p.iso2))
    .sort((a, b) => b.prioridad - a.prioridad)
    .slice(0, 8);
  const recientes = [...paises]
    .filter((p) => p.actualizado)
    .sort((a, b) => String(b.actualizado).localeCompare(String(a.actualizado)))
    .slice(0, 12);
  const faq = [
    {
      pregunta: '¿Qué es el Permiso Internacional de Conducir?',
      respuesta:
        'Es una libreta que traduce tu licencia de conducir a varios idiomas con un formato definido por las convenciones de la ONU de Ginebra (1949) y Viena (1968). Sirve para que autoridades, rentadoras y aseguradoras de otros países entiendan tu licencia.',
    },
    {
      pregunta: '¿La libreta internacional reemplaza a la licencia nacional?',
      respuesta:
        'No. El permiso internacional no tiene validez por sí solo: siempre se presenta junto con la licencia nacional vigente que le dio origen.',
    },
    {
      pregunta: '¿Cuánto dura el permiso internacional?',
      respuesta:
        'El modelo de la Convención de Ginebra de 1949 vale un año desde su emisión. El modelo de la Convención de Viena de 1968 puede valer hasta tres años. En ningún caso supera el vencimiento de la licencia nacional.',
    },
    {
      pregunta: '¿Necesito el permiso internacional para manejar en el Mercosur?',
      respuesta:
        'Entre los países del Mercosur la licencia nacional mantiene su validez, por lo que no hace falta tramitar el permiso internacional para manejar como turista.',
    },
    {
      pregunta: '¿Dónde se tramita la libreta internacional en Uruguay y Argentina?',
      respuesta:
        'Se tramita antes de viajar, en el país que emitió tu licencia. En la sección Dónde tramitarla están las empresas y entidades que la gestionan en Uruguay y Argentina, con su modalidad y datos de contacto.',
    },
  ];

  const contenido = `
<section class="sign" aria-labelledby="h-inicio">
<h1 id="h-inicio">Permiso Internacional de Conducir, país por país</h1>
<p>Buscá tu destino y mirá si piden la libreta internacional, qué convención de la ONU aplica y qué dicen las fuentes oficiales.</p>
<form class="search" action="${u('/paises/')}" method="get" role="search" data-search>
<label for="q-inicio">¿A qué país viajás?</label>
<div class="search-row">
<input id="q-inicio" name="q" type="search" autocomplete="off" placeholder="Ej.: España, Japón, Estados Unidos" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="res-inicio">
<button type="submit">Buscar</button>
</div>
<ul class="results" id="res-inicio" role="listbox" hidden></ul>
</form>
<ul class="destinos" aria-label="Destinos frecuentes">
${destacados
  .map(
    (p) =>
      `<li><a href="${u(`/paises/${p.slug}/`)}">${icono(p.requisito)}<span class="d-name">${esc(p.nombre)}</span><span class="d-status">${esc((ESTADOS[p.requisito] || ESTADOS['sin-verificar']).corto)}</span></a></li>`
  )
  .join('\n')}
</ul>
</section>

<section class="seccion prose" aria-labelledby="h-que-es">
<h2 id="h-que-es">Qué es la libreta internacional de conducir</h2>
<p>El Permiso Internacional de Conducir —en Uruguay y Argentina le decimos libreta internacional— es un cuadernillo que traduce los datos de tu licencia a varios idiomas con un formato que fijaron las Naciones Unidas. No reemplaza a la licencia: se lleva siempre junto con ella.</p>
<p>Las reglas salen de dos tratados. La <a href="${u('/convenciones-onu/ginebra-1949/')}">Convención de Ginebra de 1949</a> define la libreta que vale un año y es la que reconocen Estados Unidos, Japón, Argentina o Chile. La <a href="${u('/convenciones-onu/viena-1968/')}">Convención de Viena de 1968</a> define un modelo que puede valer hasta tres años y es la que rige, entre otros, en Uruguay, Brasil y buena parte de Europa. En ambos casos el permiso lo emite el país que emitió tu licencia.</p>
<p>Si un país lo exige o no depende de su propia ley y de dónde viene tu licencia. Por eso cada <a href="${u('/paises/')}">ficha de país</a> resume lo que dicen las fuentes oficiales y las enlaza.</p>
</section>

<section class="seccion" aria-labelledby="h-leer">
<h2 id="h-leer">Cómo leer las fichas</h2>
<dl class="leyenda">
${Object.entries(ESTADOS)
  .map(([k, e]) => `<dt>${estadoBadge(k)}</dt><dd>${esc(e.explicacion)}</dd>`)
  .join('\n')}
</dl>
</section>

${
  posts.length
    ? `<section class="seccion" aria-labelledby="h-blog">
<h2 id="h-blog">Últimos road trips</h2>
${listaPosts(posts.slice(0, 3))}
<p class="pager"><a href="${u('/blog/')}">Todos los road trips</a></p>
</section>`
    : ''
}

${
  recientes.length
    ? `<section class="seccion" aria-labelledby="h-recientes">
<h2 id="h-recientes">Fichas revisadas hace poco</h2>
<p class="muted">Cada semana se revisan 10 países más; cuando se completa la lista, se vuelve a empezar por los que llevan más tiempo sin revisar.</p>
<ul class="chips">${recientes.map((p) => `<li><a href="${u(`/paises/${p.slug}/`)}">${icono(p.requisito)}${esc(p.nombre)}</a></li>`).join('')}</ul>
</section>`
    : ''
}

<section class="seccion" aria-labelledby="h-conv">
<h2 id="h-conv">Convenciones que regulan el permiso</h2>
<ul class="convs">
${convenciones
  .map(
    (c) => `<li><h3><a href="${u(`/convenciones-onu/${c.slug}/`)}">${esc(c.nombre)}</a></h3>
<p class="meta">${esc(c.organismo)}. Permiso válido: ${esc(c.validezPIC)}.</p></li>`
  )
  .join('\n')}
</ul>
</section>

<section class="seccion" aria-labelledby="h-faq">
<h2 id="h-faq">Preguntas frecuentes</h2>
${faqHtml(faq)}
</section>`;

  return {
    ruta: '/',
    titulo: 'Permiso Internacional de Conducir: requisitos por país',
    descripcion:
      'Libreta internacional de conducir: qué dicen las convenciones de la ONU, en qué países la piden, dónde tramitarla en Uruguay y Argentina y road trips por el mundo.',
    contenido,
    jsonld: [ldOrganizacion(), ldSitio(), ldFaq(faq)],
  };
}

// ---------------------------------------------------------------- Listado de países
export function paginaPaises({ paises }) {
  const regiones = ORDEN_REGIONES.filter((r) => paises.some((p) => p.region === r));
  const verificados = paises.filter((p) => p.verificado).length;
  const filas = paises
    .map((p) => {
      const conv = [p.convenios.ginebra1949 && '1949', p.convenios.viena1968 && '1968'].filter(Boolean);
      return `<tr data-k="${esc(claveBusqueda(p))}" data-r="${esc(p.region)}" data-e="${p.requisito}" data-c="${conv.join(' ') || 'ninguna'}">
<td><a href="${u(`/paises/${p.slug}/`)}">${esc(p.nombre)}</a></td>
<td>${estadoBadge(p.requisito)}</td>
<td class="conv">${esc(conveniosTexto(p))}</td>
<td class="conv">${p.actualizado ? `<time datetime="${p.actualizado}">${fechaLarga(p.actualizado)}</time>` : 'Pendiente'}</td>
</tr>`;
    })
    .join('\n');

  const contenido = `
${migas([['Inicio', '/'], ['Países', '/paises/']])}
<h1>¿En qué países piden el permiso internacional de conducir?</h1>
<p class="lead">Los ${paises.length} países con su situación frente a la libreta internacional, las convenciones de la ONU que firmaron y la fecha de la última revisión. ${verificados} fichas ya están verificadas con fuentes oficiales y cada semana se suman 10 más.</p>

<form class="filtros" role="search" onsubmit="return false">
<label for="f-q">Buscar país<input id="f-q" name="q" type="search" placeholder="Nombre del país" autocomplete="off"></label>
<label for="f-region">Región<select id="f-region"><option value="">Todas</option>${regiones.map((r) => `<option>${esc(r)}</option>`).join('')}</select></label>
<label for="f-estado">¿Lo piden?<select id="f-estado"><option value="">Cualquier respuesta</option>${Object.entries(ESTADOS).map(([k, e]) => `<option value="${k}">${esc(e.label)}</option>`).join('')}</select></label>
<label for="f-conv">Convención<select id="f-conv"><option value="">Cualquiera</option><option value="1949">Ginebra 1949</option><option value="1968">Viena 1968</option><option value="ninguna">Ninguna</option></select></label>
</form>
<p class="contador" id="f-count" aria-live="polite">${paises.length} países</p>
<div class="tabla-wrap">
<table class="paises" data-tabla-paises>
<caption class="muted small" style="text-align:left;padding:10px 14px">Situación de la libreta internacional por país</caption>
<thead><tr><th scope="col">País</th><th scope="col">¿Piden el permiso?</th><th scope="col">Convenciones ONU</th><th scope="col">Última revisión</th></tr></thead>
<tbody>
${filas}
</tbody>
</table>
</div>
<p class="nota" style="margin-top:20px">Las fichas en verificación muestran por ahora la situación de cada país frente a las convenciones de la ONU según la Colección de Tratados de las Naciones Unidas. La revisión semanal agrega los requisitos para turistas, la autoridad de tránsito y quién emite el permiso, siempre con la fuente citada.</p>`;

  return {
    ruta: '/paises/',
    titulo: 'En qué países piden el permiso internacional de conducir',
    descripcion: `Lista de ${paises.length} países con la situación de la libreta internacional: si la exigen, qué convención de la ONU aplica (Ginebra 1949 o Viena 1968) y fuentes oficiales.`,
    contenido,
    jsonld: [
      ldMigas([['Inicio', '/'], ['Países', '/paises/']]),
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Permiso internacional de conducir por país',
        url: abs('/paises/'),
        isPartOf: { '@id': WEB_ID },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: paises.length,
          itemListElement: paises.map((p, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: p.nombre,
            url: abs(`/paises/${p.slug}/`),
          })),
        },
      },
    ],
  };
}

// ---------------------------------------------------------------- Ficha de país
export function paginaPais(p, { paises, posts, anio }) {
  const e = ESTADOS[p.requisito] || ESTADOS['sin-verificar'];
  const verificado = p.requisito !== 'sin-verificar';
  const pregunta = `¿Piden la libreta internacional para manejar en ${p.nombre}?`;
  const propios = posts.filter((x) => x.pais === p.iso2);
  const vecinos = paises
    .filter((x) => x.region === p.region && x.iso2 !== p.iso2)
    .sort((a, b) => b.prioridad - a.prioridad || a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, 12);
  const esLocal = ['AR', 'UY'].includes(p.iso2);

  const faq = [
    { pregunta, respuesta: `${e.label}. ${p.resumen}` },
    {
      pregunta: `¿Qué convención de la ONU aplica en ${p.nombre}?`,
      respuesta:
        p.convenios.ginebra1949 || p.convenios.viena1968
          ? `${p.nombre} es parte de ${conveniosTexto(p) === 'Ginebra 1949 y Viena 1968' ? 'las convenciones de Ginebra (1949) y de Viena (1968)' : p.convenios.ginebra1949 ? 'la Convención de Ginebra de 1949' : 'la Convención de Viena de 1968'} sobre circulación vial.`
          : `${p.nombre} no figura como parte de las convenciones de Ginebra (1949) ni de Viena (1968); las reglas para conductores extranjeros dependen de su legislación.`,
    },
  ];
  if (p.emisorPIC?.nombre) {
    faq.push({
      pregunta: `¿Quién emite el permiso internacional en ${p.nombre}?`,
      respuesta: `A quienes tienen licencia de ${p.nombre}, el permiso internacional lo emite ${p.emisorPIC.nombre}.`,
    });
  }
  faq.push({
    pregunta: '¿Dónde tramito la libreta si mi licencia es de Uruguay o Argentina?',
    respuesta:
      'Se tramita antes de viajar, en el país que emitió tu licencia. Las empresas y entidades que la gestionan en Uruguay y Argentina, con su modalidad y contactos, están en la sección Dónde tramitarla.',
  });

  const contenido = `
${migas([['Inicio', '/'], ['Países', '/paises/'], [p.nombre, `/paises/${p.slug}/`]])}
<h1>Permiso internacional de conducir en ${esc(p.nombre)}</h1>
<p class="lead">${esc(pregunta)}</p>

<div class="status-card">
${icono(p.requisito, 'ico ico-lg')}
<div>
<p class="status-label">${esc(e.label)}</p>
<p>${esc(p.resumen)}</p>
<p class="muted small" style="margin-top:8px">${verificado && p.actualizado ? `Revisado el <time datetime="${p.actualizado}">${fechaLarga(p.actualizado)}</time> con las fuentes citadas abajo.` : 'Ficha en verificación: se completa automáticamente en las próximas revisiones semanales.'}</p>
</div>
</div>

${
  p.detalles?.length
    ? `<section class="prose"><h2>Lo que hay que saber</h2><ul>${p.detalles.map((d) => `<li>${esc(d)}</li>`).join('')}</ul></section>`
    : ''
}

<section>
<h2>Convenciones de la ONU</h2>
<div class="ficha-grid">
<div class="dato"><h3>Ginebra 1949</h3><p>${siNo(p.convenios.ginebra1949, 'ginebra-1949')}</p></div>
<div class="dato"><h3>Viena 1968</h3><p>${siNo(p.convenios.viena1968, 'viena-1968')}</p></div>
<div class="dato"><h3>Modelo de permiso de referencia</h3><p>${esc(MODELO_TEXTO[p.convencionAceptada] || MODELO_TEXTO.desconocido)}</p></div>
${p.estadiaMaxima ? `<div class="dato"><h3>Estadía con licencia extranjera</h3><p>${esc(p.estadiaMaxima)}</p></div>` : ''}
</div>
</section>

${
  p.autoridadTransito || p.emisorPIC
    ? `<section>
<h2>Autoridades en ${esc(p.nombre)}</h2>
<div class="ficha-grid">
${p.autoridadTransito ? `<div class="dato"><h3>Autoridad de tránsito</h3><p>${p.autoridadTransito.url ? `<a href="${esc(p.autoridadTransito.url)}" rel="noopener" target="_blank">${esc(p.autoridadTransito.nombre)}</a>` : esc(p.autoridadTransito.nombre)}</p></div>` : ''}
${p.emisorPIC ? `<div class="dato"><h3>Emite el permiso a residentes</h3><p>${p.emisorPIC.url ? `<a href="${esc(p.emisorPIC.url)}" rel="noopener" target="_blank">${esc(p.emisorPIC.nombre)}</a>` : esc(p.emisorPIC.nombre)}${p.emisorPIC.telefono ? `<br><span class="muted">Tel. ${esc(p.emisorPIC.telefono)}</span>` : ''}</p></div>` : ''}
</div>
</section>`
    : ''
}

<div class="cta">
<h2>${esLocal ? `¿Vivís en ${esc(p.nombre)} y viajás al exterior?` : `¿Viajás a ${esc(p.nombre)} con licencia de Uruguay o Argentina?`}</h2>
<p>La libreta internacional se tramita antes de salir, en el país que emitió tu licencia.</p>
<p><a href="${u('/empresas/')}">Ver dónde tramitarla</a></p>
</div>

${
  propios.length
    ? `<section><h2>Road trips en ${esc(p.nombre)}</h2>${listaPosts(propios)}</section>`
    : ''
}

<section>
<h2>Preguntas frecuentes</h2>
${faqHtml(faq)}
</section>

<section>
<h2>Fuentes</h2>
${listaFuentes(p.fuentes || [])}
<p class="nota">Esta ficha resume información pública y no reemplaza la consulta a la autoridad de tránsito, la embajada o el consulado de ${esc(p.nombre)}. Las reglas cambian: confirmá antes de viajar.</p>
</section>

${
  vecinos.length
    ? `<section><h2>Otros países de ${esc(p.region)}</h2><ul class="chips">${vecinos
        .map((v) => `<li><a href="${u(`/paises/${v.slug}/`)}">${icono(v.requisito)}${esc(v.nombre)}</a></li>`)
        .join('')}</ul></section>`
    : ''
}`;

  const largo = `Permiso internacional para manejar en ${p.nombre} (${anio})`;
  const titulo = largo.length <= 62 ? largo : `Permiso internacional en ${p.nombre} (${anio})`;
  return {
    ruta: `/paises/${p.slug}/`,
    titulo,
    descripcion: recortar(`${pregunta} ${e.label}: ${p.resumen}`, 158),
    contenido,
    og: `/og/paises/${p.slug}.png`,
    modificado: p.actualizado || undefined,
    jsonld: [
      ldMigas([['Inicio', '/'], ['Países', '/paises/'], [p.nombre, `/paises/${p.slug}/`]]),
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: titulo,
        url: abs(`/paises/${p.slug}/`),
        inLanguage: 'es',
        isPartOf: { '@id': WEB_ID },
        about: { '@type': 'Country', name: p.nombre, identifier: p.iso2 },
        ...(p.actualizado ? { dateModified: p.actualizado } : {}),
        citation: (p.fuentes || []).map((f) => ({ '@type': 'CreativeWork', name: f.titulo, url: f.url })),
      },
      ldFaq(faq),
    ],
  };
}

// ---------------------------------------------------------------- Convenciones
export function paginaConvenciones({ convenciones }) {
  const g = convenciones.find((c) => c.slug === 'ginebra-1949');
  const v = convenciones.find((c) => c.slug === 'viena-1968');
  const contenido = `
${migas([['Inicio', '/'], ['Convenciones ONU', '/convenciones-onu/']])}
<h1>Convenciones de la ONU sobre el Permiso Internacional de Conducir</h1>
<p class="lead">Dos tratados de las Naciones Unidas definen qué es la libreta internacional, quién la emite, cuánto dura y cuándo pueden exigirla. Acá están resumidos artículo por artículo, con enlace a los textos oficiales.</p>

<div class="prose">
<table>
<caption class="muted small" style="text-align:left">Ginebra 1949 y Viena 1968 frente a frente</caption>
<thead><tr><th scope="col"></th><th scope="col">Ginebra 1949</th><th scope="col">Viena 1968</th></tr></thead>
<tbody>
<tr><th scope="row">Firma</th><td>${fechaLarga(g.fecha)}</td><td>${fechaLarga(v.fecha)}</td></tr>
<tr><th scope="row">En vigor desde</th><td>${fechaLarga(g.vigencia)}</td><td>${fechaLarga(v.vigencia)}</td></tr>
<tr><th scope="row">Estados parte</th><td>${esc(g.partes)}</td><td>${esc(v.partes)}</td></tr>
<tr><th scope="row">Validez del permiso</th><td>${esc(g.validezPIC)}</td><td>${esc(v.validezPIC)}</td></tr>
<tr><th scope="row">Artículo clave</th><td>Artículo 24</td><td>Artículo 41</td></tr>
<tr><th scope="row">Modelo de libreta</th><td>Anexo 10</td><td>Anexo 7</td></tr>
</tbody>
</table>
<p>Cuando dos países firmaron ambas, entre ellos rige la más nueva (Viena 1968). Por eso un país puede pedir el modelo 1949 a algunos visitantes y aceptar el 1968 de otros.</p>
</div>

<h2>Las convenciones, una por una</h2>
<ul class="convs">
${convenciones
  .map(
    (c) => `<li><h3><a href="${u(`/convenciones-onu/${c.slug}/`)}">${esc(c.nombre)}</a></h3>
<p class="meta">${esc(c.organismo)}${c.esONU ? '' : ', antecedente que no es un tratado de la ONU'}</p>
<p>${esc(recortar(c.intro, 230))}</p></li>`
  )
  .join('\n')}
</ul>`;
  return {
    ruta: '/convenciones-onu/',
    titulo: 'Convenciones de la ONU sobre el permiso internacional',
    descripcion:
      'Resumen de los artículos de las convenciones de la ONU de Ginebra 1949 y Viena 1968 sobre el Permiso Internacional de Conducir, con enlaces a los textos oficiales.',
    contenido,
    jsonld: [ldMigas([['Inicio', '/'], ['Convenciones ONU', '/convenciones-onu/']])],
  };
}

export function paginaConvencion(c, { paises }) {
  const clave = c.slug === 'ginebra-1949' ? 'ginebra1949' : c.slug === 'viena-1968' ? 'viena1968' : null;
  const partes = clave ? paises.filter((p) => p.convenios[clave]) : [];
  const ruta = `/convenciones-onu/${c.slug}/`;
  const datos = [
    ['Organismo', c.organismo],
    ['Firmada', fechaLarga(c.fecha)],
    c.vigencia && ['En vigor desde', fechaLarga(c.vigencia)],
    c.partes && ['Estados parte', c.partes],
    c.depositario && ['Depositario', c.depositario],
    ['Validez del permiso', c.validezPIC],
  ].filter(Boolean);

  const contenido = `
${migas([['Inicio', '/'], ['Convenciones ONU', '/convenciones-onu/'], [c.corto, ruta]])}
<h1>${esc(c.nombre)}</h1>
<p class="lead">${esc(c.intro)}</p>
<div class="ficha-grid">${datos.map(([k, val]) => `<div class="dato"><h3>${esc(k)}</h3><p>${esc(val)}</p></div>`).join('')}</div>

<h2>${c.esONU ? 'Artículos sobre el permiso de conducir' : 'Puntos clave'}</h2>
<ol class="articulos">
${c.articulos
  .map(
    (a) => `<li class="articulo"><span class="ref">${esc(a.ref)}</span><div><h3>${esc(a.titulo)}</h3><p>${esc(a.resumen)}</p></div></li>`
  )
  .join('\n')}
</ol>

${
  partes.length
    ? `<section><h2>Países que son parte (${partes.length})</h2>
<p class="muted">Según la Colección de Tratados de la ONU. Cada ficha se vuelve a verificar en la revisión semanal.</p>
<ul class="chips">${partes.map((p) => `<li><a href="${u(`/paises/${p.slug}/`)}">${esc(p.nombre)}</a></li>`).join('')}</ul></section>`
    : ''
}

${
  c.enlaces.length
    ? `<section><h2>Textos y fuentes oficiales</h2>${listaFuentes(c.enlaces)}</section>`
    : ''
}
<p class="nota">Los resúmenes son una lectura en lenguaje claro de los textos oficiales y no los reemplazan. Para un uso legal, consultá el texto auténtico en la Colección de Tratados de la ONU.</p>`;

  return {
    ruta,
    titulo: c.metaTitulo,
    descripcion: c.descripcion,
    contenido,
    og: `/og/convenciones-onu/${c.slug}.png`,
    jsonld: [
      ldMigas([['Inicio', '/'], ['Convenciones ONU', '/convenciones-onu/'], [c.corto, ruta]]),
      {
        '@context': 'https://schema.org',
        '@type': 'Legislation',
        name: c.nombre,
        legislationDate: c.fecha,
        ...(c.vigencia ? { legislationDateVersion: c.vigencia } : {}),
        legislationJurisdiction: 'Internacional',
        legislationType: 'Tratado internacional',
        ...(c.enlaces[0] ? { sameAs: c.enlaces[0].url } : {}),
        inLanguage: 'es',
        description: c.descripcion,
        url: abs(ruta),
      },
    ],
  };
}

// ---------------------------------------------------------------- Empresas
export function paginaEmpresas({ empresas, paises }) {
  const emisores = paises.filter((p) => p.emisorPIC?.nombre && !['AR', 'UY'].includes(p.iso2));
  const tarjeta = (e) => `<section class="dato" style="margin-bottom:16px${e.destacada ? ';box-shadow:inset 5px 0 0 var(--sign-blue)' : ''}">
<h3 style="font-size:1.3rem;color:var(--ink);margin:0 0 4px"><a href="${esc(e.web)}" rel="noopener">${esc(e.nombre)}</a>${e.destacada ? ' <span class="tag">Destacado</span>' : ''}</h3>
<p><strong>${esc(e.estado)}</strong></p>
<p>${esc(e.modalidad)}</p>
${e.horario ? `<p class="muted">${esc(e.horario)}</p>` : ''}
${e.limitacion ? `<p class="aviso">${icono('recomendado')}<span>${esc(e.limitacion)}</span></p>` : ''}
<ul class="contactos">${e.contactos.map((c) => `<li><span class="pais">${esc(c.pais)}</span><a href="${esc(c.href)}" rel="noopener">${esc(c.valor)}</a></li>`).join('')}</ul>
${
  e.oficinas?.length
    ? `<details style="margin-top:10px"><summary>Oficinas (${e.oficinas.length})</summary><ul>${e.oficinas
        .map((o) => `<li><strong>${esc(o.lugar)}:</strong> ${esc(o.direccion)}${o.telefono ? `, tel. ${esc(o.telefono)}` : ''}${o.horario ? `. ${esc(o.horario)}` : ''}</li>`)
        .join('')}</ul></details>`
    : ''
}
<p class="muted small" style="margin-top:8px">Fuente: <a href="${esc(e.fuente)}" rel="noopener" target="_blank">${esc(hostname(e.fuente))}</a>, revisado el ${fechaLarga(e.revisado)}.</p>
</section>`;

  const contenido = `
${migas([['Inicio', '/'], ['Dónde tramitarla', '/empresas/']])}
<h1>Dónde sacar la libreta internacional de conducir</h1>
<p class="lead">Empresas y entidades que gestionan el Permiso Internacional de Conducir en Uruguay y Argentina, con su modalidad de trámite, horarios y datos de contacto. Más abajo, quién lo emite en cada país.</p>

<h2>En Uruguay y Argentina</h2>
<div style="max-width:70ch;font-family:var(--sans)">
${empresas.map(tarjeta).join('\n')}
</div>

<h2>Quién emite el permiso en otros países</h2>
<p class="prose">El permiso internacional se tramita siempre en el país que emitió la licencia. Esta tabla se completa sola a medida que la revisión semanal verifica cada país.</p>
${
  emisores.length
    ? `<div class="tabla-wrap"><table class="paises"><thead><tr><th scope="col">País</th><th scope="col">Entidad emisora</th></tr></thead><tbody>${emisores
        .map(
          (p) =>
            `<tr><td><a href="${u(`/paises/${p.slug}/`)}">${esc(p.nombre)}</a></td><td>${p.emisorPIC.url ? `<a href="${esc(p.emisorPIC.url)}" rel="noopener" target="_blank">${esc(p.emisorPIC.nombre)}</a>` : esc(p.emisorPIC.nombre)}</td></tr>`
        )
        .join('')}</tbody></table></div>`
    : `<p class="nota">Todavía no hay países verificados fuera de Uruguay y Argentina. La primera revisión automática suma 10 países por semana.</p>`
}`;

  return {
    ruta: '/empresas/',
    titulo: 'Dónde sacar la libreta internacional de conducir',
    descripcion:
      'Empresas y entidades que tramitan la libreta internacional de conducir en Uruguay y Argentina: modalidad, horarios, contactos y emisores oficiales en cada país.',
    contenido,
    jsonld: [
      ldMigas([['Inicio', '/'], ['Dónde tramitarla', '/empresas/']]),
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Dónde tramitar la libreta internacional de conducir',
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        itemListElement: empresas.map((e, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'Organization',
            name: e.nombre,
            url: e.web,
            areaServed: e.paises.map((n) => ({ '@type': 'Country', name: n })),
            ...(e.direccion
              ? {
                  address: {
                    '@type': 'PostalAddress',
                    streetAddress: e.direccion.calle,
                    addressLocality: e.direccion.ciudad,
                    addressCountry: e.direccion.pais,
                  },
                }
              : {}),
            contactPoint: e.contactos.map((c) => ({
              '@type': 'ContactPoint',
              contactType: 'customer service',
              areaServed: c.pais,
              ...(c.tipo === 'email' ? { email: c.valor } : { telephone: c.valor }),
            })),
          },
        })),
      },
    ],
  };
}

// ---------------------------------------------------------------- Blog
export function paginaBlog({ posts, pagina, totalPaginas }) {
  const ruta = pagina === 1 ? '/blog/' : `/blog/pagina/${pagina}/`;
  const desde = (pagina - 1) * POSTS_POR_PAGINA;
  const visibles = posts.slice(desde, desde + POSTS_POR_PAGINA);
  const anterior = pagina > 1 ? (pagina === 2 ? '/blog/' : `/blog/pagina/${pagina - 1}/`) : null;
  const siguiente = pagina < totalPaginas ? `/blog/pagina/${pagina + 1}/` : null;
  const contenido = `
${migas([['Inicio', '/'], ['Road trips', '/blog/'], ...(pagina > 1 ? [[`Página ${pagina}`, ruta]] : [])])}
<h1>Road trips por el mundo${pagina > 1 ? `, página ${pagina}` : ''}</h1>
<p class="lead">Cada semana, una ruta nueva para recorrer en auto: tramos, paradas, consejos de manejo y la documentación que vas a necesitar en cada país.</p>
${visibles.length ? listaPosts(visibles) : '<p class="nota">Pronto aparece el primer road trip.</p>'}
<nav class="pager" aria-label="Páginas del blog">${anterior ? `<a href="${u(anterior)}" rel="prev">Más recientes</a>` : ''}${siguiente ? `<a href="${u(siguiente)}" rel="next">Más antiguos</a>` : ''}</nav>`;
  return {
    ruta,
    titulo: pagina > 1 ? `Road trips en español, página ${pagina}` : 'Road trips en español: rutas para manejar por el mundo',
    descripcion:
      'Guías de road trips en español por todo el mundo: rutas, tramos, días sugeridos, consejos de manejo y si piden el permiso internacional de conducir.',
    contenido,
    jsonld: [ldMigas([['Inicio', '/'], ['Road trips', '/blog/']])],
  };
}

export function paginaPost(post, { paises }) {
  const pais = paises.find((p) => p.iso2 === post.pais);
  const ruta = `/blog/${post.slug}/`;
  const datos = post.datos
    ? Object.entries({
        Distancia: post.datos.distancia,
        Duración: post.datos.duracion,
        Inicio: post.datos.inicio,
        Final: post.datos.fin,
        'Punto más alto': post.datos.puntoMasAlto,
        'Mejor época': post.datos.mejorEpoca,
      }).filter(([, v]) => v)
    : [];
  const contenido = `
${migas([['Inicio', '/'], ['Road trips', '/blog/'], [post.titulo, ruta]])}
<article>
<h1>${esc(post.titulo)}</h1>
<p class="post-meta">Publicado el <time datetime="${post.fecha}">${fechaLarga(post.fecha)}</time>${post.actualizado && post.actualizado !== post.fecha ? `, actualizado el <time datetime="${post.actualizado}">${fechaLarga(post.actualizado)}</time>` : ''}. ${post.minutos} min de lectura${pais ? `. País: <a href="${u(`/paises/${pais.slug}/`)}">${esc(pais.nombre)}</a>` : ''}</p>
${post.resumen ? `<p class="lead">${esc(post.resumen)}</p>` : ''}
${datos.length ? `<dl class="ruta-datos">${datos.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
<div class="prose">
${post.html}
</div>
${
  pais
    ? `<div class="cta"><h2>¿Piden la libreta internacional en ${esc(pais.nombre)}?</h2><p>${estadoBadge(pais.requisito)}</p><p>${esc(recortar(pais.resumen, 220))}</p><p><a href="${u(`/paises/${pais.slug}/`)}">Ver la ficha de ${esc(pais.nombre)}</a> o <a href="${u('/empresas/')}">dónde tramitarla</a></p></div>`
    : ''
}
${post.faq?.length ? `<section><h2>Preguntas frecuentes</h2>${faqHtml(post.faq)}</section>` : ''}
${post.fuentes?.length ? `<section><h2>Fuentes</h2>${listaFuentes(post.fuentes)}</section>` : ''}
</article>`;

  const imagen = abs(`/og/blog/${post.slug}.png`);
  return {
    ruta,
    titulo: post.metaTitulo || post.titulo,
    descripcion: post.descripcion,
    contenido,
    og: `/og/blog/${post.slug}.png`,
    ogTipo: 'article',
    publicado: post.fecha,
    modificado: post.actualizado || post.fecha,
    jsonld: [
      ldMigas([['Inicio', '/'], ['Road trips', '/blog/'], [post.titulo, ruta]]),
      {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.titulo,
        description: post.descripcion,
        image: [imagen],
        datePublished: post.fecha,
        dateModified: post.actualizado || post.fecha,
        inLanguage: 'es',
        mainEntityOfPage: abs(ruta),
        author: { '@id': ORG_ID, '@type': 'Organization', name: SITE.name, url: `${SITE.url}/` },
        publisher: { '@id': ORG_ID },
        keywords: (post.palabrasClave || []).join(', '),
        wordCount: post.palabras,
        ...(pais ? { about: { '@type': 'Country', name: pais.nombre } } : {}),
        citation: (post.fuentes || []).map((f) => ({ '@type': 'CreativeWork', name: f.titulo, url: f.url })),
      },
      ...(post.faq?.length ? [ldFaq(post.faq)] : []),
    ],
  };
}

// ---------------------------------------------------------------- Páginas fijas
export function paginaAcerca() {
  const contenido = `
${migas([['Inicio', '/'], ['Cómo hacemos las fichas', '/acerca/']])}
<h1>Cómo hacemos las fichas</h1>
<div class="prose">
<p class="lead">Este sitio reúne en un solo lugar lo que dicen las convenciones de la ONU y las autoridades de cada país sobre el Permiso Internacional de Conducir, siempre con la fuente a la vista.</p>
<h2>De dónde sale la información</h2>
<p>Partimos de la Colección de Tratados de las Naciones Unidas para saber qué países son parte de las convenciones de Ginebra (1949) y Viena (1968). Sobre esa base, cada ficha se completa con fuentes oficiales: organismos de tránsito, embajadas y consulados, automóvil clubes que emiten el permiso y, cuando hace falta, medios de referencia.</p>
<h2>Cómo se actualiza</h2>
<p>Una vez por semana un proceso automático revisa 10 países. Empieza por los que nunca se revisaron y, cuando completa la lista, vuelve a empezar por los que llevan más tiempo sin revisar. La revisión usa un asistente de inteligencia artificial con búsqueda web, que solo puede citar páginas que efectivamente encontró en esa búsqueda; las fuentes que no se pueden comprobar se descartan.</p>
<p>La misma rutina publica un road trip nuevo cada semana. Los artículos anteriores quedan guardados y no se vuelven a generar.</p>
<h2>Límites</h2>
<p>Las reglas de tránsito cambian y a veces las fuentes oficiales se contradicen. Por eso cada ficha muestra la fecha de revisión y los enlaces consultados. Antes de viajar, confirmá con la embajada, el consulado o la autoridad de tránsito del país de destino, y con la empresa de alquiler si vas a rentar un auto.</p>
</div>`;
  return {
    ruta: '/acerca/',
    titulo: 'Cómo hacemos las fichas de cada país',
    descripcion: 'Metodología de permisointernacionaldeconducir.com: fuentes oficiales, Colección de Tratados de la ONU y revisión semanal automática con fuentes citadas.',
    contenido,
    jsonld: [ldMigas([['Inicio', '/'], ['Cómo hacemos las fichas', '/acerca/']])],
  };
}

export function paginaAviso() {
  const contenido = `
${migas([['Inicio', '/'], ['Aviso legal', '/aviso-legal/']])}
<h1>Aviso legal y privacidad</h1>
<div class="prose">
<h2>Información de carácter general</h2>
<p>El contenido de ${esc(SITE.domain)} es informativo y no constituye asesoramiento legal. Los resúmenes de tratados son lecturas en lenguaje claro de los textos oficiales y no los reemplazan.</p>
<h2>Independencia</h2>
<p>Este sitio no pertenece a las Naciones Unidas, a ningún gobierno, ni al Automóvil Club del Uruguay, al Automóvil Club Argentino u otras entidades mencionadas. Los nombres y marcas citados pertenecen a sus titulares. La empresa marcada como «Destacado» en la columna de trámites aparece en primer lugar por decisión editorial del sitio.</p>
<h2>Privacidad</h2>
<p>El sitio no usa cookies, formularios de registro ni herramientas de seguimiento. El buscador funciona en tu navegador y no envía lo que escribís a ningún servidor.</p>
</div>`;
  return {
    ruta: '/aviso-legal/',
    titulo: 'Aviso legal y privacidad',
    descripcion: 'Aviso legal, independencia y política de privacidad de permisointernacionaldeconducir.com.',
    contenido,
    jsonld: [],
  };
}

export function pagina404() {
  const contenido = `
<h1>No encontramos esa página</h1>
<p class="lead">Puede que la dirección haya cambiado. Buscá el país al que viajás o volvé al inicio.</p>
<form class="search" action="${u('/paises/')}" method="get" role="search" data-search style="margin:20px 0">
<label for="q-404" style="color:var(--ink)">País</label>
<div class="search-row"><input id="q-404" name="q" type="search" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="res-404" style="border-color:var(--rule)"><button type="submit">Buscar</button></div>
<ul class="results" id="res-404" role="listbox" hidden></ul>
</form>
<p><a href="${u('/')}">Ir al inicio</a></p>`;
  return { ruta: '/404.html', titulo: 'Página no encontrada', descripcion: 'La página que buscás no existe.', contenido, noindex: true, jsonld: [] };
}
