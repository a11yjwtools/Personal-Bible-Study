/**
 * Atajos de teclado personalizables
 * ---------------------------------------------------------------------------
 * - Insertar versículo SIN seleccionar: coloca el cursor dentro o justo después
 *   de la cita («Mateo 4:5») y pulsa el atajo. Si hay texto seleccionado, se
 *   usa la selección, como el botón «Versículo».
 * - Buscar en la WOL con la selección, la cita junto al cursor o la palabra
 *   que tienes bajo el cursor.
 * - Todos los botones de formato de la barra tienen atajo.
 * - Se pueden cambiar en Ajustes → «Atajos de teclado», y añadir búsquedas
 *   propias con una plantilla de dirección (por ejemplo …?q={q}).
 *
 * Los atajos se guardan solo en este dispositivo (localStorage).
 * Archivo independiente: si fallara, la app sigue igual.
 *
 * Para añadir una acción nueva, agrega un objeto a BUILTIN_ACTIONS.
 */
(function () {
  'use strict';

  const STORE_KEY = 'ep_shortcuts_v1';

  // ======================================================================
  //  Acciones disponibles
  //  editorOnly: solo funciona con el cursor dentro del apunte.
  // ======================================================================
  const BUILTIN_ACTIONS = [
    { id: 'scripture', format: 'scripture', group: 'Biblia y búsquedas', label: 'Insertar versículo', def: 'Alt+T', editorOnly: true, run: runScripture },
    { id: 'wol-es', group: 'Biblia y búsquedas', label: 'Buscar en la WOL (español)', def: 'Alt+W+S', run: (ctx) => runWol(ctx, 'es') },
    { id: 'wol-en', group: 'Biblia y búsquedas', label: 'Buscar en la WOL (inglés)', def: 'Alt+W+E', run: (ctx) => runWol(ctx, 'en') },
    { id: 'wol-panel', group: 'Biblia y búsquedas', label: 'Abrir o cerrar el panel WOL y Copilot', def: 'Alt+Shift+P', run: () => { const w = window.WolAssistant; if (w) w.togglePanel(); } },

    fmt('bold', 'Negrita', 'Ctrl+B'),
    fmt('italic', 'Cursiva', 'Ctrl+I'),
    fmt('h1', 'Título', 'Alt+Shift+1'),
    fmt('h2', 'Subtítulo', 'Alt+Shift+2'),
    fmt('normal', 'Texto normal (quitar formato)', 'Alt+Shift+0'),
    fmt('bullet', 'Lista', 'Alt+Shift+L'),
    fmt('quote', 'Cita', 'Alt+Shift+Q'),
    fmt('callout', 'Punto clave destacado', 'Alt+Shift+K'),
    fmt('hl-yellow', 'Resaltar en amarillo', 'Alt+Shift+A'),
    fmt('hl-red', 'Resaltar en rojo', 'Alt+Shift+R'),
    fmt('hl-clear', 'Quitar resaltado', 'Alt+Shift+X'),
    fmt('sticky', 'Añadir nota al texto seleccionado', 'Alt+Shift+N')
  ];

  function fmt(format, label, def) {
    return {
      id: format, format, group: 'Formato', label, def, editorOnly: true,
      run: () => {
        const nn = window.NotionNotes;
        if (nn && nn.applyTextFormat) nn.applyTextFormat(format);
      }
    };
  }

  // Combinaciones que el navegador o la app ya usan: no se pueden asignar.
  const RESERVED = new Set([
    'Ctrl+C', 'Ctrl+V', 'Ctrl+X', 'Ctrl+Z', 'Ctrl+Y', 'Ctrl+A', 'Ctrl+K', 'Ctrl+F', 'Ctrl+P',
    'Ctrl+S', 'Ctrl+W', 'Ctrl+T', 'Ctrl+N', 'Ctrl+R', 'Ctrl+L', 'Ctrl+Shift+N', 'Ctrl+Shift+T',
    'Ctrl+Shift+W', 'Ctrl+Shift+V', 'Alt+F4', 'F5', 'F11', 'F12'
  ]);

  // ======================================================================
  //  Ajustes guardados
  // ======================================================================
  let state = { bindings: {}, custom: [] };

  function loadState() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (raw && typeof raw === 'object') {
        state.bindings = raw.bindings && typeof raw.bindings === 'object' ? raw.bindings : {};
        state.custom = Array.isArray(raw.custom) ? raw.custom.filter(c => c && c.id && c.url) : [];
      }
    } catch (e) { /* ajustes dañados: se usan los predeterminados */ }
  }
  function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* sin almacenamiento */ }
  }

  function allActions() {
    const custom = state.custom.map(c => ({
      id: c.id, custom: true, group: 'Mis búsquedas', label: c.label, def: '', url: c.url,
      run: (ctx) => runCustomSearch(ctx, c)
    }));
    return BUILTIN_ACTIONS.concat(custom);
  }
  function comboOf(action) {
    if (action.custom) {
      const c = state.custom.find(x => x.id === action.id);
      return (c && c.combo) || '';
    }
    return Object.prototype.hasOwnProperty.call(state.bindings, action.id) ? state.bindings[action.id] : action.def;
  }
  function setCombo(action, combo) {
    if (action.custom) {
      const c = state.custom.find(x => x.id === action.id);
      if (c) c.combo = combo;
    } else {
      state.bindings[action.id] = combo;
    }
    saveState();
    rebuildIndex();
    updateHints();
  }

  let comboIndex = new Map(); // combinación → id de acción
  function rebuildIndex() {
    comboIndex = new Map();
    allActions().forEach(a => { const c = comboOf(a); if (c) comboIndex.set(c, a.id); });
  }

  // ======================================================================
  //  Teclas
  // ======================================================================
  const PUNCT = { Slash: '/', Period: '.', Comma: ',', Semicolon: ';', Quote: "'", Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\' };

  function keyFromEvent(e) {
    const c = e.code || '';
    if (/^Key[A-Z]$/.test(c)) return c.slice(3);
    if (/^Digit\d$/.test(c)) return c.slice(5);
    if (/^F([1-9]|1[0-2])$/.test(c)) return c;
    if (PUNCT[c]) return PUNCT[c];
    if (!c && e.key && e.key.length === 1 && /[a-z0-9]/i.test(e.key)) return e.key.toUpperCase();
    return null;
  }

  /** «Alt+Shift+V», «Ctrl+B»… o null si no es una combinación válida. */
  function comboFromEvent(e) {
    const key = keyFromEvent(e);
    if (!key) return null;
    const isF = /^F\d/.test(key);
    if (!(e.ctrlKey || e.altKey || e.metaKey) && !isF) return null;
    const parts = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push('Meta');
    parts.push(key);
    return parts.join('+');
  }

  function toAriaShortcut(combo) {
    return combo.split('+').map(p => (p === 'Ctrl' ? 'Control' : p)).join('+');
  }

  // ======================================================================
  //  Detectar una cita junto al cursor (sin necesidad de seleccionarla)
  // ======================================================================
  const N = '\\d{1,3}(?!\\d)';
  const TAIL_SRC = `${N}\\s*:\\s*${N}(?:\\s*[-–—]\\s*${N}(?:\\s*:\\s*${N})?)?(?:\\s*,\\s*${N}(?:\\s*[-–—]\\s*${N})?)*`;
  const TOKEN_OK = /^(?:[1-3]|[1-3]?[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ.]*)$/;
  const LEAD_JUNK = /^[("“«'\[*_]+/;

  function defaultValidate(candidate) {
    const B = window.EPBible;
    if (B && typeof B.parseReferences === 'function') {
      try { return B.parseReferences(candidate).length > 0; } catch (e) { return false; }
    }
    return true;
  }

  /** Devuelve [{ start, end, text }] con las citas que encuentra en el texto. */
  function findReferences(text, validate) {
    const ok = validate || defaultValidate;
    const out = [];
    const re = new RegExp(TAIL_SRC, 'g');
    let m;
    while ((m = re.exec(text))) {
      const tailStart = m.index;
      const tailEnd = tailStart + m[0].length;
      if (tailStart > 0 && /[\d:]/.test(text[tailStart - 1])) continue;

      // Hasta 4 palabras anteriores (p. ej. «1 Corintios», «Cantares de Salomón»)
      const before = text.slice(0, tailStart);
      const toks = [];
      const tokRe = /\S+/g;
      let t;
      while ((t = tokRe.exec(before))) {
        let s = t.index;
        let w = t[0];
        const lead = w.match(LEAD_JUNK);
        if (lead) { s += lead[0].length; w = w.slice(lead[0].length); }
        toks.push({ s, w });
      }
      let best = null;
      for (let k = 1; k <= Math.min(4, toks.length); k++) {
        const slice = toks.slice(toks.length - k);
        if (!slice.every(x => TOKEN_OK.test(x.w))) break;
        const start = slice[0].s;
        const candidate = text.slice(start, tailEnd);
        if (ok(candidate)) best = { start, end: tailEnd, text: candidate };
      }
      if (best) out.push(best);
    }
    return out;
  }

  /** La cita que contiene el cursor, o la que está justo antes de él. */
  function pickReference(refs, caret, text) {
    const inside = refs.find(r => r.start <= caret && caret <= r.end);
    if (inside) return inside;
    const prev = refs.filter(r => r.end <= caret).pop();
    if (prev && /^[\s.,;:)\]"”»'’!?*_]*$/.test(text.slice(prev.end, caret))) return prev;
    return null;
  }

  /** La palabra bajo el cursor (o pegada a él). */
  function wordAt(text, caret) {
    const re = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;
    let m;
    while ((m = re.exec(text))) {
      if (m.index <= caret && caret <= m.index + m[0].length) {
        return { start: m.index, end: m.index + m[0].length, text: m[0] };
      }
    }
    return null;
  }

  function resolveTarget(text, caret, selectFn, opts) {
    const r = pickReference(findReferences(text), caret, text);
    if (r) return { kind: 'reference', text: r.text.trim(), select: () => selectFn(r.start, r.end) };
    if (opts && opts.word) {
      const w = wordAt(text, caret);
      if (w) return { kind: 'word', text: w.text, select: () => selectFn(w.start, w.end) };
    }
    return null;
  }

  // ----- editor enriquecido (contenteditable) -----
  const BLOCK_TAGS = new Set(['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE']);

  function richInfo(root) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !root.contains(sel.anchorNode)) return null;
    const range = sel.getRangeAt(0);
    let block = range.startContainer;
    while (block && block !== root && !(block.nodeType === 1 && BLOCK_TAGS.has(block.tagName))) block = block.parentNode;
    if (!block) block = root;

    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    const segs = [];
    let text = '';
    let n;
    while ((n = walker.nextNode())) {
      segs.push({ node: n, start: text.length, end: text.length + n.nodeValue.length });
      text += n.nodeValue;
    }
    const r = document.createRange();
    r.selectNodeContents(block);
    try { r.setEnd(range.startContainer, range.startOffset); } catch (e) { return null; }
    return { segs, text, caret: r.toString().length };
  }

  function posAt(segs, off, isEnd) {
    for (const s of segs) {
      if (isEnd ? (off > s.start && off <= s.end) : (off >= s.start && off < s.end)) {
        return { node: s.node, offset: off - s.start };
      }
    }
    const last = segs[segs.length - 1];
    return last ? { node: last.node, offset: last.end - last.start } : null;
  }

  function selectRich(info, start, end) {
    const a = posAt(info.segs, start, false);
    const b = posAt(info.segs, end, true);
    if (!a || !b) return;
    const range = document.createRange();
    range.setStart(a.node, a.offset);
    range.setEnd(b.node, b.offset);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // ----- editor de texto/markdown (textarea) -----
  function textareaInfo(ta) {
    const v = ta.value;
    const caret = ta.selectionStart;
    const lineStart = caret === 0 ? 0 : v.lastIndexOf('\n', caret - 1) + 1;
    let lineEnd = v.indexOf('\n', caret);
    if (lineEnd === -1) lineEnd = v.length;
    return { text: v.slice(lineStart, lineEnd), caret: caret - lineStart, lineStart };
  }

  // ----- contexto: ¿dónde está el cursor? -----
  function getContext() {
    const rich = document.getElementById('noteRichEditor');
    const ta = document.getElementById('noteTextarea');
    const active = document.activeElement;
    if (rich && rich.offsetParent !== null && rich.contains(active)) return { mode: 'rich', rich };
    if (ta && ta.offsetParent !== null && active === ta) return { mode: 'text', ta };
    return null;
  }

  /**
   * Qué texto usar: la selección; si no hay, la cita junto al cursor;
   * y (si opts.word) la palabra bajo el cursor. Devuelve { kind, text, select() } o null.
   */
  function locate(ctx, opts) {
    if (!ctx) return null;
    if (ctx.mode === 'rich') {
      const sel = window.getSelection();
      const selected = sel && sel.rangeCount && ctx.rich.contains(sel.anchorNode) ? sel.toString().trim() : '';
      if (selected) return { kind: 'selection', text: selected, select() {} };
      const info = richInfo(ctx.rich);
      return info ? resolveTarget(info.text, info.caret, (s, e) => selectRich(info, s, e), opts) : null;
    }
    const ta = ctx.ta;
    if (ta.selectionStart !== ta.selectionEnd) {
      const selected = ta.value.slice(ta.selectionStart, ta.selectionEnd).trim();
      if (selected) return { kind: 'selection', text: selected, select() {} };
    }
    const info = textareaInfo(ta);
    return resolveTarget(info.text, info.caret, (s, e) => ta.setSelectionRange(info.lineStart + s, info.lineStart + e), opts);
  }

  // ======================================================================
  //  Acciones
  // ======================================================================
  function runScripture(ctx) {
    const nn = window.NotionNotes;
    if (!nn || !nn.applyTextFormat) return;
    const target = locate(ctx, { word: false });
    if (target) {
      target.select();
      announce(`Buscando ${target.text}`);
    }
    // Sin cita cerca del cursor, se abre la ventana «Buscar versículo», como el botón.
    nn.applyTextFormat('scripture');
  }

  function runWol(ctx, lang) {
    const wol = window.WolAssistant;
    if (!wol) { announce('El panel de la WOL no está disponible.'); return; }
    const target = locate(ctx, { word: true });
    if (!target) { wol.openPanel(); announce('Panel de la WOL abierto. Escribe lo que quieres buscar.'); return; }
    const ok = wol.searchText(target.text, lang);
    announce(ok ? `Buscando «${target.text}» en la WOL` : 'El navegador bloqueó la ventana. Permite las ventanas emergentes para esta página.');
  }

  function runCustomSearch(ctx, def) {
    const target = locate(ctx, { word: true });
    if (!target) { announce(`Selecciona o coloca el cursor sobre una palabra para buscar con «${def.label}».`); return; }
    const url = def.url.replace(/\{q\}/g, encodeURIComponent(target.text));
    const w = window.open(url, '_blank');
    if (w) { try { w.opener = null; } catch (e) {} announce(`Buscando «${target.text}» con ${def.label}`); }
    else announce('El navegador bloqueó la ventana. Permite las ventanas emergentes para esta página.');
  }

  // ======================================================================
  //  Aviso para lectores de pantalla
  // ======================================================================
  let live = null;
  function announce(msg) {
    if (!live) {
      live = document.createElement('div');
      live.setAttribute('role', 'status');
      live.setAttribute('aria-live', 'polite');
      live.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;';
      document.body.appendChild(live);
    }
    live.textContent = '';
    setTimeout(() => { live.textContent = msg; }, 30);
  }

  // ======================================================================
  //  Teclado
  // ======================================================================
  function onKeyDown(e) {
    if (e.repeat || e.isComposing) return;
    if (e.target && e.target.classList && e.target.classList.contains('sc-input')) return; // grabando un atajo nuevo
    const combo = comboFromEvent(e);
    if (!combo) return;
    const id = comboIndex.get(combo);
    if (!id) return;
    const action = allActions().find(a => a.id === id);
    if (!action) return;
    const ctx = getContext();
    if (action.editorOnly && !ctx) return; // fuera del apunte no se toca la tecla
    e.preventDefault();
    e.stopPropagation();
    try { action.run(ctx, e); } catch (err) {
      console.warn('[Atajos] Error en «' + action.label + '»:', err);
      announce('No se pudo ejecutar el atajo.');
    }
  }

  // ======================================================================
  //  Pistas en la barra de herramientas (título + aria-keyshortcuts)
  // ======================================================================
  function updateHints() {
    const actions = allActions();
    document.querySelectorAll('[data-format]').forEach(btn => {
      const a = actions.find(x => x.format === btn.dataset.format);
      applyHint(btn, a ? comboOf(a) : '');
    });
    const wolBtn = document.getElementById('btnWolAssistant');
    if (wolBtn) applyHint(wolBtn, comboOf(actions.find(x => x.id === 'wol-panel')));
  }
  function applyHint(btn, combo) {
    if (btn.dataset.baseTitle === undefined) btn.dataset.baseTitle = btn.getAttribute('title') || '';
    const base = btn.dataset.baseTitle;
    if (combo) {
      btn.setAttribute('title', base ? `${base} (${combo})` : combo);
      btn.setAttribute('aria-keyshortcuts', toAriaShortcut(combo));
    } else {
      if (base) btn.setAttribute('title', base); else btn.removeAttribute('title');
      btn.removeAttribute('aria-keyshortcuts');
    }
  }

  // ======================================================================
  //  Pantalla de ajustes
  // ======================================================================
  let statusEl = null;
  function setStatus(msg) { if (statusEl) statusEl.textContent = msg || ''; }
  function mk(tag, attrs, text) {
    const n = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => { if (k === 'class') n.className = v; else n.setAttribute(k, v); });
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function renderSettings(focusId) {
    const root = document.getElementById('shortcutsSettings');
    if (!root) return;
    root.textContent = '';

    root.appendChild(mk('p', { class: 'form-help', id: 'scHelp' },
      'Para cambiar un atajo, haz clic en su campo y haz una de estas dos cosas: ' +
      '(1) pulsa la combinación nueva (Ctrl, Alt o Meta junto con una letra, número o tecla F), o ' +
      '(2) escríbela con texto, por ejemplo Alt+Shift+G, y pulsa Intro. ' +
      'Para quitarlo, usa el botón «Quitar». Se guarda al instante, solo en este dispositivo. ' +
      'Con el cursor dentro de una cita como «Mateo 4:5» no hace falta seleccionarla.'));

    const actions = allActions();
    const groups = [];
    actions.forEach(a => { if (!groups.includes(a.group)) groups.push(a.group); });

    groups.forEach(g => {
      const wrap = mk('div', { class: 'sc-group', role: 'group', 'aria-label': g });
      wrap.appendChild(mk('h4', { class: 'sc-group-title' }, g));
      actions.filter(a => a.group === g).forEach(a => wrap.appendChild(buildRow(a)));
      root.appendChild(wrap);
    });

    if (!actions.some(a => a.custom)) {
      const wrap = mk('div', { class: 'sc-group', role: 'group', 'aria-label': 'Mis búsquedas' });
      wrap.appendChild(mk('h4', { class: 'sc-group-title' }, 'Mis búsquedas'));
      wrap.appendChild(mk('p', { class: 'form-help' }, 'Aún no has añadido ninguna.'));
      root.appendChild(wrap);
    }

    root.appendChild(buildCustomForm());

    const reset = mk('button', { type: 'button', class: 'btn-secondary btn-sm sc-reset' }, 'Restablecer atajos predeterminados');
    reset.addEventListener('click', () => {
      state.bindings = {};
      saveState(); rebuildIndex(); updateHints(); renderSettings();
      setStatus('Atajos predeterminados restablecidos.');
    });
    root.appendChild(reset);

    statusEl = mk('div', { class: 'sc-status', role: 'status', 'aria-live': 'polite' });
    root.appendChild(statusEl);

    if (focusId) { const f = document.getElementById('sc-in-' + focusId); if (f) f.focus(); }
  }

  function buildRow(a) {
    const row = mk('div', { class: 'sc-row' });
    row.appendChild(mk('label', { class: 'sc-label', for: 'sc-in-' + a.id }, a.label));
    const input = mk('input', { type: 'text', class: 'form-input sc-input', id: 'sc-in-' + a.id, 'aria-describedby': 'scHelp', autocomplete: 'off', spellcheck: 'false' });
    input.value = comboOf(a) || 'Sin atajo';
    input.dataset.shown = input.value;
    input.addEventListener('keydown', (e) => onCaptureKey(e, a));
    input.addEventListener('focus', () => { try { input.select(); } catch (e) {} });
    input.addEventListener('change', () => commitTyped(a, input, true));
    row.appendChild(input);

    const rm = mk('button', { type: 'button', class: 'btn-ghost btn-sm', 'aria-label': `Quitar el atajo de ${a.label}` }, 'Quitar');
    rm.addEventListener('click', () => {
      setCombo(a, '');
      renderSettings(a.id);
      setStatus(`Atajo de «${a.label}» quitado.`);
    });
    row.appendChild(rm);

    if (a.custom) {
      const del = mk('button', { type: 'button', class: 'btn-ghost btn-sm', 'aria-label': `Eliminar la búsqueda ${a.label}` }, 'Eliminar');
      del.addEventListener('click', () => {
        state.custom = state.custom.filter(c => c.id !== a.id);
        saveState(); rebuildIndex(); renderSettings();
        setStatus(`Búsqueda «${a.label}» eliminada.`);
      });
      row.appendChild(del);
    }
    return row;
  }

  /** Convierte texto escrito («ctrl + alt + g», «Mayús+Alt+V»…) en «Ctrl+Alt+G», o null. */
  function parseCombo(text) {
    const t = String(text || '').trim();
    if (!t) return '';
    const MODS = { ctrl: 'Ctrl', control: 'Ctrl', ctl: 'Ctrl', alt: 'Alt', opcion: 'Alt', option: 'Alt', shift: 'Shift', mayus: 'Shift', mayusc: 'Shift', mayusculas: 'Shift', meta: 'Meta', win: 'Meta', windows: 'Meta', cmd: 'Meta', command: 'Meta' };
    const norm = (x) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f.]/g, '');
    const parts = t.split(/\s*\+\s*|\s+/).filter(Boolean);
    const mods = new Set();
    let key = null;
    for (const raw of parts) {
      const m = MODS[norm(raw)];
      if (m) { mods.add(m); continue; }
      if (key) return null;
      if (/^[a-z0-9]$/i.test(raw)) key = raw.toUpperCase();
      else if (/^f([1-9]|1[0-2])$/i.test(raw)) key = raw.toUpperCase();
      else if (Object.values(PUNCT).includes(raw)) key = raw;
      else return null;
    }
    if (!key) return null;
    if (!(mods.has('Ctrl') || mods.has('Alt') || mods.has('Meta')) && !/^F\d/.test(key)) return null;
    return ['Ctrl', 'Alt', 'Shift', 'Meta'].filter(x => mods.has(x)).concat(key).join('+');
  }

  /** Valida y guarda una combinación nueva para una acción. */
  function assignCombo(action, combo, opts) {
    const focusId = opts && opts.quiet ? undefined : action.id;
    const draw = () => { if (!(opts && opts.noRender)) renderSettings(focusId); };
    const fail = (msg) => { setStatus(msg); announce(msg); return false; };
    if (combo === '') {
      setCombo(action, '');
      draw();
      setStatus(`Atajo de «${action.label}» quitado.`);
      announce(`Atajo de ${action.label} quitado.`);
      return true;
    }
    if (RESERVED.has(combo)) return fail(`${combo} ya lo usa el navegador o la app. Prueba otra combinación.`);
    const other = comboIndex.get(combo);
    if (other && other !== action.id) {
      const o = allActions().find(x => x.id === other);
      return fail(`${combo} ya está asignado a «${o ? o.label : other}». Quítalo allí primero.`);
    }
    setCombo(action, combo);
    draw();
    setStatus(`«${action.label}»: ${combo}`);
    announce(`Atajo guardado: ${action.label}, ${combo}.`);
    return true;
  }

  /** Guarda lo que haya escrito en un campo (al salir de él o al guardar Ajustes). */
  function commitTyped(action, input, quiet) {
    if (!input.isConnected) return;
    const typed = input.value.trim();
    if (typed === (input.dataset.shown || '') || typed === 'Sin atajo') return;
    const combo = parseCombo(typed);
    if (combo === null) {
      const msg = `No entiendo «${typed}» para ${action.label}. Escribe algo como Alt+Shift+G.`;
      setStatus(msg); announce(msg);
      return;
    }
    assignCombo(action, combo, { quiet });
  }

  /** Guarda todos los campos con texto escrito y sin confirmar. */
  function commitPending() {
    const root = document.getElementById('shortcutsSettings');
    if (!root) return;
    const pending = [...root.querySelectorAll('.sc-input')]
      .filter(i => i.value.trim() !== (i.dataset.shown || '') && i.value.trim() !== 'Sin atajo')
      .map(i => ({ action: allActions().find(a => 'sc-in-' + a.id === i.id), typed: i.value.trim() }))
      .filter(x => x.action);
    if (!pending.length) return;
    pending.forEach(({ action, typed }) => {
      const combo = parseCombo(typed);
      if (combo === null) { const msg = `No entiendo «${typed}» para ${action.label}.`; setStatus(msg); announce(msg); return; }
      assignCombo(action, combo, { quiet: true, noRender: true });
    });
    renderSettings();
  }

  function onCaptureKey(e, action) {
    const input = e.target;
    if (['Tab', 'Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
    if (e.key === 'Escape') { input.value = input.dataset.shown || ''; return; }
    if (e.key === 'Enter') {
      e.preventDefault(); // no enviar el formulario de Ajustes
      const typed = input.value.trim();
      if (typed === 'Sin atajo') return;
      const combo = parseCombo(typed);
      if (combo === null) { setStatus('No entiendo «' + typed + '». Escribe algo como Alt+Shift+G o Ctrl+Alt+7.'); return; }
      assignCombo(action, combo);
      return;
    }
    // Combinación pulsada directamente
    if (!(e.ctrlKey || e.altKey || e.metaKey) && !/^F\d/.test(e.key)) return; // texto normal: se escribe en el campo
    e.preventDefault();
    const combo = comboFromEvent(e);
    if (!combo) { setStatus('Esa tecla no se puede usar. Prueba con una letra, un número o una tecla F.'); return; }
    assignCombo(action, combo);
  }

  function buildCustomForm() {
    const box = mk('div', { class: 'sc-custom', role: 'group', 'aria-label': 'Añadir búsqueda propia' });
    box.appendChild(mk('h4', { class: 'sc-group-title' }, 'Añadir una búsqueda propia'));
    const name = mk('input', { type: 'text', class: 'form-input', id: 'scCustomName', placeholder: 'Ej.: Biblioteca en línea', autocomplete: 'off' });
    const url = mk('input', { type: 'text', class: 'form-input', id: 'scCustomUrl', placeholder: 'https://wol.jw.org/es/wol/s/r4/lp-s?q={q}', autocomplete: 'off', inputmode: 'url' });
    const l1 = mk('label', { class: 'form-label', for: 'scCustomName' }, 'Nombre');
    const l2 = mk('label', { class: 'form-label', for: 'scCustomUrl' }, 'Dirección de búsqueda (usa {q} donde va el texto)');
    const add = mk('button', { type: 'button', class: 'btn-secondary btn-sm' }, 'Añadir búsqueda');
    add.addEventListener('click', () => {
      const label = name.value.trim();
      const u = url.value.trim();
      if (!label) { setStatus('Escribe un nombre para la búsqueda.'); name.focus(); return; }
      if (!/^https:\/\//i.test(u) || !u.includes('{q}')) { setStatus('La dirección debe empezar por https:// y contener {q}.'); url.focus(); return; }
      const id = 'custom:' + Date.now().toString(36);
      state.custom.push({ id, label, url: u, combo: '' });
      saveState(); rebuildIndex();
      renderSettings(id);
      setStatus(`Búsqueda «${label}» añadida. Asígnale un atajo en su campo.`);
    });
    [l1, name, l2, url, add].forEach(n => box.appendChild(n));
    return box;
  }

  // ======================================================================
  //  Inicio
  // ======================================================================
  function init() {
    loadState();
    rebuildIndex();
    window.addEventListener('keydown', onKeyDown, true);
    updateHints();
    renderSettings();
    const form = document.getElementById('configForm');
    if (form) form.addEventListener('submit', commitPending, true); // antes de que Ajustes se cierre
    const cfg = document.getElementById('configModal');
    if (cfg) new MutationObserver(() => { if (cfg.classList.contains('active')) renderSettings(); })
      .observe(cfg, { attributes: true, attributeFilter: ['class'] });
  }
  function safeInit() { try { init(); } catch (e) { console.warn('[Atajos] No se pudo iniciar:', e); } }

  const api = { findReferences, pickReference, wordAt, comboFromEvent, parseCombo, toAriaShortcut, resolveTarget, richInfo, selectRich };
  if (typeof window !== 'undefined') window.EPShortcuts = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', safeInit);
    else safeInit();
  }
})();
