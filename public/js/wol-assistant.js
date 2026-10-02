/**
 * Panel de sugerencias de la Biblioteca en línea Watchtower (WOL) con Gemini.
 * Independiente del corrector: solo usa el editor (#noteRichEditor) y /api/wol/suggest.
 * - Con el panel abierto y "Automático" activado, busca sugerencias cuando haces una pausa al escribir.
 * - "Insertar" añade el comentario donde estaba tu cursor y guarda la nota como siempre.
 */
(function () {
  const AUTO_DELAY_MS = 7000;        // pausa al escribir antes de buscar
  const AUTO_MIN_INTERVAL_MS = 45000; // como mucho una búsqueda automática cada 45 s
  const AUTO_MIN_NEW_CHARS = 80;      // texto nuevo mínimo antes de volver a buscar
  const MAX_CARDS = 12;

  const TYPE_LABELS = {
    punto: '💡 Punto', point: '💡 Point',
    contexto: '🏛️ Contexto', background: '🏛️ Background',
    texto: '📖 Texto', scripture: '📖 Scripture',
    ilustracion: '🖼️ Ilustración', ilustración: '🖼️ Ilustración', illustration: '🖼️ Illustration',
    aplicacion: '🎯 Aplicación', aplicación: '🎯 Aplicación', application: '🎯 Application'
  };

  const prefs = {
    auto: readPref('wol_auto', true),
    includeSource: readPref('wol_source', true)
  };

  let editor, textarea, drawer, listEl, statusEl, searchBtn;
  let lastRange = null;
  let autoTimer = null;
  let lastRequestAt = 0;
  let lastFocusText = '';
  let loading = false;
  let suppressInput = false;

  function readPref(key, def) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? def : v === '1';
    } catch (e) { return def; }
  }
  function writePref(key, val) {
    try { localStorage.setItem(key, val ? '1' : '0'); } catch (e) {}
  }

  function el(tag, attrs = {}, text) {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') n.className = v; else n.setAttribute(k, v);
    });
    if (text !== undefined) n.textContent = text;
    return n;
  }

  // ---------- Construcción de la interfaz ----------
  function buildUi() {
    const group = document.querySelector('.toolbar-ai-group');
    const openBtn = el('button', {
      type: 'button', id: 'btnWolAssistant', class: 'btn-wol-open',
      title: 'Sugerencias de comentarios basadas en la Biblioteca en línea Watchtower (Gemini)'
    }, '📚 Sugerencias WOL');
    if (group) group.appendChild(openBtn);
    openBtn.addEventListener('click', toggleDrawer);

    drawer = el('aside', { id: 'wolDrawer', class: 'wol-drawer', 'aria-label': 'Sugerencias de la Biblioteca en línea' });
    drawer.innerHTML = `
      <div class="wol-head">
        <div class="wol-title">📚 Sugerencias de la WOL</div>
        <button type="button" class="wol-close" title="Cerrar">✕</button>
      </div>
      <div class="wol-controls">
        <label class="wol-toggle"><input type="checkbox" id="wolAuto"> Automático al escribir</label>
        <label class="wol-toggle"><input type="checkbox" id="wolSource"> Incluir fuente</label>
        <button type="button" class="wol-search">🔍 Buscar ahora</button>
      </div>
      <div class="wol-status" role="status" aria-live="polite"></div>
      <div class="wol-list"></div>
      <div class="wol-foot">Comentarios redactados por Gemini a partir de la WOL. Verifícalos con la fuente.</div>
    `;
    document.body.appendChild(drawer);

    listEl = drawer.querySelector('.wol-list');
    statusEl = drawer.querySelector('.wol-status');
    searchBtn = drawer.querySelector('.wol-search');

    const autoBox = drawer.querySelector('#wolAuto');
    const srcBox = drawer.querySelector('#wolSource');
    autoBox.checked = prefs.auto;
    srcBox.checked = prefs.includeSource;
    autoBox.addEventListener('change', () => { prefs.auto = autoBox.checked; writePref('wol_auto', prefs.auto); });
    srcBox.addEventListener('change', () => { prefs.includeSource = srcBox.checked; writePref('wol_source', prefs.includeSource); });

    drawer.querySelector('.wol-close').addEventListener('click', toggleDrawer);
    searchBtn.addEventListener('click', () => requestSuggestions(true));

    setStatus('Escribe en tu apunte y pulsa "Buscar ahora", o deja activado el modo automático.');
  }

  function toggleDrawer() {
    drawer.classList.toggle('open');
    document.body.classList.toggle('wol-drawer-open', drawer.classList.contains('open'));
  }

  function setStatus(msg, kind = '') {
    statusEl.textContent = msg || '';
    statusEl.className = 'wol-status' + (kind ? ' ' + kind : '');
  }

  // ---------- Cursor del editor ----------
  function rememberRange() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
      lastRange = sel.getRangeAt(0).cloneRange();
    }
  }

  function currentBlock() {
    const node = lastRange ? lastRange.startContainer : null;
    if (!node || !editor.contains(node)) return null;
    let n = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
    while (n && n.parentNode !== editor) n = n.parentNode;
    return n && n.parentNode === editor ? n : null;
  }

  /** Texto en el que estás trabajando: el bloque del cursor y los dos anteriores. */
  function getFocusText() {
    const block = currentBlock();
    if (block) {
      const parts = [];
      let n = block, count = 0;
      while (n && count < 3) {
        const t = (n.textContent || '').trim();
        if (t) { parts.unshift(t); count++; }
        n = n.previousSibling;
      }
      const joined = parts.join('\n');
      if (joined.length >= 20) return joined.slice(-1500);
    }
    return (editor.innerText || '').trim().slice(-1200);
  }

  // ---------- Petición al servidor ----------
  async function requestSuggestions(manual) {
    if (loading) return;
    const focus = getFocusText();
    if (!manual && focus === lastFocusText) return;

    const title = (document.getElementById('noteTitleInput') || {}).value || '';
    const tags = (document.getElementById('noteTagsInput') || {}).value || '';
    const context = (textarea && textarea.value ? textarea.value : editor.innerText || '').slice(-3000);

    if ((focus + title).trim().length < 20) {
      setStatus('Escribe un poco más para poder buscar sugerencias.');
      return;
    }

    loading = true;
    lastRequestAt = Date.now();
    lastFocusText = focus;
    searchBtn.disabled = true;
    drawer.classList.add('is-loading');
    setStatus('⏳ Buscando en la Biblioteca en línea... (puede tardar 10–40 s)');

    try {
      const res = await fetch('/api/wol/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, tags, context, focus })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        if (data.code === 'BUSY') setStatus('Ya hay una búsqueda en curso. Espera unos segundos.');
        else setStatus('⚠️ ' + (data.error || 'No se pudieron obtener sugerencias.'), 'error');
        return;
      }
      if (!data.suggestions || data.suggestions.length === 0) {
        setStatus(data.message || 'No se encontró material relevante en la WOL para este fragmento.');
        return;
      }
      renderBatch(data.suggestions);
      const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setStatus(`✓ ${data.suggestions.length} sugerencia(s) de la WOL · ${hora}`, 'ok');
    } catch (e) {
      setStatus('⚠️ No se pudo conectar con el servidor.', 'error');
    } finally {
      loading = false;
      searchBtn.disabled = false;
      drawer.classList.remove('is-loading');
    }
  }

  function scheduleAuto() {
    if (!prefs.auto || !drawer.classList.contains('open')) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => {
      const focus = getFocusText();
      const sinceLast = Date.now() - lastRequestAt;
      const newChars = Math.abs(focus.length - lastFocusText.length) +
        (focus.startsWith(lastFocusText.slice(0, 40)) ? 0 : AUTO_MIN_NEW_CHARS);
      if (sinceLast < AUTO_MIN_INTERVAL_MS) {
        // Reintentar cuando pase el intervalo mínimo
        autoTimer = setTimeout(scheduleAuto, AUTO_MIN_INTERVAL_MS - sinceLast + 500);
        return;
      }
      if (newChars < AUTO_MIN_NEW_CHARS) return;
      requestSuggestions(false);
    }, AUTO_DELAY_MS);
  }

  // ---------- Tarjetas ----------
  function renderBatch(items) {
    items.slice().reverse().forEach(s => listEl.prepend(makeCard(s)));
    while (listEl.children.length > MAX_CARDS) listEl.lastElementChild.remove();
    listEl.scrollTop = 0;
  }

  function makeCard(s) {
    const card = el('div', { class: 'wol-card' });
    const key = String(s.type || '').toLowerCase();
    card.appendChild(el('div', { class: 'wol-type' }, TYPE_LABELS[key] || '💬 Comentario'));
    card.appendChild(el('p', { class: 'wol-text' }, s.text));
    if (s.scripture) card.appendChild(el('div', { class: 'wol-scripture' }, '📖 ' + s.scripture));
    if (s.source) card.appendChild(el('div', { class: 'wol-source' }, 'Fuente: ' + s.source));

    const actions = el('div', { class: 'wol-actions' });
    const ins = el('button', { type: 'button', class: 'wol-insert' }, '＋ Insertar');
    const dis = el('button', { type: 'button', class: 'wol-dismiss' }, 'Descartar');
    // Evita que el clic quite el cursor del editor
    ins.addEventListener('mousedown', e => e.preventDefault());
    ins.addEventListener('click', () => {
      insertSuggestion(s);
      ins.textContent = '✓ Insertado';
      ins.disabled = true;
      card.classList.add('used');
    });
    dis.addEventListener('click', () => card.remove());
    actions.append(ins, dis);
    card.appendChild(actions);
    return card;
  }

  function insertSuggestion(s) {
    let text = s.text.trim();
    if (s.scripture && !text.toLowerCase().includes(s.scripture.toLowerCase().slice(0, 6))) {
      text += ` (${s.scripture})`;
    }
    const p = document.createElement('p');
    p.appendChild(document.createTextNode(text));
    if (prefs.includeSource && s.source) {
      p.appendChild(document.createTextNode(' '));
      p.appendChild(el('em', {}, `(${s.source})`));
    }

    editor.focus({ preventScroll: true });
    const sel = window.getSelection();
    let range = lastRange && editor.contains(lastRange.startContainer) ? lastRange : null;
    if (!range) {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
    }

    // Insertar como párrafo nuevo después del bloque actual (no dentro de una frase)
    const block = currentBlockFor(range);
    if (block && block.nextSibling) editor.insertBefore(p, block.nextSibling);
    else editor.appendChild(p);

    const after = document.createRange();
    after.setStartAfter(p);
    after.collapse(true);
    sel.removeAllRanges();
    sel.addRange(after);
    lastRange = after.cloneRange();

    // Dispara la sincronización y el autoguardado existentes del editor
    suppressInput = true;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    suppressInput = false;
  }

  function currentBlockFor(range) {
    let n = range.startContainer;
    if (!editor.contains(n)) return null;
    if (n === editor) return editor.childNodes[range.startOffset - 1] || null;
    n = n.nodeType === Node.TEXT_NODE ? n.parentNode : n;
    while (n && n.parentNode !== editor) n = n.parentNode;
    return n;
  }

  function resetForNewNote() {
    listEl.innerHTML = '';
    lastFocusText = '';
    lastRange = null;
    clearTimeout(autoTimer);
    setStatus('Nota cambiada. Escribe o pulsa "Buscar ahora".');
  }

  // ---------- Inicio ----------
  function init() {
    editor = document.getElementById('noteRichEditor');
    textarea = document.getElementById('noteTextarea');
    if (!editor) return;
    buildUi();

    document.addEventListener('selectionchange', rememberRange);
    editor.addEventListener('keyup', rememberRange);
    editor.addEventListener('mouseup', rememberRange);
    editor.addEventListener('input', () => {
      if (suppressInput) return;
      rememberRange();
      scheduleAuto();
    });

    // Al abrir otra nota, limpiar las sugerencias de la anterior
    document.addEventListener('click', e => {
      if (e.target.closest('[data-action="open-note"], .note-list-item')) resetForNewNote();
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
