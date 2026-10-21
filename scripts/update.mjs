// Actualización semanal: revisa 10 países y publica el road trip de la semana.
//
//   npm run update -- --completar-semana  → completa lo que falte de la semana (10 países + 1 post).
//                                           Es lo que usan las ejecuciones automáticas.
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
// Si un país falla porque el servicio de IA está saturado, conserva su lugar y se reintenta
// en la próxima ejecución (lunes, miércoles o viernes).
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { DATA, POSTS_DIR, PAISES_POR_EJECUCION } from './lib/config.mjs';
import { readJSON, writeJSON, hoyISO, semanaISO } from './lib/util.mjs';
import { descripcion, verificarClaves, pausaEntreLlamadas, esTransitorio } from './lib/ia.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);
const SIMULAR = Boolean(args.simular);
const CANTIDAD = Math.max(0, Number(args.paises ?? PAISES_POR_EJECUCION) || 0);
// Países extra que se pueden intentar si algunos fallan, para llegar a la meta de la ejecución.
const INTENTOS_EXTRA = 5;
// Si el servicio falla con estos países seguidos, se deja para la próxima ejecución.
const CORTE_POR_SATURACION = 3;
// Un país cuyo contenido falla estas veces seguidas pasa al final de la fila.
const FALLOS_PARA_POSTERGAR = 3;

const ARCHIVO_PAISES = path.join(DATA, 'paises.json');
const ARCHIVO_RUTAS = path.join(DATA, 'roadtrips.json');
const ARCHIVO_ESTADO = path.join(DATA, 'estado.json');
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const aviso = (texto) => console.log(process.env.GITHUB_ACTIONS ? `::warning::${texto}` : `Aviso: ${texto}`);

// La fila se ordena por la última revisión exitosa: un corte del servicio no manda un país al final.
function claveOrden(p) {
  return ((p.fallos || 0) >= FALLOS_PARA_POSTERGAR ? p.ultimaRevision : p.actualizado) || '';
}

