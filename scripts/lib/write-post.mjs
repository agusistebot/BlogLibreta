// Escribe el road trip semanal con Claude + búsqueda web y lo guarda en content/blog/.
import path from 'node:path';
import matter from 'gray-matter';
import { POSTS_DIR } from './config.mjs';
import { extraerJson, filtrarFuentes } from './claude.mjs';
import { investigar, generarSinBusqueda, descripcion, proveedor } from './ia.mjs';
import { slugify, recortar, hoyISO, writeFile, normalizarUrl } from './util.mjs';

const SYSTEM = `Sos redactor de viajes en ruta para un sitio en español sobre el Permiso Internacional de Conducir. Cada semana publicás una guía de road trip.

Reglas:
- Basate solo en información encontrada en la web (con tu herramienta de búsqueda o con los resultados que vienen en el mensaje): distancias, tramos, paradas, estado de las rutas, mejor época y normas de manejo para turistas en el país.
- No inventes datos. Si no encontraste un número, no lo pongas. Toda cifra tiene que poder rastrearse a una fuente que hayas encontrado.
- Escribí con tus propias palabras: nada de copiar frases de las fuentes ni de reproducir la estructura de un artículo ajeno.
- Español rioplatense natural, con voseo (como "manejás", "tenés"), cálido y práctico, sin frases hechas de folleto turístico.
- Respondé SOLO con el objeto JSON pedido (si podés, dentro de un bloque \`\`\`json).`;

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

// Búsquedas para el modo Gemini + Tavily, en el que el modelo no busca por su cuenta.
function consultasPost(ruta, pais) {
  return [
    `${ruta.ruta} road trip itinerario en auto`,
    `${ruta.ruta} distancia kilómetros recorrido tramos`,
    `${ruta.ruta} mejor época para viajar clima`,
    `${ruta.ruta} consejos para manejar estado de la ruta`,
    `${pais?.nombreEn || ruta.pais} driving rules for tourists foreign licence rental car`,
  ];
}

// Cuando se termina la cola de rutas, la IA propone una nueva que no se haya usado.
async function elegirRutaNueva({ usadas, paises }) {
  const texto = await generarSinBusqueda({
    system: 'Sos editor de un blog de viajes en auto. Respondé solo con JSON.',
    prompt: `Proponé una ruta conocida para hacer en auto, en cualquier parte del mundo, que no sea ninguna de estas:\n- ${usadas.join('\n- ')}\n\nCódigos ISO válidos: ${paises.map((p) => p.iso2).join(', ')}.\nFormato: {"ruta": "nombre de la ruta con inicio y fin", "pais": "ISO2"}`,
  });
  const json = extraerJson(texto);
  if (!json.ruta || !paises.some((p) => p.iso2 === json.pais)) throw new Error('La IA no propuso una ruta válida.');
  return { id: slugify(json.ruta), ruta: String(json.ruta).slice(0, 140), pais: json.pais, nueva: true };
}

export function validarPost(json, { urls, paises, slugsExistentes, resultados = [], complementar = false }) {
  const rutasInternas = new Set([...RUTAS_INTERNAS_FIJAS, ...paises.map((p) => `/paises/${p.slug}/`)]);
  const cuerpoBruto = String(json.cuerpo || '')
    .replace(/^#\s+.*$/m, '')
    .replace(/\n##\s+(Preguntas frecuentes|Fuentes)[\s\S]*$/i, '')
    .trim();
  const cuerpo = limpiarEnlaces(cuerpoBruto, { rutasInternas, urls });
  const palabras = cuerpo.split(/\s+/).filter(Boolean).length;
  if (palabras < 600) throw new Error(`El post es demasiado corto (${palabras} palabras).`);

  let fuentes = filtrarFuentes(json.fuentes, urls).slice(0, 8);
  if (complementar && fuentes.length < 3) {
    const vistas = new Set(fuentes.map((f) => normalizarUrl(f.url)));
    fuentes = [...fuentes, ...resultados.filter((r) => !vistas.has(normalizarUrl(r.url))).map((r) => ({ titulo: r.titulo || r.url, url: r.url }))].slice(0, 6);
  }
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
  const usadas = rutas.rutas.filter((r) => r.usado).map((r) => r.ruta);
  let ruta = rutas.rutas.find((r) => !r.usado);
  // Claude puede elegir y buscar la ruta en el mismo paso; con Gemini + Tavily hay que elegirla antes de buscar.
  if (!ruta && proveedor() !== 'claude') ruta = await elegirRutaNueva({ usadas, paises });
  const tablaPaises = paises.map((p) => `${p.iso2}=${p.slug}`).join(', ');
  const { texto, urls, uso, resultados, complementar } = await investigar({
    system: SYSTEM,
    prompt: construirPrompt({ ruta, usadas, titulos: postsExistentes.map((p) => p.titulo), tablaPaises }),
    consultas: ruta ? consultasPost(ruta, paises.find((p) => p.iso2 === ruta.pais)) : [],
    maxTokens: 24000,
    maxBusquedas: 8,
  });
  const post = validarPost(extraerJson(texto), {
    urls,
    paises,
    slugsExistentes: new Set(postsExistentes.map((p) => p.slug)),
    resultados,
    complementar,
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
    generadoPor: descripcion(),
    rutaId: ruta?.id || post.slug,
  };
  const archivo = path.join(POSTS_DIR, `${fecha}-${post.slug}.md`);
  writeFile(archivo, matter.stringify(`\n${post.cuerpo}\n`, frontmatter));

  if (ruta?.nueva) {
    rutas.rutas.push({ id: ruta.id, ruta: ruta.ruta, pais: ruta.pais, usado: fecha, post: post.slug });
  } else if (ruta) {
    ruta.usado = fecha;
    ruta.post = post.slug;
  } else {
    rutas.rutas.push({ id: post.slug, ruta: post.rutaNombre, pais: post.pais, usado: fecha, post: post.slug });
  }
  return { archivo, post, uso };
}
