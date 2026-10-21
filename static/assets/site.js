// Buscador de países y filtros de la tabla. Sin dependencias.
(() => {
  const base = document.querySelector('[data-root]') || document.body;
  const root = base.dataset.root || '/';
  const suffix = base.dataset.suffix || '';
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  let indice;
  const cargarIndice = () => (indice ||= fetch(root + 'assets/paises.json').then((r) => r.json()));
  const urlPais = (slug) => `${root}paises/${slug}/${suffix}`;

  const puntaje = (p, q) => {
    const nombre = norm(p.n);
    if (nombre === q) return 5;
    if (nombre.startsWith(q)) return 4;
    if (nombre.split(/[\s-]+/).some((w) => w.startsWith(q))) return 3;
    if (nombre.includes(q)) return 2;
    if (p.k.includes(q)) return 1;
    return 0;
  };

  document.querySelectorAll('[data-search]').forEach((form) => {
    const input = form.querySelector('input');
    const lista = form.querySelector('.results');
    let items = [];
    let activo = -1;

    const marcar = () => {
      lista.querySelectorAll('a').forEach((a, i) => a.setAttribute('aria-selected', String(i === activo)));
      input.setAttribute('aria-activedescendant', activo >= 0 ? `res-${activo}` : '');
    };
    const cerrar = () => {
      lista.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      activo = -1;
    };
    const mostrar = async () => {
      const q = norm(input.value);
      if (!q) return cerrar();
      const datos = await cargarIndice();
      items = datos.paises
        .map((p) => ({ p, s: puntaje(p, q) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s || a.p.n.localeCompare(b.p.n, 'es'))
        .slice(0, 8);
      lista.innerHTML = items.length
        ? items
            .map(
              ({ p }, i) =>
                `<li><a href="${urlPais(p.s)}" id="res-${i}" role="option"><svg class="ico" aria-hidden="true"><use href="#s-${p.e}"></use></svg><span class="r-name">${esc(p.n)}</span><span class="r-status">${esc(datos.estados[p.e] || '')}</span></a></li>`
            )
            .join('')
        : '<li class="r-empty">No encontramos ese país. Probá con otro nombre o abrí la lista completa.</li>';
      lista.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      activo = -1;
      marcar();
    };

    input.addEventListener('input', mostrar);
    input.addEventListener('keydown', (e) => {
      if (lista.hidden || !items.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); activo = (activo + 1) % items.length; marcar(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); activo = (activo - 1 + items.length) % items.length; marcar(); }
      else if (e.key === 'Escape') { cerrar(); }
    });
    form.addEventListener('submit', (e) => {
      if (!items.length) return;
      e.preventDefault();
      location.href = urlPais(items[Math.max(activo, 0)].p.s);
    });
    document.addEventListener('click', (e) => { if (!form.contains(e.target)) cerrar(); });
  });

  const tabla = document.querySelector('[data-tabla-paises]');
  if (tabla) {
    const campos = ['f-q', 'f-region', 'f-estado', 'f-conv'].map((id) => document.getElementById(id));
    const [q, region, estado, conv] = campos;
    const contador = document.getElementById('f-count');
    const filas = [...tabla.querySelectorAll('tbody tr')];
    const params = new URLSearchParams(location.search);
    if (params.get('q')) q.value = params.get('q');
    if (params.get('estado')) estado.value = params.get('estado');
    const aplicar = () => {
      const qq = norm(q.value);
      let visibles = 0;
      for (const fila of filas) {
        const ok =
          (!qq || fila.dataset.k.includes(qq)) &&
          (!region.value || fila.dataset.r === region.value) &&
          (!estado.value || fila.dataset.e === estado.value) &&
          (!conv.value || fila.dataset.c.split(' ').includes(conv.value));
        fila.hidden = !ok;
        if (ok) visibles++;
      }
      contador.textContent = `${visibles} de ${filas.length} países`;
    };
    campos.forEach((c) => c.addEventListener('input', aplicar));
    aplicar();
  }
})();
