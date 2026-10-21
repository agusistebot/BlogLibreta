// Revisión de la ficha de un país con Claude + búsqueda web.
import { ESTADOS } from './config.mjs';
import { preguntarConBusqueda, extraerJson, filtrarFuentes } from './claude.mjs';
import { esUrl, hostname, recortar, hoyISO } from './util.mjs';

const FUENTES_ONU = [
  'https://treaties.un.org/Pages/ViewDetailsV.aspx?src=TREATY&mtdsg_no=XI-B-1&chapter=11&Temp=mtdsg5&clang=_en',
  'https://treaties.un.org/Pages/ViewDetailsIII.aspx?src=TREATY&mtdsg_no=XI-B-19&chapter=11&Temp=mtdsg3&clang=_en',
];

// Sitios comerciales que venden "documentos internacionales de conducir" no emitidos por autoridades:
// no sirven como fuente de lo que exige un país.
const DOMINIOS_BLOQUEADOS = (process.env.DOMINIOS_BLOQUEADOS || 'idaoffice.org,internationaldriversassociation.com')
  .split(',')
  .map((d) => d.trim())
  .filter(Boolean);

const SYSTEM = `Sos un investigador de normativa de tránsito internacional. Escribís fichas para un sitio en español sobre el Permiso Internacional de Conducir (PIC, "libreta internacional"). El público son turistas hispanohablantes, sobre todo con licencia de Uruguay o Argentina.

Reglas:
- Buscá en la web antes de responder. Priorizá fuentes oficiales: ministerios u organismos de tránsito del país, embajadas y consulados, sitios oficiales de turismo, el automóvil club que emite el PIC en ese país y la Colección de Tratados de la ONU.
- No uses como fuente sitios que venden permisos o "documentos internacionales de conducir"; están sesgados.
- No inventes nada. Cada afirmación tiene que salir de una fuente que hayas encontrado en esta búsqueda, y en "fuentes" solo van URLs que aparecieron en tus resultados.
- Si las fuentes se contradicen o no alcanzan, usá "depende" y explicá la diferencia, o "sin-verificar" si no encontraste nada confiable.
- Escribí en español claro y neutro, en forma impersonal (sin "tú" ni "vos"). Parafraseá: no copies frases de las fuentes.
- Respondé SOLO con un bloque \`\`\`json con el objeto pedido, sin texto antes ni después.`;

function prompt(pais) {
  return `Fecha de hoy: ${hoyISO()}.
País a revisar: ${pais.nombre} (en inglés: ${pais.nombreEn}; código ISO ${pais.iso2}).

Datos que tenemos hoy (pueden estar desactualizados o incompletos):
${JSON.stringify(
  {
    convenios: pais.convenios,
    requisito: pais.requisito,
    resumen: pais.resumen,
    detalles: pais.detalles,
    autoridadTransito: pais.autoridadTransito,
    emisorPIC: pais.emisorPIC,
  },
  null,
  2
)}

Averiguá y devolvé:
1. Si ${pais.nombre} exige el Permiso Internacional de Conducir a turistas que manejan con licencia extranjera, en particular con licencias de Uruguay, Argentina u otros países del Mercosur. Usá uno de estos valores para "requisito":
   - "obligatorio": la ley o la autoridad lo exigen junto con la licencia.
   - "recomendado": no es obligatorio por ley, pero lo piden en controles, rentadoras o aseguradoras, o lo recomiendan fuentes oficiales.
   - "depende": cambia según el país de la licencia, el idioma/alfabeto de la licencia o la duración de la estadía.
   - "no-requerido": alcanza con la licencia nacional para turistas.
   - "sin-verificar": no encontraste fuentes confiables.
2. Si es parte de la Convención de Ginebra de 1949 y/o de la de Viena de 1968 (confirmalo en la Colección de Tratados de la ONU si podés) y qué modelo de PIC acepta.
3. Cuánto tiempo puede manejar un turista con licencia extranjera, si las fuentes lo dicen.
4. La autoridad nacional de tránsito o transporte (nombre y URL oficial).
5. Quién emite el PIC a los residentes de ese país (normalmente el automóvil club nacional o un organismo público), con URL y teléfono si figuran.

Formato exacto de la respuesta:
\`\`\`json
{
  "requisito": "obligatorio | recomendado | depende | no-requerido | sin-verificar",
  "resumen": "2 o 3 oraciones (máximo 450 caracteres) que respondan si piden el PIC en ${pais.nombre}",
  "detalles": ["entre 3 y 6 puntos concretos: validez, modelo aceptado, estadía máxima, licencias del Mercosur, rentadoras, multas, etc."],
  "convenios": { "ginebra1949": true, "viena1968": false },
  "convencionAceptada": "1949 | 1968 | ambas | ninguna | desconocido",
  "estadiaMaxima": "texto corto o null",
  "autoridadTransito": { "nombre": "...", "url": "https://..." },
  "emisorPIC": { "nombre": "...", "url": "https://...", "telefono": "... o null" },
  "fuentes": [ { "titulo": "Organismo — título de la página", "url": "https://..." } ]
}
\`\`\``;
}

