// Imágenes Open Graph (1200×630) generadas en el build con sharp, si está disponible.
import { esc } from './util.mjs';

let sharp = null;
try {
  sharp = (await import('sharp')).default;
} catch {
  sharp = null;
}

export const ogDisponible = () => Boolean(sharp);

const FUENTE = "Overpass, 'DejaVu Sans', 'Liberation Sans', Arial, sans-serif";

function partirEnLineas(texto, max) {
  const palabras = String(texto).split(/\s+/);
  const lineas = [];
  let actual = '';
  for (const p of palabras) {
    if ((actual + ' ' + p).trim().length > max && actual) {
      lineas.push(actual);
      actual = p;
    } else {
      actual = (actual + ' ' + p).trim();
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

function svgTarjeta({ titulo, subtitulo, etiqueta, color = '#1f4fa0' }) {
  let tam = 68;
  let lineas = partirEnLineas(titulo, 26);
  if (lineas.length > 3) {
    tam = 54;
    lineas = partirEnLineas(titulo, 33).slice(0, 4);
  }
  const alto = lineas.length * tam * 1.12;
  const y0 = 300 - alto / 2 + tam * 0.8;
  const texto = lineas
    .map((l, i) => `<text x="110" y="${(y0 + i * tam * 1.12).toFixed(0)}" font-size="${tam}" font-weight="800" fill="#fff" font-family="${FUENTE}">${esc(l)}</text>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#4b525a"/>
<rect x="50" y="50" width="1100" height="470" rx="34" fill="${color}"/>
<rect x="64" y="64" width="1072" height="442" rx="24" fill="none" stroke="#fff" stroke-width="7"/>
${etiqueta ? `<text x="110" y="135" font-size="30" font-weight="700" fill="#dfe8f7" font-family="${FUENTE}">${esc(etiqueta)}</text>` : ''}
${texto}
${subtitulo ? `<text x="110" y="470" font-size="30" font-weight="600" fill="#dfe8f7" font-family="${FUENTE}">${esc(subtitulo)}</text>` : ''}
<ellipse cx="120" cy="573" rx="46" ry="28" fill="#fff" stroke="#111" stroke-width="3"/>
<text x="120" y="583" text-anchor="middle" font-size="26" font-weight="900" fill="#111" font-family="${FUENTE}">PIC</text>
<text x="186" y="583" font-size="28" font-weight="700" fill="#fff" font-family="${FUENTE}">permisointernacionaldeconducir.com</text>
</svg>`;
}

export async function generarOg(destino, datos) {
  if (!sharp) return false;
  await sharp(Buffer.from(svgTarjeta(datos))).png({ compressionLevel: 9, palette: true }).toFile(destino);
  return true;
}

export async function generarIcono(destino) {
  if (!sharp) return false;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180"><rect width="180" height="180" fill="#4b525a"/><ellipse cx="90" cy="90" rx="76" ry="48" fill="#fff" stroke="#111" stroke-width="6"/><text x="90" y="107" text-anchor="middle" font-size="48" font-weight="900" fill="#111" font-family="${FUENTE}">PIC</text></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(destino);
  return true;
}
