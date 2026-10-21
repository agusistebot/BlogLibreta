// Escribe el road trip semanal con Claude + búsqueda web y lo guarda en content/blog/.
import path from 'node:path';
import matter from 'gray-matter';
import { POSTS_DIR, MODELO } from './config.mjs';
import { preguntarConBusqueda, extraerJson, filtrarFuentes } from './claude.mjs';
import { slugify, recortar, hoyISO, writeFile, normalizarUrl } from './util.mjs';

const SYSTEM = `Sos redactor de viajes en ruta para un sitio en español sobre el Permiso Internacional de Conducir. Cada semana publicás una guía de road trip.

Reglas:
- Investigá con la búsqueda web antes de escribir: distancias, tramos, paradas, estado de las rutas, mejor época y normas de manejo para turistas en el país.
- No inventes datos. Si no encontraste un número, no lo pongas. Toda cifra tiene que poder rastrearse a una fuente que hayas encontrado.
- Escribí con tus propias palabras: nada de copiar frases de las fuentes ni de reproducir la estructura de un artículo ajeno.
- Español rioplatense natural, con voseo (como "manejás", "tenés"), cálido y práctico, sin frases hechas de folleto turístico.
- Respondé SOLO con un bloque \`\`\`json con el objeto pedido.`;

function construirPrompt({ ruta, usadas, titulos, tablaPaises }) {
  const objetivo = ruta
    ? `La ruta de esta semana es: "${ruta.ruta}" (país ISO ${ruta.pais}).`
    : `Elegí una ruta nueva y conocida para hacer en auto, en cualquier parte del mundo, que NO sea ninguna de estas ya publicadas:\n- ${usadas.join('\n- ')}`;
  return `Fecha de hoy: ${hoyISO()}.
${objetivo}

Títulos ya publicados en el blog (no repitas el enfoque): ${titulos.length ? titulos.join(' | ') : 'ninguno'}.

Escribí una guía de road trip de entre 1.100 y 1.600 palabras en Markdown con esta estructura orientativa:
- Un párrafo de entrada (sin título) que diga por qué vale la pena la ruta.
- "## Datos clave antes de salir" con una lista corta.
- "## El recorrido, tramo por tramo" con subtítulos "###" por tramo o región.
- "## Cuántos días llevar" (podés usar una tabla Markdown).
- "## Consejos de manejo" con recomendaciones concretas para ese país (lado de circulación, peajes, combustible, clima, fauna, alquiler).
- "## Documentación para manejar en <país>": explicá qué piden a un turista con licencia de Uruguay o Argentina, enlazá la ficha del país con un link Markdown a la ruta interna exacta /paises/<slug>/ (tomala de la tabla de abajo) y aclará que la libreta internacional se tramita antes de viajar, en el país que emitió la licencia, con un link a /empresas/.
No incluyas título principal (#), ni sección de preguntas frecuentes, ni lista de fuentes dentro del cuerpo: van en campos aparte. Si enlazás páginas externas, solo pueden ser URLs que aparecieron en tu búsqueda.

Tabla de países del sitio (ISO → slug): ${tablaPaises}

Formato exacto de la respuesta:
\`\`\`json
{
  "rutaNombre": "nombre corto de la ruta",
  "titulo": "título atractivo, máximo 70 caracteres",
  "metaTitulo": "título para buscadores, máximo 60 caracteres, con la palabra clave principal",
  "descripcion": "meta descripción de 140 a 158 caracteres",
  "slug": "slug-en-minusculas-con-guiones",
  "pais": "ISO2 del país principal",
  "resumen": "una o dos oraciones que resuman la guía",
  "palabrasClave": ["5 palabras clave en español"],
  "datos": { "distancia": "...", "duracion": "...", "inicio": "...", "fin": "...", "puntoMasAlto": null, "mejorEpoca": "..." },
  "cuerpo": "el Markdown completo",
  "faq": [ { "pregunta": "...", "respuesta": "..." } ],
  "fuentes": [ { "titulo": "Medio u organismo — título", "url": "https://..." } ]
}
\`\`\`
"faq" lleva entre 3 y 4 preguntas reales que la gente busca sobre esa ruta. "fuentes" lleva entre 3 y 8 URLs que hayas consultado.`;
}

const RUTAS_INTERNAS_FIJAS = ['/', '/paises/', '/empresas/', '/blog/', '/convenciones-onu/', '/convenciones-onu/ginebra-1949/', '/convenciones-onu/viena-1968/', '/convenciones-onu/paris-1926/', '/convenciones-onu/washington-1943/'];