function texto(valor, max) {
  if (typeof valor !== 'string') return null;
  const limpio = valor.replace(/\s+/g, ' ').trim();
  return limpio ? recortar(limpio, max) : null;
}

function entidad(obj, hosts) {
  if (!obj || typeof obj !== 'object') return null;
  const nombre = texto(obj.nombre, 140);
  if (!nombre) return null;
  // Solo se acepta la URL si su dominio apareció en la búsqueda (evita enlaces inventados).
  const url = esUrl(obj.url) && hosts.has(hostname(obj.url)) ? obj.url.trim() : null;
  const telefono = texto(obj.telefono, 40);
  return { nombre, url, ...(telefono && telefono !== 'null' ? { telefono } : {}) };
}

export function validarFicha(json, urls, pais) {
  const hosts = new Set([...urls].map(hostname));
  const fuentes = filtrarFuentes(json.fuentes, urls, FUENTES_ONU);
  if (!fuentes.length) throw new Error('Ninguna fuente citada apareció en los resultados de búsqueda.');

  let requisito = ESTADOS[json.requisito] ? json.requisito : 'sin-verificar';
  // Un estado definitivo necesita al menos dos fuentes comprobables.
  if (requisito !== 'sin-verificar' && fuentes.length < 2) requisito = 'sin-verificar';

  const resumen = texto(json.resumen, 520);
  if (!resumen || resumen.length < 40) throw new Error('Resumen vacío o demasiado corto.');

  const detalles = (Array.isArray(json.detalles) ? json.detalles : [])
    .map((d) => texto(d, 300))
    .filter(Boolean)
    .slice(0, 7);

  // Las convenciones solo se modifican si se citó la Colección de Tratados de la ONU o la CEPE.
  const citaTratados = fuentes.some((f) => /treaties\.un\.org|unece\.org/.test(f.url));
  const convenios = { ...pais.convenios };
  if (citaTratados && json.convenios && typeof json.convenios === 'object') {
    for (const k of ['ginebra1949', 'viena1968']) if (typeof json.convenios[k] === 'boolean') convenios[k] = json.convenios[k];
  }

  const aceptadas = ['1949', '1968', 'ambas', 'ninguna', 'desconocido'];
  const derivada = convenios.ginebra1949 && convenios.viena1968 ? 'ambas' : convenios.ginebra1949 ? '1949' : convenios.viena1968 ? '1968' : 'ninguna';
  const convencionAceptada = aceptadas.includes(json.convencionAceptada) ? json.convencionAceptada : derivada;

  const estadia = texto(json.estadiaMaxima, 140);
  return {
    requisito,
    resumen,
    detalles,
    convenios,
    convencionAceptada,
    estadiaMaxima: estadia && estadia.toLowerCase() !== 'null' ? estadia : null,
    autoridadTransito: entidad(json.autoridadTransito, hosts),
    emisorPIC: entidad(json.emisorPIC, hosts),
    fuentes: fuentes.slice(0, 8).map((f) => ({ ...f, consultado: hoyISO() })),
  };
}

export async function revisarPais(pais) {
  const { texto: respuesta, urls, uso } = await preguntarConBusqueda({
    system: SYSTEM,
    prompt: prompt(pais),
    maxTokens: 6000,
    maxBusquedas: 6,
    dominiosBloqueados: DOMINIOS_BLOQUEADOS,
  });
  const ficha = validarFicha(extraerJson(respuesta), urls, pais);
  return { ficha, uso };
}
