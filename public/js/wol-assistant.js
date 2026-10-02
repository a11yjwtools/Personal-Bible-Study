/**
 * Preguntar a Copilot (WOL)
 * ---------------------------------------------------------------------------
 * Abre una ventana con un encabezado FIJO que pide a Copilot buscar solo en la WOL,
 * y debajo el texto que estás escribiendo (o lo que quieras escribir).
 * Al pulsar «Abrir Copilot», la pregunta completa se copia y se abre la app de Copilot
 * instalada en Windows (o Copilot en el navegador). Allí solo hay que pegar (Ctrl+V).
 *
 * No usa ninguna clave ni cuota. Archivo independiente: si fallara, la app sigue igual.
 */
(function () {
  'use strict';

  // Encabezado que siempre se envía igual (no editable en la ventana)
  const HEADER = 'Search only content from WOL in jw.org (https://wol.jw.org).';
  const COPILOT_APP = 'ms-copilot:';                  // app de Copilot en Windows
  const COPILOT_WEB = 'https://copilot.microsoft.com/'; // respaldo: navegador o app del móvil

  let editor, modal, textBox, statusEl, webBtn;
  let lastRange = null;
  let wolBtn, wolPanel, wolInput, wolLang, wolFrame, wolEmpty;

  function el(tag, attrs, text) {
    const n = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => { if (k === 'class') n.className = v; else n.setAttribute(k, v); });
    if (text !== undefined) n.textContent = text;
    return n;
  }

  // ---------- texto del apunte ----------
  function rememberRange() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) lastRange = sel.getRangeAt(0).cloneRange();
  }

  /** Lo seleccionado; si no hay selección, el párrafo donde está el cursor. */
  function textFromNote() {
    if (lastRange && !lastRange.collapsed && editor.contains(lastRange.startContainer)) {
      const t = lastRange.toString().trim();
      if (t) return t;
    }
    if (lastRange && editor.contains(lastRange.startContainer)) {
      let n = lastRange.startContainer;
      if (n === editor) n = editor.childNodes[Math.max(0, lastRange.startOffset - 1)];
      else {
        n = n.nodeType === Node.TEXT_NODE ? n.parentNode : n;
        while (n && n.parentNode !== editor) n = n.parentNode;
      }
      // el párrafo actual, o el anterior con texto si está vacío
      while (n && !(n.textContent || '').trim()) n = n.previousSibling;
      if (n && (n.textContent || '').trim()) return n.textContent.trim();
    }
    return '';
  }

  // ---------- copiar y abrir ----------
  function copyText(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.top = '0'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    if (!ok && navigator.clipboard) { navigator.clipboard.writeText(text).catch(() => {}); ok = true; }
    return ok;
  }

  function fullQuestion() {
    return `${HEADER}\n\n${textBox.value.trim()}`;
  }

  const IS_WINDOWS = /Windows/i.test(navigator.userAgent);
  const PASTE_HINT = 'En Copilot, pega la pregunta (Ctrl+V) y envíala.';

  function prepare() {
    if (!textBox.value.trim()) {
      setStatus('Escribe tu pregunta o el texto sobre el que quieres información.', 'error');
      textBox.focus();
      return null;
    }
    return copyText(fullQuestion());
  }

  /** Abre la app de Copilot instalada en Windows. */
  function openApp() {
    const copied = prepare();
    if (copied === null) return;
    setStatus(copied
      ? `Pregunta copiada. Abriendo la app de Copilot… ${PASTE_HINT} Si no se abre, usa «En el navegador».`
      : 'No se pudo copiar automáticamente. Selecciona el texto, cópialo y ábrelo en Copilot.', copied ? 'ok' : 'error');
    try { window.location.href = COPILOT_APP; } catch (e) { /* ignorar */ }
  }

  /** Abre Copilot en el navegador (en el móvil puede abrirse la app de Copilot). */
  function openWeb() {
    const copied = prepare();
    if (copied === null) return;
    const w = window.open(COPILOT_WEB, '_blank', 'noopener');
    setStatus(copied ? `Pregunta copiada. ${PASTE_HINT}` : 'No se pudo copiar automáticamente la pregunta.', copied ? 'ok' : 'error');
    if (w === null && !copied) setStatus('Abre copilot.microsoft.com y pega la pregunta.', 'error');
  }

  // ---------- ventana ----------
  function setStatus(msg, kind) { statusEl.textContent = msg || ''; statusEl.className = 'cwol-status' + (kind ? ' ' + kind : ''); }

  function buildUi() {
    const anchor = document.getElementById('btnRunAiAssist');
    const btn = el('button', { type: 'button', id: 'btnWolAssistant', class: 'btn-ai-single wol-open-btn', title: 'Buscar en la Biblioteca en línea Watchtower', 'aria-expanded': 'false' });
    btn.innerHTML = '<span aria-hidden="true">📚</span><span>WOL</span>';
    btn.addEventListener('mousedown', e => e.preventDefault()); // conservar la selección del apunte
    btn.addEventListener('click', toggleWolPanel);
    wolBtn = btn;
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(btn, anchor.nextSibling);
    else { const end = document.querySelector('.toolbar-end'); if (end) end.appendChild(btn); }

    modal = el('div', { id: 'copilotWolModal', class: 'modal-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'cwolTitle' });
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <div id="cwolTitle" class="modal-title">📚 Preguntar a Copilot</div>
          <button type="button" class="modal-close cwol-close" aria-label="Cerrar">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <div class="form-label">Encabezado (siempre el mismo)</div>
            <div class="cwol-header"></div>
          </div>
          <div class="form-group">
            <label class="form-label" for="cwolText">Tu pregunta o texto</label>
            <textarea id="cwolText" class="form-input cwol-text" rows="6" placeholder="Escribe aquí, o selecciona una frase en tu apunte antes de abrir esta ventana."></textarea>
            <div class="form-help">Se rellena con la frase seleccionada o el párrafo donde estabas escribiendo. Puedes cambiarlo.</div>
          </div>
          <div class="cwol-status" role="status" aria-live="polite"></div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-secondary cwol-cancel">Cancelar</button>
          <button type="button" class="btn-secondary cwol-web">En el navegador</button>
          <button type="button" class="btn-primary cwol-app">Abrir app de Copilot</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('.cwol-header').textContent = HEADER;
    textBox = modal.querySelector('.cwol-text');
    statusEl = modal.querySelector('.cwol-status');
    webBtn = modal.querySelector('.cwol-web');
    modal.querySelector('.cwol-close').addEventListener('click', closeModal);
    modal.querySelector('.cwol-cancel').addEventListener('click', closeModal);
    const appBtn = modal.querySelector('.cwol-app');
    appBtn.addEventListener('click', openApp);
    webBtn.addEventListener('click', openWeb);
    if (!IS_WINDOWS) {
      // Sin Windows no hay app de escritorio: el navegador es la opción principal
      appBtn.hidden = true;
      webBtn.className = 'btn-primary cwol-web';
      webBtn.textContent = 'Abrir Copilot';
    }
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    modal.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeModal();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) (IS_WINDOWS ? openApp : openWeb)();
    });
  }

  function openModal() {
    rememberRange();
    textBox.value = textFromNote();
    setStatus('');
    modal.classList.add('active');
    setTimeout(() => { textBox.focus(); textBox.setSelectionRange(textBox.value.length, textBox.value.length); }, 50);
  }
  function closeModal() { modal.classList.remove('active'); }

  // ---------- Panel de la WOL ----------
  const WOL_SITES = {
    es: { home: 'https://wol.jw.org/es/wol/h/r4/lp-s', search: 'https://wol.jw.org/es/wol/s/r4/lp-s?q=' },
    en: { home: 'https://wol.jw.org/en/wol/h/r1/lp-e', search: 'https://wol.jw.org/en/wol/s/r1/lp-e?q=' }
  };

  function wolUrl(query) {
    const site = WOL_SITES[wolLang.value] || WOL_SITES.es;
    const q = String(query || '').trim();
    return q ? site.search + encodeURIComponent(q) : site.home;
  }

  function buildWolPanel() {
    wolPanel = el('aside', { id: 'wolPanel', class: 'wolp', 'aria-label': 'Biblioteca en línea Watchtower' });
    wolPanel.innerHTML = `
      <div class="wolp-head">
        <div class="wolp-title">📚 Biblioteca en línea</div>
        <div class="wolp-head-actions">
          <button type="button" class="wolp-btn wolp-copilot" title="Preguntar a Copilot (solo WOL)">Copilot</button>
          <button type="button" class="wolp-btn wolp-side" title="Abrir la WOL en una ventana al lado">Abrir al lado ↗</button>
          <button type="button" class="wolp-close" aria-label="Cerrar">✕</button>
        </div>
      </div>
      <form class="wolp-search" role="search">
        <input type="search" class="wolp-input" placeholder="Texto, tema o cita (ej.: Juan 3:16)" aria-label="Buscar en la WOL" enterkeyhint="search">
        <select class="wolp-lang" aria-label="Idioma de la WOL">
          <option value="es">ES</option>
          <option value="en">EN</option>
        </select>
        <button type="submit" class="wolp-go">Buscar</button>
      </form>
      <div class="wolp-body">
        <div class="wolp-empty">Escribe un texto o una cita bíblica y pulsa <b>Buscar</b>.<br>Consejo: selecciona una frase en tu apunte antes de abrir este panel y aparecerá aquí.</div>
        <iframe class="wolp-frame" title="Biblioteca en línea Watchtower" referrerpolicy="no-referrer" hidden></iframe>
      </div>
      <div class="wolp-foot">¿La WOL no se muestra aquí? Pulsa <b>Abrir al lado ↗</b> para verla en una ventana junto a tu apunte.</div>`;
    document.body.appendChild(wolPanel);

    wolInput = wolPanel.querySelector('.wolp-input');
    wolLang = wolPanel.querySelector('.wolp-lang');
    wolFrame = wolPanel.querySelector('.wolp-frame');
    wolEmpty = wolPanel.querySelector('.wolp-empty');
    try { const l = localStorage.getItem('wol_lang'); if (l === 'en' || l === 'es') wolLang.value = l; } catch (e) {}
    wolLang.addEventListener('change', () => { try { localStorage.setItem('wol_lang', wolLang.value); } catch (e) {} });

    wolPanel.querySelector('.wolp-search').addEventListener('submit', e => { e.preventDefault(); searchInPanel(); });
    wolPanel.querySelector('.wolp-side').addEventListener('click', openSideWindow);
    wolPanel.querySelector('.wolp-close').addEventListener('click', toggleWolPanel);
    wolPanel.querySelector('.wolp-copilot').addEventListener('click', () => {
      // Lleva el texto del buscador a la ventana de Copilot
      openModal();
      if (wolInput.value.trim()) textBox.value = wolInput.value.trim();
    });
    wolPanel.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.classList.contains('active')) toggleWolPanel(); });
  }

  function searchInPanel() {
    const url = wolUrl(wolInput.value);
    wolEmpty.hidden = true;
    wolFrame.hidden = false;
    wolFrame.src = url;
  }

  /** Abre (o reutiliza) una ventana de la WOL a la derecha de la pantalla. */
  function openSideWindow() {
    const url = wolUrl(wolInput.value);
    const sw = (window.screen && window.screen.availWidth) || 1280;
    const sh = (window.screen && window.screen.availHeight) || 800;
    const w = Math.max(420, Math.round(sw * 0.45));
    const features = `popup=yes,width=${w},height=${sh},left=${sw - w},top=0`;
    const win = window.open(url, 'wolSideWindow', features);
    if (win) { try { win.focus(); } catch (e) {} }
    else window.open(url, '_blank', 'noopener');
  }

  function toggleWolPanel() {
    const open = !wolPanel.classList.contains('open');
    if (open) {
      rememberRange();
      const sel = lastRange && !lastRange.collapsed ? lastRange.toString().trim() : '';
      if (sel) wolInput.value = sel.slice(0, 200);
      if (/\b(the|and|of|is)\b/i.test(sel) && !/[áéíóúñ]/i.test(sel)) wolLang.value = 'en';
    }
    wolPanel.classList.toggle('open', open);
    document.body.classList.toggle('wolp-open', open);
    wolBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      setTimeout(() => wolInput.focus(), 60);
      if (wolInput.value.trim()) searchInPanel();
    }
  }

  // ---------- inicio ----------
  function init() {
    editor = document.getElementById('noteRichEditor');
    if (!editor || document.getElementById('copilotWolModal')) return;
    buildUi();
    buildWolPanel();
    document.addEventListener('selectionchange', rememberRange);
  }
  function safeInit() { try { init(); } catch (e) { console.warn('[Copilot WOL] No se pudo iniciar:', e); } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', safeInit);
  else safeInit();
})();