function ordenDeRevision(paises) {
  return [...paises].sort((a, b) => {
    const ka = claveOrden(a);
    const kb = claveOrden(b);
    if (ka !== kb) return ka.localeCompare(kb); // nunca revisados ('') primero, luego los más viejos
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

function hayPostEstaSemana(posts, semana) {
  return posts.some((p) => p.tipo === 'roadtrip' && semanaISO(p.fecha) === semana);
}

async function revisarPaises(paises, estado, objetivo) {
  const { revisarPais } = await import('./lib/research-pais.mjs');
  const candidatos = args.solo
    ? paises.filter((p) => p.iso2 === String(args.solo).toUpperCase())
    : ordenDeRevision(paises);
  const maxIntentos = args.solo ? candidatos.length : objetivo + INTENTOS_EXTRA;
  console.log(`Países a revisar (${objetivo}): ${candidatos.slice(0, objetivo).map((p) => p.nombre).join(', ') || 'ninguno'}`);
  if (SIMULAR) return;

  let exitos = 0;
  let intentos = 0;
  let caidasSeguidas = 0;
  for (const pais of candidatos) {
    if (exitos >= objetivo || intentos >= maxIntentos) break;
    if (caidasSeguidas >= CORTE_POR_SATURACION) {
      estado.cortado = true;
      aviso(`El servicio de IA no responde (${caidasSeguidas} países seguidos). Los pendientes se revisan en la próxima ejecución automática.`);
      break;
    }
    if (intentos > 0) await esperar(pausaEntreLlamadas());
    intentos++;
    const hoy = hoyISO();
    try {
      const { ficha, uso } = await revisarPais(pais);
      Object.assign(pais, ficha, {
        actualizado: hoy,
        ultimaRevision: hoy,
        verificado: ficha.requisito !== 'sin-verificar',
        ultimoError: null,
        fallos: 0,
        historial: [{ fecha: hoy, requisito: ficha.requisito, origen: descripcion() }, ...(pais.historial || [])].slice(0, 12),
      });
      exitos++;
      caidasSeguidas = 0;
      estado.paisesActualizados.push(pais.iso2);
      console.log(`  ✔ ${pais.nombre}: ${ficha.requisito} (${ficha.fuentes.length} fuentes, ${uso.busquedas} búsquedas)`);
    } catch (e) {
      const mensaje = String(e.message).slice(0, 300);
      pais.ultimaRevision = hoy;
      pais.ultimoError = mensaje;
      estado.errores.push({ pais: pais.iso2, error: mensaje, pasajero: esTransitorio(e) });
      if (e.fatal) {
        if (esTransitorio(e)) aviso(mensaje);
        else console.error(`  ✖ ${mensaje}`);
        estado.cortado = true;
        writeJSON(ARCHIVO_PAISES, paises);
        break;
      }
      if (esTransitorio(e)) {
        caidasSeguidas++;
        console.warn(`  ✖ ${pais.nombre}: ${mensaje} (conserva su lugar en la fila)`);
      } else {
        caidasSeguidas = 0;
        pais.fallos = (pais.fallos || 0) + 1;
        console.warn(`  ✖ ${pais.nombre}: ${mensaje} (fallo ${pais.fallos} de ${FALLOS_PARA_POSTERGAR})`);
      }
    }
    // Se guarda después de cada país: si el proceso se corta, lo hecho no se pierde.
    writeJSON(ARCHIVO_PAISES, paises);
  }
}

async function publicarPost(paises, estado, posts) {
  const rutas = readJSON(ARCHIVO_RUTAS, { rutas: [] });
  const proxima = rutas.rutas.find((r) => !r.usado);
  console.log(`Post de la semana: ${proxima ? proxima.ruta : 'ruta nueva elegida por la IA'}`);
  if (SIMULAR) return;
  if (estado.cortado) {
    aviso('El road trip de la semana queda para la próxima ejecución automática, porque el servicio de IA no está respondiendo.');
    return;
  }
  const { escribirPost } = await import('./lib/write-post.mjs');
  try {
    const { archivo, post } = await escribirPost({ paises, rutas, postsExistentes: posts });
    writeJSON(ARCHIVO_RUTAS, rutas);
    estado.post = post.slug;
    console.log(`  ✔ Post guardado en ${path.relative(process.cwd(), archivo)}`);
  } catch (e) {
    const mensaje = String(e.message).slice(0, 300);
    const pasajero = esTransitorio(e);
    estado.errores.push({ post: proxima?.id || 'nuevo', error: mensaje, pasajero });
    if (pasajero) aviso(`No se pudo escribir el road trip: ${mensaje} Se reintenta en la próxima ejecución automática.`);
    else console.warn(`  ✖ No se pudo escribir el post: ${mensaje}`);
  }
}

async function main() {
  const paises = readJSON(ARCHIVO_PAISES, []);
  if (!paises.length) throw new Error('No hay países. Ejecutá npm run seed.');

  const semana = semanaISO(hoyISO());
  const previo = readJSON(ARCHIVO_ESTADO, {});
  let hechos = previo.semana?.id === semana ? previo.semana.paises || [] : [];
  // Compatibilidad con el formato anterior de estado.json.
  if (!previo.semana && previo.ultimaEjecucion && semanaISO(previo.ultimaEjecucion) === semana) {
    hechos = previo.paisesActualizados || [];
  }
  const objetivo = args.solo ? 1 : args['completar-semana'] ? Math.max(0, PAISES_POR_EJECUCION - hechos.length) : CANTIDAD;
  const posts = leerPosts();
  const quierePost = !args['sin-post'] && !args.solo && Boolean(args['forzar-post'] || !hayPostEstaSemana(posts, semana));

  if (objetivo === 0 && !quierePost) {
    console.log(`Semana ${semana}: ya se revisaron ${hechos.length} países y se publicó el road trip. No hay nada pendiente.`);
    return;
  }
  if (!SIMULAR) verificarClaves();
  console.log(`IA: ${descripcion()}`);
  if (args['completar-semana']) console.log(`Semana ${semana}: ${hechos.length} países revisados hasta ahora; faltan ${objetivo}.`);

  const estado = { ultimaEjecucion: new Date().toISOString(), modelo: null, paisesActualizados: [], errores: [], post: null };
  if (objetivo > 0) await revisarPaises(paises, estado, objetivo);
  if (quierePost) await publicarPost(paises, estado, posts);
  else if (!args.solo && !args['sin-post']) console.log(`Ya hay un road trip publicado en la semana ${semana}.`);

  if (SIMULAR) return console.log('Simulación: no se escribió nada.');
  estado.modelo = descripcion();
  const semanaActual = { id: semana, paises: [...new Set([...hechos, ...estado.paisesActualizados])] };
  writeJSON(ARCHIVO_ESTADO, {
    ...estado,
    cortado: Boolean(estado.cortado),
    semana: semanaActual,
    ejecuciones: [
      { fecha: estado.ultimaEjecucion, paises: estado.paisesActualizados.length, errores: estado.errores.length, post: estado.post },
      ...(previo.ejecuciones || []),
    ].slice(0, 60),
  });

  const verificadas = paises.filter((p) => p.verificado).length;
  console.log(
    `Listo: ${estado.paisesActualizados.length} países actualizados, ${estado.errores.length} errores. ` +
      `Esta semana: ${semanaActual.paises.length} de ${PAISES_POR_EJECUCION}. Fichas verificadas: ${verificadas}/${paises.length}.`
  );
  // Termina en rojo solo si nada funcionó por un problema que no se arregla esperando (por ejemplo, una clave inválida).
  const nadaSalio = objetivo > 0 && !estado.paisesActualizados.length && estado.errores.length > 0;
  if (nadaSalio && !estado.errores.every((e) => e.pasajero)) process.exit(1);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