// Quita enlaces que no se pueden verificar (internos inexistentes o externos no encontrados en la búsqueda).
function limpiarEnlaces(md, { rutasInternas, urls }) {
  return md.replace(/(!?)\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (todo, img, textoEnlace, href) => {
    if (img) return '';
    if (href.startsWith('/')) {
      const ruta = href.endsWith('/') ? href : `${href}/`;
      return rutasInternas.has(ruta) ? `[${textoEnlace}](${ruta})` : textoEnlace;
    }
    return urls.has(normalizarUrl(href)) ? todo : textoEnlace;
  });
}

export function validarPost(json, { urls, paises, slugsExistentes }) {
  const rutasInternas = new Set([...RUTAS_INTERNAS_FIJAS, ...paises.map((p) => `/paises/${p.slug}/`)]);
  const cuerpoBruto = String(json.cuerpo || '')
    .replace(/^#\s+.*$/m, '')
    .replace(/\n##\s+(Preguntas frecuentes|Fuentes)[\s\S]*$/i, '')
    .trim();
  const cuerpo = limpiarEnlaces(cuerpoBruto, { rutasInternas, urls });
  const palabras = cuerpo.split(/\s+/).filter(Boolean).length;
  if (palabras < 600) throw new Error(`El post es demasiado corto (${palabras} palabras).`);

  const fuentes = filtrarFuentes(json.fuentes, urls).slice(0, 8);
  if (fuentes.length < 2) throw new Error('El post no tiene al menos dos fuentes comprobables.');

  const titulo = recortar(json.titulo, 90);
  if (!titulo) throw new Error('Falta el título.');
  let slug = slugify(json.slug || titulo) || slugify(titulo);
  const base = slug;
  for (let i = 2; slugsExistentes.has(slug); i++) slug = `${base}-${i}`;

  const pais = paises.some((p) => p.iso2 === json.pais) ? json.pais : null;
  const faq = (Array.isArray(json.faq) ? json.faq : [])
    .filter((f) => f?.pregunta && f?.respuesta)
    .slice(0, 5)
    .map((f) => ({ pregunta: recortar(f.pregunta, 160), respuesta: recortar(f.respuesta, 500) }));
  const datos = Object.fromEntries(
    Object.entries(json.datos || {})
      .filter(([, v]) => typeof v === 'string' && v.trim() && v.trim().toLowerCase() !== 'null')
      .map(([k, v]) => [k, recortar(v, 80)])
  );
  return {
    rutaNombre: recortar(json.rutaNombre || titulo, 120),
    titulo,
    metaTitulo: recortar(json.metaTitulo || titulo, 62),
    descripcion: recortar(json.descripcion || json.resumen || titulo, 160),
    slug,
    pais,
    resumen: recortar(json.resumen || '', 300),
    palabrasClave: (Array.isArray(json.palabrasClave) ? json.palabrasClave : []).map((k) => recortar(k, 60)).slice(0, 8),
    datos,
    cuerpo,
    faq,
    fuentes,
  };
}

export async function escribirPost({ paises, rutas, postsExistentes }) {
  const ruta = rutas.rutas.find((r) => !r.usado);
  const usadas = rutas.rutas.filter((r) => r.usado).map((r) => r.ruta);
  const tablaPaises = paises.map((p) => `${p.iso2}=${p.slug}`).join(', ');
  const { texto, urls, uso } = await preguntarConBusqueda({
    system: SYSTEM,
    prompt: construirPrompt({ ruta, usadas, titulos: postsExistentes.map((p) => p.titulo), tablaPaises }),
    maxTokens: 12000,
    maxBusquedas: 8,
  });
  const post = validarPost(extraerJson(texto), {
    urls,
    paises,
    slugsExistentes: new Set(postsExistentes.map((p) => p.slug)),
  });
  if (ruta && !post.pais) post.pais = ruta.pais;

  const fecha = hoyISO();
  const frontmatter = {
    titulo: post.titulo,
    metaTitulo: post.metaTitulo,
    slug: post.slug,
    fecha,
    actualizado: fecha,
    tipo: 'roadtrip',
    pais: post.pais,
    descripcion: post.descripcion,
    resumen: post.resumen,
    palabrasClave: post.palabrasClave,
    datos: post.datos,
    faq: post.faq,
    fuentes: post.fuentes,
    generadoPor: MODELO,
    rutaId: ruta?.id || post.slug,
  };
  const archivo = path.join(POSTS_DIR, `${fecha}-${post.slug}.md`);
  writeFile(archivo, matter.stringify(`\n${post.cuerpo}\n`, frontmatter));

  if (ruta) {
    ruta.usado = fecha;
    ruta.post = post.slug;
  } else {
    rutas.rutas.push({ id: post.slug, ruta: post.rutaNombre, pais: post.pais, usado: fecha, post: post.slug });
  }
  return { archivo, post, uso };
}
