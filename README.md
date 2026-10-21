# permisointernacionaldeconducir.com

Sitio estático sobre el Permiso Internacional de Conducir (libreta internacional): convenciones de la ONU resumidas artículo por artículo, una ficha por país con fuentes citadas, buscador, empresas que tramitan la libreta y un blog semanal de road trips en español.

Se publica en **GitHub Pages** y se actualiza solo **una vez por semana** con GitHub Actions:

- Revisa **10 países** por ejecución. Primero los que nunca se revisaron (los destinos más visitados antes) y, cuando completa la lista, vuelve a empezar por el que lleva más tiempo sin revisarse.
- Publica **un road trip nuevo** por semana. Los posts anteriores quedan guardados en `content/blog/` y nunca se vuelven a generar; las rutas ya usadas quedan marcadas en `data/roadtrips.json`.
- Guarda los cambios en el repositorio, genera el sitio y lo publica.

La investigación la hace Claude (API de Anthropic) con búsqueda web. Solo se aceptan fuentes que aparecieron en esa búsqueda: las URLs inventadas se descartan, y una ficha necesita al menos dos fuentes comprobables para marcar un estado definitivo.

## Puesta en marcha (una sola vez)

1. **Subí estos archivos a un repositorio de GitHub** (rama `main`).
2. **Activá GitHub Pages:** *Settings → Pages → Build and deployment → Source:* **GitHub Actions**.
3. **Agregá la clave de la API de Claude:** *Settings → Secrets and variables → Actions → New repository secret*
   - Nombre: `ANTHROPIC_API_KEY`
   - Valor: una clave creada en la Consola de Claude. La búsqueda web tiene que estar habilitada para tu organización en la Consola. Documentación: https://docs.claude.com
   - Opcional: en la pestaña *Variables* podés crear `ANTHROPIC_MODEL` para elegir otro modelo (por defecto `claude-sonnet-5-5`).
4. **Dominio propio:** en *Settings → Pages → Custom domain* escribí `permisointernacionaldeconducir.com` (el archivo `static/CNAME` ya lo incluye). En tu proveedor de DNS:
   - Registros `A` del dominio raíz: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - Registro `CNAME` de `www` → `TU-USUARIO.github.io`
   - Cuando GitHub valide el dominio, activá **Enforce HTTPS**.
5. **Primera ejecución:** pestaña *Actions → Actualizar y publicar el sitio → Run workflow*. Podés subir la cantidad de países (por ejemplo 30) para completar más rápido las primeras fichas; después sigue sola con 10 por semana.
6. **Google Search Console:** verificá el dominio y enviá `https://permisointernacionaldeconducir.com/sitemap.xml`.

Si el paso que guarda los cambios falla con un error de permisos, revisá *Settings → Actions → General → Workflow permissions* y elegí **Read and write permissions**.

## Cuándo corre

- **Todos los lunes a las 07:23 (hora de Montevideo):** revisa 10 países, escribe el road trip de la semana y publica.
- **A mano:** desde *Actions → Run workflow*, con opciones para la cantidad de países y para forzar u omitir el post.
- **Con cada cambio en `main`:** vuelve a publicar el sitio sin llamar a la API (por ejemplo, si editás una empresa).

Cada ejecución guarda un resumen en `data/estado.json` (países actualizados, errores y post publicado). Si un país falla, se lo saltea y se vuelve a intentar en la próxima vuelta del ciclo.

## Dónde se edita cada cosa

| Qué | Archivo |
| --- | --- |
| Empresas de la columna izquierda (orden, contactos, horarios) | `data/empresas.json` |
| Fichas de países (las actualiza la automatización) | `data/paises.json` |
| Resúmenes de las convenciones de la ONU | `data/convenciones.json` |
| Cola de rutas para los próximos posts | `data/roadtrips.json` |
| Posts del blog (Markdown con datos al inicio) | `content/blog/` |
| Diseño | `static/assets/site.css` |
| Plantillas y textos de las páginas | `scripts/lib/pages.mjs`, `scripts/lib/templates.mjs` |

Para corregir a mano una ficha, editá el país en `data/paises.json`. Para que la automatización lo vuelva a revisar enseguida, ejecutá `npm run update -- --solo=ISO` (por ejemplo `--solo=JP`) con la clave en la variable `ANTHROPIC_API_KEY`.

## Comandos locales

Requiere Node.js 20 o superior.

```bash
npm install
npm run build      # genera el sitio en dist/
npm run check      # controla enlaces internos, títulos, descripciones y datos estructurados
npm run serve      # abre el sitio en http://localhost:4321
npm run update -- --simular   # muestra qué países y qué post tocarían, sin llamar a la API
```

## SEO incluido

- HTML estático por página (sin depender de JavaScript), URLs limpias en español y enlazado interno entre países, convenciones, posts y empresas.
- Título, meta descripción, canonical, `hreflang`, Open Graph y Twitter Card en cada página, con imagen social generada para cada país, convención y post.
- Datos estructurados (JSON-LD): `WebSite` con buscador, `Organization`, `BreadcrumbList`, `FAQPage`, `BlogPosting`, `Legislation` para los tratados e `ItemList` con las empresas y sus contactos.
- `sitemap.xml` con fecha de última modificación, `robots.txt` y feed RSS del blog.
- Tipografías alojadas en el propio sitio y sin scripts de terceros, para que cargue rápido.
- Cada ficha muestra la fecha de revisión y sus fuentes, y los posts citan las suyas.
