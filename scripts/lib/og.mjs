// Imágenes Open Graph (1200×630) generadas en el build con sharp, si está disponible.
import fs from 'node:fs';
import path from 'node:path';
import { STATIC } from './config.mjs';
import { esc } from './util.mjs';

let sharp = null;
try {
  sharp = (await import('sharp')).default;
} catch {
  sharp = null;
}

export const ogDisponible = () => Boolean(sharp);

const FUENTE = "Figtree, 'DejaVu Sans', 'Liberation Sans', Arial, sans-serif";
const MARINO = '#012448';
const TURQUESA = '#01717c';

// Emblema del logo (static/assets/emblema.svg) para incrustarlo en las imágenes.
let emblema = null;
function svgEmblema(x, y, ancho, alto) {
  if (emblema === null) {
    try {
      const fuente = fs.readFileSync(path.join(STATIC, 'assets/emblema.svg'), 'utf8');
      emblema = {
        viewBox: fuente.match(/viewBox="([^"]+)"/)?.[1] || '0 0 554 450',
        interior: fuente.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, ''),
      };
    } catch {
      emblema = false;
    }
  }
  if (!emblema) return '';
  return `<svg x="${x}" y="${y}" width="${ancho}" height="${alto}" viewBox="${emblema.viewBox}" preserveAspectRatio="xMidYMid meet">${emblema.interior}</svg>`;
}

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

// Malla de meridianos y paralelos, decorativa.
function globo(cx, cy, r) {
  const lat = [0.5, 0.866].flatMap((s) => {
    const dy = r * s;
    const dx = Math.sqrt(r * r - dy * dy);
    return [`M${cx - dx} ${cy - dy}h${2 * dx}`, `M${cx - dx} ${cy + dy}h${2 * dx}`];
  });
  return `<g fill="none" stroke="#ffffff" stroke-opacity="0.09" stroke-width="2">
<circle cx="${cx}" cy="${cy}" r="${r}"/>
<ellipse cx="${cx}" cy="${cy}" rx="${r * 0.5}" ry="${r}"/>
<ellipse cx="${cx}" cy="${cy}" rx="${r * 0.866}" ry="${r}"/>
<path d="M${cx} ${cy - r}v${2 * r}M${cx - r} ${cy}h${2 * r}${lat.join('')}"/>
</g>`;
}

function svgTarjeta({ titulo, subtitulo, etiqueta, color = TURQUESA }) {
  let tam = 62;
  let lineas = partirEnLineas(titulo, 26);
  if (lineas.length > 3) {
    tam = 50;
    lineas = partirEnLineas(titulo, 33).slice(0, 4);
  }
  const alto = lineas.length * tam * 1.14;
  const y0 = 300 - alto / 2 + tam * 0.8;
  const texto = lineas
    .map((l, i) => `<text x="80" y="${(y0 + i * tam * 1.14).toFixed(0)}" font-size="${tam}" font-weight="800" fill="#ffffff" font-family="${FUENTE}">${esc(l)}</text>`)
    .join('');
  const anchoEtiqueta = etiqueta ? Math.round(String(etiqueta).length * 15.5 + 44) : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="${MARINO}"/>
${globo(1060, 250, 270)}
<rect width="1200" height="12" fill="${color}"/>
<rect y="12" width="1200" height="4" fill="#3cbcc5"/>
${etiqueta ? `<rect x="80" y="70" width="${anchoEtiqueta}" height="48" rx="6" fill="${color}"/><text x="102" y="102" font-size="25" font-weight="700" fill="#ffffff" font-family="${FUENTE}">${esc(etiqueta)}</text>` : ''}
${texto}
${subtitulo ? `<text x="80" y="478" font-size="29" font-weight="600" fill="#c3d2e3" font-family="${FUENTE}">${esc(subtitulo)}</text>` : ''}
<rect y="516" width="1200" height="114" fill="#ffffff"/>
<rect y="516" width="1200" height="5" fill="#3cbcc5"/>
${svgEmblema(64, 534, 100, 81)}
<text x="182" y="566" font-size="30" font-weight="800" fill="${MARINO}" font-family="${FUENTE}">Permiso Internacional</text>
<text x="182" y="602" font-size="30" font-weight="800" fill="${TURQUESA}" font-family="${FUENTE}">de Conducir</text>
<text x="1130" y="586" text-anchor="end" font-size="24" font-weight="600" fill="#4a5868" font-family="${FUENTE}">permisointernacionaldeconducir.com</text>
</svg>`;
}

export async function generarOg(destino, datos) {
  if (!sharp) return false;
  await sharp(Buffer.from(svgTarjeta(datos))).png({ compressionLevel: 9, palette: true }).toFile(destino);
  return true;
}

export async function generarIcono(destino) {
  if (!sharp) return false;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180"><rect width="180" height="180" fill="#ffffff"/>${svgEmblema(14, 26, 152, 128)}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(destino);
  return true;
}
