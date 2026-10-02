/**
 * Panel lateral «WOL»
 * ---------------------------------------------------------------------------
 * 1) Buscar en la WOL: escribe un texto, un tema o una cita y se abre la
 *    Biblioteca en línea Watchtower en una ventana al lado (español o inglés).
 *    (La WOL no permite mostrarse dentro de otras páginas; por eso se usa una ventana.)
 * 2) Preguntar a Copilot: encabezado fijo «solo WOL» + tu texto; se copia y se abre
 *    Copilot (app de Windows o ventana al lado).
 * No usa claves ni cuotas. Archivo independiente: si fallara, la app sigue igual.
 */
(function () {
  'use strict';

  const WOL_SITES = {
    es: { home: 'https://wol.jw.org/es/wol/h/r4/lp-s', search: 'https://wol.jw.org/es/wol/s/r4/lp-s?q=' },
    en: { home: 'https://wol.jw.org/en/wol/h/r1/lp-e', search: 'https://wol.jw.org/en/wol/s/r1/lp-e?q=' }
  };
  const COPILOT_HEADER = 'Search only content from WOL in jw.org (https://wol.jw.org).';
  const COPILOT_APP = 'ms-copilot:';
  const COPILOT_WEB = 'https://copilot.microsoft.com/';
  const IS_WINDOWS = /Windows/i.test(navigator.userAgent);

  let editor, panel, btn, lastRange = null;
  let wolInput, cpText, statusEl;

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
  function selectedText() {
    return lastRange && !lastRange.collapsed && editor.contains(lastRange.startContainer) ? lastRange.toString().trim() : '';
  }
  function currentParagraph() {
    if (!lastRange || !editor.contains(lastRange.startContainer)) return '';
    let n = lastRange.startContainer;
    if (n === editor) n = editor.childNodes[Math.max(0, lastRange.startOffset - 1)];
    else {
      n = n.nodeType === Node.TEXT_NODE ? n.parentNode : n;
      while (n && n.parentNode !== editor) n = n.parentNode;
    }
    while (n && !(n.textContent || '').trim()) n = n.previousSibling;
    return n ? (n.textContent || '').trim() : '';
  }

  // ---------- ventanas al lado ----------
  /** Abre (o reutiliza) una ventana en la mitad derecha de la pantalla. */
  function openSide(url, name) {
    const sw = (screen && screen.availWidth) || 1280;
    const sh = (screen && screen.availHeight) || 800;
    const left = (screen && screen.availLeft) || 0;
    const w = Math.max(420, Math.round(sw / 2));
    const win = window.open(url, name, `popup=yes,width=${w},height=${sh},left=${left + sw - w},top=0`);
    if (win) {
      try { win.moveTo(left + sw - w, 0); win.resizeTo(w, sh); } catch (e) { /* algunos navegadores no lo permiten */ }
      try { win.focus(); } catch (e) {}
      return true;
    }
    return !!window.open(url, '_blank', 'noopener');
  }

  // ---------- WOL ----------
  function searchWol(lang) {
    const q = wolInput.value.trim();
    const site = WOL_SITES[lang];
    const url = q ? site.search + encodeURIComponent(q) : site.home;
    try { localStorage.setItem('wol_lang', lang); } catch (e) {}
    const ok = openSide(url, 'wolSideWindow');
    setStatus(ok
      ? (lang === 'en' ? 'Opened the WOL in English beside your notes.' : 'WOL abierta en español al lado de tu apunte.')
      : 'El navegador bloqueó la ventana. Permite las ventanas emergentes para esta página.', ok ? 'ok' : 'error');
  }

  // ---------- Copilot ----------
  function copyText(text) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.top = '0'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    if (!ok && navigator.clipboard) { navigator.clipboard.writeText(text).catch(() => {}); ok = true; }
    return ok;
  }
  function copilotQuestion() {
    const body = cpText.value.trim();
    if (!body) { setStatus('Escribe tu pregunta o el texto para Copilot.', 'error'); cpText.focus(); return null; }
    return copyText(`${COPILOT_HEADER}\n\n${body}`);
  }
  function copilotSide() {
    const copied = copilotQuestion();
    if (copied === null) return;
    openSide(COPILOT_WEB, 'copilotSideWindow');
    setStatus(copied ? 'Pregunta copiada. En la ventana de Copilot, pégala (Ctrl+V) y envíala.' : 'No se pudo copiar la pregunta automáticamente.', copied ? 'ok' : 'error');
  }
  function copilotApp() {
    const copied = copilotQuestion();
    if (copied === null) return;
    setStatus(copied ? 'Pregunta copiada. En la app de Copilot, pégala (Ctrl+V). Si la app no se abre, usa «Copilot al lado».' : 'No se pudo copiar la pregunta automáticamente.', copied ? 'ok' : 'error');
    try { window.location.href = COPILOT_APP; } catch (e) {}
  }

  // ---------- panel ----------
  function setStatus(msg, kind) { statusEl.textContent = msg || ''; statusEl.className = 'wolp-status' + (kind ? ' ' + kind : ''); }

  function showTab(name) {
    panel.querySelectorAll('.wolp-tab').forEach(t => {
      const on = t.dataset.tab === name;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    panel.querySelectorAll('.wolp-section').forEach(s => { s.hidden = s.dataset.section !== name; });
    setStatus('');
    setTimeout(() => (name === 'wol' ? wolInput : cpText).focus(), 30);
  }

  function buildUi() {
    const anchor = document.getElementById('btnRunAiAssist');
    btn = el('button', { type: 'button', id: 'btnWolAssistant', class: 'btn-ai-single wol-open-btn', title: 'Buscar en la WOL o preguntar a Copilot', 'aria-expanded': 'false' });
    btn.innerHTML = '<span aria-hidden="true">📚</span><span>WOL</span>';
    btn.addEventListener('mousedown', e => e.preventDefault()); // conservar la selección del apunte
    btn.addEventListener('click', togglePanel);
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(btn, anchor.nextSibling);
    else { const end = document.querySelector('.toolbar-end'); if (end) end.appendChild(btn); }

    panel = el('aside', { id: 'wolPanel', class: 'wolp', 'aria-label': 'WOL y Copilot' });
    panel.innerHTML = `
      <div class="wolp-head">
        <div class="wolp-tabs" role="tablist">
          <button type="button" class="wolp-tab active" role="tab" data-tab="wol" aria-selected="true">📚 Buscar en la WOL</button>
          <button type="button" class="wolp-tab" role="tab" data-tab="copilot" aria-selected="false">💬 Copilot</button>
        </div>
        <button type="button" class="wolp-close" aria-label="Cerrar">✕</button>
      </div>

      <div class="wolp-section" data-section="wol">
        <label class="wolp-label" for="wolpInput">Texto, tema o cita bíblica</label>
        <textarea id="wolpInput" class="wolp-field" rows="3" placeholder="Ej.: Juan 3:16 · perseverancia · la fe de Jacob"></textarea>
        <div class="wolp-row">
          <button type="button" class="wolp-primary" data-lang="es">Buscar en español</button>
          <button type="button" class="wolp-primary" data-lang="en">Search in English</button>
        </div>
        <p class="wolp-help">La WOL se abre en una ventana a la derecha de la pantalla, junto a tu apunte. Cada búsqueda nueva usa la misma ventana. (La WOL no permite mostrarse dentro de otras páginas.)</p>
      </div>

      <div class="wolp-section" data-section="copilot" hidden>
        <div class="wolp-label">Encabezado (siempre el mismo)</div>
        <div class="wolp-fixed"></div>
        <label class="wolp-label" for="wolpCopilot">Tu pregunta o texto</label>
        <textarea id="wolpCopilot" class="wolp-field" rows="6" placeholder="Escribe aquí, o selecciona una frase en tu apunte antes de abrir el panel."></textarea>
        <div class="wolp-row">
          <button type="button" class="wolp-primary wolp-cp-side">Copilot al lado</button>
          <button type="button" class="wolp-secondary wolp-cp-app">App de Copilot</button>
        </div>
        <p class="wolp-help">La pregunta (encabezado + tu texto) se copia sola. En Copilot solo tienes que pegarla con Ctrl+V.</p>
      </div>

      <div class="wolp-status" role="status" aria-live="polite"></div>`;
    document.body.appendChild(panel);

    wolInput = panel.querySelector('#wolpInput');
    cpText = panel.querySelector('#wolpCopilot');
    statusEl = panel.querySelector('.wolp-status');
    panel.querySelector('.wolp-fixed').textContent = COPILOT_HEADER;

    panel.querySelectorAll('.wolp-tab').forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));
    panel.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => searchWol(b.dataset.lang)));
    panel.querySelector('.wolp-cp-side').addEventListener('click', copilotSide);
    const appBtn = panel.querySelector('.wolp-cp-app');
    appBtn.addEventListener('click', copilotApp);
    if (!IS_WINDOWS) appBtn.hidden = true;
    panel.querySelector('.wolp-close').addEventListener('click', togglePanel);

    wolInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        let lang = 'es';
        try { lang = localStorage.getItem('wol_lang') === 'en' ? 'en' : 'es'; } catch (err) {}
        searchWol(lang);
      }
    });
    cpText.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) copilotSide(); });
    panel.addEventListener('keydown', e => { if (e.key === 'Escape') togglePanel(); });
  }

  function togglePanel() {
    const open = !panel.classList.contains('open');
    if (open) {
      rememberRange();
      const sel = selectedText();
      if (sel) wolInput.value = sel.slice(0, 300);
      const forCopilot = sel || currentParagraph();
      if (forCopilot) cpText.value = forCopilot;
      setStatus('');
    }
    panel.classList.toggle('open', open);
    document.body.classList.toggle('wolp-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) setTimeout(() => (panel.querySelector('.wolp-tab.active').dataset.tab === 'wol' ? wolInput : cpText).focus(), 60);
  }

  // ---------- inicio ----------
  function init() {
    editor = document.getElementById('noteRichEditor');
    if (!editor || document.getElementById('wolPanel')) return;
    buildUi();
    document.addEventListener('selectionchange', rememberRange);
  }
  function safeInit() { try { init(); } catch (e) { console.warn('[WOL] No se pudo iniciar el panel:', e); } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', safeInit);
  else safeInit();
})();
