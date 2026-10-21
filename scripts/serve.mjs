// Servidor local para revisar dist/ antes de publicar: npm run serve → http://localhost:4321
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { DIST } from './lib/config.mjs';

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain',
};
const puerto = Number(process.env.PORT || 4321);

http
  .createServer((req, res) => {
    let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (ruta.endsWith('/')) ruta += 'index.html';
    let archivo = path.join(DIST, path.normalize(ruta));
    if (!archivo.startsWith(DIST)) return res.writeHead(403).end();
    if (!fs.existsSync(archivo)) {
      res.writeHead(404, { 'content-type': TIPOS['.html'] });
      return res.end(fs.readFileSync(path.join(DIST, '404.html')));
    }
    res.writeHead(200, { 'content-type': TIPOS[path.extname(archivo)] || 'application/octet-stream' });
    fs.createReadStream(archivo).pipe(res);
  })
  .listen(puerto, () => console.log(`Sitio en http://localhost:${puerto}`));
