// Actualización semanal: revisa N países (por defecto 10) y publica el road trip de la semana.
//
//   npm run update                     → 10 países + post si todavía no hay uno esta semana
//   npm run update -- --paises=25      → otra cantidad de países
//   npm run update -- --sin-post       → solo países
//   npm run update -- --forzar-post    → escribe otro post aunque ya haya uno esta semana
//   npm run update -- --solo=JP        → revisa solo ese país (útil para corregir una ficha)
//   npm run update -- --simular        → muestra qué haría, sin llamar a la API ni escribir nada
//
// IA: por defecto Gemini (nivel gratuito) + Tavily (plan gratuito) para buscar. Ver scripts/lib/ia.mjs.
//
// Orden de revisión: primero los países que nunca se revisaron (los más visitados antes),
// después los que llevan más tiempo sin revisarse. Al terminar la lista, el ciclo vuelve a empezar solo.
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { DATA, POSTS_DIR, PAISES_POR_EJECUCION } from './lib/config.mjs';
import { descripcion, verificarClaves, pausaEntreLlamadas } from './lib/ia.mjs';
import { readJSON, writeJSON, hoyISO, semanaISO } from './lib/util.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);
const SIMULAR = Boolean(args.simular);
const CANTIDAD = Math.max(0, Number(args.paises ?? PAISES_POR_EJECUCION) || 0);

const ARCHIVO_PAISES = path.join(DATA, 'paises.json');
const ARCHIVO_RUTAS = path.join(DATA, 'roadtrips.json');
const ARCHIVO_ESTADO = path.join(DATA, 'estado.json');
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function ordenDeRevision(paises) {
  return [...paises].sort((a, b) => {
    const ra = a.ultimaRevision || '';
    const rb = b.ultimaRevision || '';
    if (ra !== rb) return ra.localeCompare(rb); // nunca revisados ('') primero, luego los más viejos
    if (b.prioridad !== a.prioridad) return b.prioridad - a.prioridad;
    return a.nombre.localeCompare(b.nombre, 'es');
  });
}

function fechaPost(data) {
  const f = data.fecha instanceof Date ? data.fecha.toISOString() : String(data.fecha || '');
  return f.slice(0, 10);
}

function leerPosts() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const { data } = matter(fs.readFileSync(path.join(POSTS_DIR, f), 'utf8'));
      return { ...data, fecha: fechaPost(data), archivo: f };
    });
}

async function revisarPaises(paises, estado) {
  const { revisarPais } = await import('./lib/research-pais.mjs');
  const elegidos = args.solo
    ? paises.filter((p) => p.iso2 === String(args.solo).toUpperCase())
    : ordenDeRevision(paises).slice(0, CANTIDAD);
  console.log(`Países a revisar (${elegidos.length}): ${elegidos.map((p) => p.nombre).join(', ') || 'ninguno'}`);
  if (SIMULAR) return;

  for (const [i, pais] of elegidos.entries()) {
    if (i > 0) await esperar(pausaEntreLlamadas());
    const hoy = hoyISO();
    try {
      const { ficha, uso } = await revisarPais(pais);
      Object.assign(pais, ficha, {
        actualizado: hoy,
        ultimaRevision: hoy,
        verificado: ficha.requisito !== 'sin-verificar',
        ultimoError: null,
        historial: [{ fecha: hoy, requisito: ficha.requisito, origen: descripcion() }, ...(pais.historial || [])].slice(0, 12),
      });
      estado.paisesActualizados.push(pais.iso2);
      console.log(`  ✔ ${pais.nombre}: ${ficha.requisito} (${ficha.fuentes.length} fuentes, ${uso.busquedas} búsquedas)`);
    } catch (e) {
      // Se marca la revisión igual para que un país problemático no bloquee la rotación:
      // vuelve a intentarse en la próxima vuelta del ciclo.
      pais.ultimaRevision = hoy;
      pais.ultimoError = String(e.message).slice(0, 300);
      estado.errores.push({ pais: pais.iso2, error: pais.ultimoError });
      console.warn(`  ✖ ${pais.nombre}: ${e.message}`);
    }
    // Se guarda después de cada país: si el proceso se corta, lo hecho no se pierde.
    writeJSON(ARCHIVO_PAISES, paises);
  }
}

async function publicarPost(paises, estado) {
  const posts = leerPosts();
  const semana = semanaISO(hoyISO());
  const yaHay = posts.some((p) => p.tipo === 'roadtrip' && semanaISO(p.fecha) === semana);
  if (yaHay && !args['forzar-post']) {
    console.log(`Ya hay un road trip publicado en la semana ${semana}; no se escribe otro.`);
    return;
  }
  const rutas = readJSON(ARCHIVO_RUTAS, { rutas: [] });
  const proxima = rutas.rutas.find((r) => !r.usado);
  console.log(`Post de la semana: ${proxima ? proxima.ruta : 'ruta nueva elegida por la IA'}`);
  if (SIMULAR) return;
  const { escribirPost } = await import('./lib/write-post.mjs');
  try {
    const { archivo, post } = await escribirPost({ paises, rutas, postsExistentes: posts });
    writeJSON(ARCHIVO_RUTAS, rutas);
    estado.post = post.slug;
    console.log(`  ✔ Post guardado en ${path.relative(process.cwd(), archivo)}`);
  } catch (e) {
    estado.errores.push({ post: proxima?.id || 'nuevo', error: String(e.message).slice(0, 300) });
    console.warn(`  ✖ No se pudo escribir el post: ${e.message}`);
  }
}

async function main() {
  const paises = readJSON(ARCHIVO_PAISES, []);
  if (!paises.length) throw new Error('No hay países. Ejecutá npm run seed.');
  if (!SIMULAR) verificarClaves();
  const estado = { ultimaEjecucion: new Date().toISOString(), modelo: null, paisesActualizados: [], errores: [], post: null };
  console.log(`IA: ${descripcion()}`);

  if (CANTIDAD > 0 || args.solo) await revisarPaises(paises, estado);
  if (!args['sin-post'] && !args.solo) await publicarPost(paises, estado);

  if (SIMULAR) return console.log('Simulación: no se escribió nada.');
  estado.modelo = descripcion();
  const previo = readJSON(ARCHIVO_ESTADO, {});
  writeJSON(ARCHIVO_ESTADO, { ...estado, ejecuciones: [{ fecha: estado.ultimaEjecucion, paises: estado.paisesActualizados.length, errores: estado.errores.length, post: estado.post }, ...(previo.ejecuciones || [])].slice(0, 52) });

  const total = paises.length;
  const revisados = paises.filter((p) => p.verificado).length;
  console.log(`Listo: ${estado.paisesActualizados.length} países actualizados, ${estado.errores.length} errores. Fichas verificadas: ${revisados}/${total}.`);
  // Falla solo si no se pudo hacer nada de lo pedido, para que GitHub avise.
  const pedidoPaises = CANTIDAD > 0 || args.solo;
  if (pedidoPaises && !estado.paisesActualizados.length && estado.errores.length) process.exit(1);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
