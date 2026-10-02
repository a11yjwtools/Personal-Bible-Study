/**
 * Sugerencias de la Biblioteca en línea Watchtower (wol.jw.org) — versión para el navegador
 * ------------------------------------------------------------------------------------------
 * No necesita servidor: llama a Gemini directamente con la clave guardada en
 * Ajustes → Inteligencia artificial (la misma que usa «Revisar con IA").
 * Gemini busca y lee en wol.jw.org con sus propias herramientas y redacta comentarios breves.
 *
 * Salvaguarda: solo se muestran sugerencias si Gemini informa que usó páginas de jw.org;
 * las respaldadas únicamente por otros sitios se descartan.
 * Archivo independiente: si fallara, el resto de la app sigue funcionando igual.
 */
(function () {
  'use strict';

  // Primero los modelos Flash completos (manejan mejor la búsqueda); luego los «lite».
  // En el nivel gratuito de Gemini, la búsqueda de Google solo está incluida en los modelos 2.5 Flash;
  // por eso se prueban primero. Los demás quedan como respaldo para cuentas con facturación.
  const MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest', 'gemini-3.6-flash'];
  const WOL = {
    es: { home: 'https://wol.jw.org/es/wol/h/r4/lp-s', search: 'https://wol.jw.org/es/wol/s/r4/lp-s?q=' },
    en: { home: 'https://wol.jw.org/en/wol/h/r1/lp-e', search: 'https://wol.jw.org/en/wol/s/r1/lp-e?q=' }
  };
  const AUTO_DELAY_MS = 7000;         // pausa al escribir antes de buscar
  const AUTO_MIN_INTERVAL_MS = 45000; // como mucho una búsqueda automática cada 45 s
  const AUTO_MIN_NEW_CHARS = 80;      // texto nuevo mínimo para volver a buscar
  const REQUEST_TIMEOUT_MS = 90000;
  const MAX_CARDS = 12;

  const TYPE_LABELS = {
    punto: '💡 Punto', point: '💡 Point',
    contexto: '🏛️ Contexto', background: '🏛️ Background',
    texto: '📖 Texto', scripture: '📖 Scripture',
    ilustracion: '🖼️ Ilustración', 'ilustración': '🖼️ Ilustración', illustration: '🖼️ Illustration',
    aplicacion: '🎯 Aplicación', 'aplicación': '🎯 Aplicación', application: '🎯 Application'
  };

  const prefs = { auto: readPref('wol_auto', false), includeSource: readPref('wol_source', true) };

  let editor, textarea, drawer, listEl, statusEl, searchBtn, openBtn;
  let lastRange = null, autoTimer = null, lastRequestAt = 0, lastFocusText = '';
  let loading = false, inserting = false, lastInputAt = 0, resultsTitle = '';

  // ---------------- utilidades ----------------
  function readPref(k, def) { try { const v = localStorage.getItem(k); return v === null ? def : v === '1'; } catch (e) { return def; } }
  function writePref(k, v) { try { localStorage.setItem(k, v ? '1' : '0'); } catch (e) {} }
  function el(tag, attrs, text) {
    const n = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => { if (k === 'class') n.className = v; else n.setAttribute(k, v); });
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function getKey() {
    try { if (window.EPEngine && EPEngine.getGeminiKey) return EPEngine.getGeminiKey(); } catch (e) {}
    try { return String(localStorage.getItem('ep_gemini_key') || '').replace(/[\s"']/g, ''); } catch (e) { return ''; }
  }
  function detectLang(text) {
    try { if (window.EPEngine && EPEngine.ai && EPEngine.ai.detectLanguage) return EPEngine.ai.detectLanguage(text) === 'en' ? 'en' : 'es'; } catch (e) {}
    return /\b(the|and|of|with|that)\b/i.test(text) && !/[áéíóúñ¿¡]/i.test(text) ? 'en' : 'es';
  }
  function isJw(s) { return /(^|[\/.\s])(wol\.)?jw\.org/i.test(String(s || '')); }

  // ---------------- Gemini ----------------
  function buildPrompt({ title, tags, context, focus, lang }) {
    const w = WOL[lang];
    const theme = [title, tags].filter(Boolean).join(' — ');
    const searchUrl = w.search + encodeURIComponent((title || focus || '').slice(0, 80));
    if (lang === 'en') {
      return `You are a research assistant for a personal Bible study notebook. The student is writing notes and wants short comments to ADD to them, based ONLY on material from the Watchtower ONLINE LIBRARY (wol.jw.org).

STEPS:
1. Search ONLY the Watchtower ONLINE LIBRARY, with searches like "site:wol.jw.org <topic>". You may also read: ${searchUrl} and ${w.home}
2. Read the most relevant articles, study notes, Insight entries or Research Guide entries.
3. Write 3 short comments (2-3 sentences each) that ENRICH what the student is writing now: a supporting point, background, a related scripture and how it applies, an illustration, or a practical application.

RULES:
- Base every comment strictly on what you actually read on wol.jw.org. Never use other websites. Never invent facts, quotes or references.
- Write in your own words; do not copy sentences (at most a very short phrase).
- Do not repeat ideas the student already wrote.
- If you find nothing relevant on wol.jw.org, return [].
- Write in English.

OUTPUT: only a JSON array, no other text, no code fences:
[{"type":"point|background|scripture|illustration|application","text":"the comment","scripture":"Bible reference or empty","source":"short publication reference, e.g. w23.05 p. 10 par. 7, or the article title"}]

NOTE THEME: ${theme || '(untitled)'}

WHAT THE STUDENT IS WRITING NOW:
${focus || '(see recent notes)'}

RECENT NOTES (context, do not repeat):
${context || '(empty)'}`;
    }
    return `Eres un asistente de investigación para un cuaderno de estudio bíblico personal. El estudiante está escribiendo apuntes y quiere comentarios breves para AÑADIR a ellos, basados ÚNICAMENTE en material de la BIBLIOTECA EN LÍNEA Watchtower (wol.jw.org).

PASOS:
1. Busca SOLO en la Biblioteca en línea Watchtower, con búsquedas como "site:wol.jw.org <tema>". También puedes leer: ${searchUrl} y ${w.home}
2. Lee los artículos, notas de estudio, entradas de Perspicacia o de la Guía de estudio más relevantes.
3. Redacta 3 comentarios breves (2-3 frases cada uno) que ENRIQUEZCAN lo que el estudiante escribe ahora: un punto de apoyo, un dato de contexto, un texto bíblico relacionado y cómo se aplica, una ilustración o una aplicación práctica.

REGLAS:
- Basa cada comentario estrictamente en lo que realmente leíste en wol.jw.org. Nunca uses otros sitios web. Nunca inventes datos, citas ni referencias.
- Redacta con tus propias palabras; no copies frases (como mucho una expresión muy corta).
- No repitas ideas que el estudiante ya escribió.
- Si no encuentras nada relevante en wol.jw.org, devuelve [].
- Escribe en español.

SALIDA: solo un arreglo JSON, sin otro texto ni bloques de código:
[{"type":"punto|contexto|texto|ilustracion|aplicacion","text":"el comentario","scripture":"cita bíblica o vacío","source":"referencia breve a la publicación, p. ej. w23.05 pág. 10 párr. 7, o el título del artículo"}]

TEMA DEL APUNTE: ${theme || '(sin título)'}

LO QUE EL ESTUDIANTE ESTÁ ESCRIBIENDO AHORA:
${focus || '(ver apuntes recientes)'}

APUNTES RECIENTES (contexto, no repetir):
${context || '(vacío)'}`;
  }

  function parseSuggestions(text) {
    if (!text) return [];
    const clean = text.replace(/```json|```/gi, '').trim();
    const a = clean.indexOf('['), b = clean.lastIndexOf(']');
    if (a === -1 || b <= a) return [];
    try {
      const arr = JSON.parse(clean.slice(a, b + 1));
      if (!Array.isArray(arr)) return [];
      return arr.filter(s => s && typeof s.text === 'string' && s.text.trim().length > 10).slice(0, 5).map(s => ({
        type: String(s.type || '').trim().slice(0, 30),
        text: s.text.trim().slice(0, 900),
        scripture: String(s.scripture || '').trim().slice(0, 120),
        source: String(s.source || '').trim().slice(0, 200)
      }));
    } catch (e) { return []; }
  }

  /** Comprueba en los metadatos de Gemini qué páginas se usaron realmente. */
  function verify(suggestions, cand) {
    const gm = cand.groundingMetadata || {};
    const chunks = gm.groundingChunks || [];
    const supports = gm.groundingSupports || [];
    const urlMeta = ((cand.urlContextMetadata || {}).urlMetadata) || [];
    const chunkJw = chunks.map(c => { const w = c.web || {}; return isJw(w.uri) || isJw(w.title) || isJw(w.domain); });
    const jwCount = chunkJw.filter(Boolean).length +
      urlMeta.filter(u => isJw(u.retrievedUrl) && /SUCCESS/i.test(String(u.urlRetrievalStatus || ''))).length;
    if (!jwCount) return { list: [], jwCount: 0 };
    const list = [];
    suggestions.forEach(s => {
      const rel = supports.filter(sp => {
        const t = (sp.segment && sp.segment.text) || '';
        return t.length > 15 && (s.text.includes(t) || t.includes(s.text.slice(0, 60)));
      });
      if (rel.length && !rel.some(sp => (sp.groundingChunkIndices || []).some(i => chunkJw[i]))) return; // solo otros sitios
      list.push(s);
    });
    return { list, jwCount };
  }

  async function callGemini(model, key, prompt, tools) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], tools, generationConfig: { temperature: 0.3 } }),
        signal: ctrl.signal
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        const err = new Error((j.error && j.error.message) || `HTTP ${res.status}`);
        err.status = res.status;
        err.raw = JSON.stringify(j.error || {});
        throw err;
      }
      return await res.json();
    } catch (e) {
      if (e.name === 'AbortError') { const err = new Error('Gemini tardó demasiado en responder.'); err.status = 408; throw err; }
      throw e;
    } finally { clearTimeout(timer); }
  }

  async function suggestFromWol(input) {
    const key = getKey();
    if (key.length < 10) throw new Error('Falta la clave de Gemini. Añádela en Ajustes → Inteligencia artificial.');
    if (navigator.onLine === false) throw new Error('Sin conexión a Internet: la búsqueda en la WOL necesita conexión.');
    const lang = detectLang(`${input.title} ${input.focus} ${input.context}`);
    const prompt = buildPrompt({ ...input, lang });
    const toolSets = [[{ google_search: {} }, { url_context: {} }], [{ google_search: {} }]];
    let lastErr = '', nonJw = 0;
    const quotaErrors = [];

    for (const model of MODELS) {
      for (const tools of toolSets) {
        try {
          const data = await callGemini(model, key, prompt, tools);
          const cand = data.candidates && data.candidates[0];
          if (!cand) { lastErr = 'Gemini no devolvió respuesta.'; break; }
          const text = ((cand.content && cand.content.parts) || []).map(p => p.text || '').join('');
          const parsed = parseSuggestions(text);
          const { list, jwCount } = verify(parsed, cand);
          console.info(`[WOL] ${model}: ${list.length} sugerencias, fuentes jw.org: ${jwCount}`);
          if (jwCount > 0 || parsed.length === 0) return { lang, suggestions: list };
          lastErr = 'Las sugerencias no estaban respaldadas por páginas de wol.jw.org.';
          if (++nonJw >= 2) throw Object.assign(new Error(lastErr), { final: true });
          break;
        } catch (e) {
          if (e.final) throw e;
          lastErr = e.message;
          console.warn(`[WOL] ${model}:`, e.message);
          if (e.status === 401 || e.status === 403 || /api key/i.test(e.message)) throw new Error('La clave de Gemini no es válida. Revísala en Ajustes.');
          if (e.status === 429) { quotaErrors.push({ model, msg: e.message + ' ' + (e.raw || '') }); break; } // probar el siguiente modelo
          if (e.status !== 400) break; // 400: herramienta no admitida → probar solo búsqueda
        }
      }
    }
    if (quotaErrors.length) throw new Error(quotaMessage(quotaErrors));
    throw new Error(lastErr || 'No se pudieron obtener sugerencias de la WOL.');
  }

  /** Traduce los errores 429 de Google a un mensaje claro. */
  function quotaMessage(errors) {
    const all = errors.map(e => e.msg).join(' ');
    const wait = all.match(/retry in ([\d.]+)\s*s/i) || all.match(/retryDelay"\s*:\s*"([\d.]+)s/i);
    const onlyZero = errors.every(e => /limit:\s*0\b/.test(e.msg) || /quotaValue"\s*:\s*"0"/.test(e.msg));
    if (onlyZero) {
      return 'Tu clave de Gemini (plan gratuito) no incluye la búsqueda de Google en los modelos disponibles. ' +
        'Para usar las sugerencias de la WOL hace falta activar la facturación en Google AI Studio.';
    }
    if (wait && parseFloat(wait[1]) < 120) {
      return `Demasiadas peticiones seguidas a Gemini. Espera ${Math.ceil(parseFloat(wait[1]))} segundos y pulsa «Buscar ahora» otra vez.`;
    }
    return 'Has alcanzado el límite gratuito de Gemini por hoy (lo comparten «Revisar con IA» y las sugerencias). ' +
      'Vuelve a intentarlo mañana, o revisa tu uso en Google AI Studio.';
  }

  // ---------------- interfaz ----------------
  function buildUi() {
    const anchor = document.getElementById('btnRunAiAssist');
    openBtn = el('button', { type: 'button', id: 'btnWolAssistant', class: 'btn-ai-single wol-open-btn', title: 'Sugerencias de comentarios basadas en la Biblioteca en línea Watchtower', 'aria-expanded': 'false' });
    openBtn.innerHTML = '<span aria-hidden="true">📚</span><span>Sugerencias WOL</span>';
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(openBtn, anchor.nextSibling);
    else { const end = document.querySelector('.toolbar-end'); if (end) end.appendChild(openBtn); }
    openBtn.addEventListener('click', toggleDrawer);

    drawer = el('aside', { id: 'wolDrawer', class: 'wol-drawer', 'aria-label': 'Sugerencias de la Biblioteca en línea' });
    drawer.innerHTML = `
      <div class="wol-head">
        <div class="wol-title">📚 Sugerencias de la WOL</div>
        <button type="button" class="wol-close" aria-label="Cerrar">✕</button>
      </div>
      <div class="wol-controls">
        <label class="wol-toggle"><input type="checkbox" class="wol-auto"> Automático al escribir</label>
        <label class="wol-toggle"><input type="checkbox" class="wol-src"> Incluir fuente</label>
        <button type="button" class="wol-search">Buscar ahora</button>
      </div>
      <div class="wol-status" role="status" aria-live="polite"></div>
      <div class="wol-list"></div>
      <div class="wol-foot">Comentarios redactados por Gemini a partir de la WOL. Verifícalos con la fuente.</div>`;
    document.body.appendChild(drawer);
    listEl = drawer.querySelector('.wol-list');
    statusEl = drawer.querySelector('.wol-status');
    searchBtn = drawer.querySelector('.wol-search');
    const autoBox = drawer.querySelector('.wol-auto'), srcBox = drawer.querySelector('.wol-src');
    autoBox.checked = prefs.auto; srcBox.checked = prefs.includeSource;
    autoBox.addEventListener('change', () => { prefs.auto = autoBox.checked; writePref('wol_auto', prefs.auto); });
    srcBox.addEventListener('change', () => { prefs.includeSource = srcBox.checked; writePref('wol_source', prefs.includeSource); });
    drawer.querySelector('.wol-close').addEventListener('click', toggleDrawer);
    searchBtn.addEventListener('click', () => requestSuggestions(true));
    setStatus('Escribe en tu apunte y pulsa «Buscar ahora», o deja activado el modo automático.');
  }

  function toggleDrawer() {
    const open = !drawer.classList.contains('open');
    drawer.classList.toggle('open', open);
    document.body.classList.toggle('wol-drawer-open', open);
    openBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function setStatus(msg, kind) { statusEl.textContent = msg || ''; statusEl.className = 'wol-status' + (kind ? ' ' + kind : ''); }

  // ---------------- cursor ----------------
  function rememberRange() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) lastRange = sel.getRangeAt(0).cloneRange();
  }
  function blockOf(range) {
    if (!range) return null;
    let n = range.startContainer;
    if (!editor.contains(n)) return null;
    if (n === editor) return editor.childNodes[Math.max(0, range.startOffset - 1)] || null;
    n = n.nodeType === Node.TEXT_NODE ? n.parentNode : n;
    while (n && n.parentNode !== editor) n = n.parentNode;
    return n;
  }
  function getFocusText() {
    const block = blockOf(lastRange);
    if (block) {
      const parts = []; let n = block, c = 0;
      while (n && c < 3) { const t = (n.textContent || '').trim(); if (t) { parts.unshift(t); c++; } n = n.previousSibling; }
      const j = parts.join('\n');
      if (j.length >= 20) return j.slice(-1500);
    }
    return (editor.innerText || '').trim().slice(-1200);
  }

  // ---------------- búsqueda ----------------
  async function requestSuggestions(manual) {
    if (loading) return;
    const focus = getFocusText();
    if (!manual && focus === lastFocusText) return;
    const title = (document.getElementById('noteTitleInput') || {}).value || '';
    const tags = (document.getElementById('noteTagsInput') || {}).value || '';
    const context = ((textarea && textarea.value) || editor.innerText || '').slice(-3000);
    if ((focus + title).trim().length < 20) { setStatus('Escribe un poco más para poder buscar sugerencias.'); return; }

    loading = true; lastRequestAt = Date.now(); lastFocusText = focus;
    searchBtn.disabled = true; drawer.classList.add('is-loading');
    setStatus('Buscando en la Biblioteca en línea… (puede tardar 10–40 s)');
    try {
      const out = await suggestFromWol({ title, tags, context, focus });
      if (!out.suggestions.length) {
        setStatus(out.lang === 'en' ? 'No relevant material from the WOL was found for this passage.' : 'No se encontró material relevante de la WOL para este fragmento.');
        return;
      }
      if (resultsTitle !== title) { listEl.innerHTML = ''; resultsTitle = title; }
      out.suggestions.slice().reverse().forEach(s => listEl.prepend(makeCard(s)));
      while (listEl.children.length > MAX_CARDS) listEl.lastElementChild.remove();
      listEl.scrollTop = 0;
      const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setStatus(`${out.suggestions.length} sugerencia(s) de la WOL · ${hora}`, 'ok');
    } catch (e) {
      setStatus(e.message || 'No se pudieron obtener sugerencias.', 'error');
    } finally {
      loading = false; searchBtn.disabled = false; drawer.classList.remove('is-loading');
    }
  }

  function scheduleAuto() {
    if (!prefs.auto || !drawer.classList.contains('open')) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => {
      const since = Date.now() - lastRequestAt;
      if (since < AUTO_MIN_INTERVAL_MS) { autoTimer = setTimeout(scheduleAuto, AUTO_MIN_INTERVAL_MS - since + 500); return; }
      const focus = getFocusText();
      const changed = focus.startsWith(lastFocusText.slice(0, 40)) ? Math.abs(focus.length - lastFocusText.length) : AUTO_MIN_NEW_CHARS;
      if (changed >= AUTO_MIN_NEW_CHARS) requestSuggestions(false);
    }, AUTO_DELAY_MS);
  }

  // ---------------- tarjetas ----------------
  function makeCard(s) {
    const card = el('div', { class: 'wol-card' });
    card.appendChild(el('div', { class: 'wol-type' }, TYPE_LABELS[String(s.type || '').toLowerCase()] || '💬 Comentario'));
    card.appendChild(el('p', { class: 'wol-text' }, s.text));
    if (s.scripture) card.appendChild(el('div', { class: 'wol-scripture' }, '📖 ' + s.scripture));
    if (s.source) card.appendChild(el('div', { class: 'wol-source' }, 'Fuente: ' + s.source));
    const actions = el('div', { class: 'wol-actions' });
    const ins = el('button', { type: 'button', class: 'wol-insert' }, 'Insertar');
    const dis = el('button', { type: 'button', class: 'wol-dismiss' }, 'Descartar');
    ins.addEventListener('mousedown', e => e.preventDefault()); // no quitar el cursor del editor
    ins.addEventListener('click', () => { insertSuggestion(s); ins.textContent = '✓ Insertado'; ins.disabled = true; card.classList.add('used'); });
    dis.addEventListener('click', () => card.remove());
    actions.append(ins, dis);
    card.appendChild(actions);
    return card;
  }

  function insertSuggestion(s) {
    let text = s.text.trim();
    if (s.scripture && !text.toLowerCase().includes(s.scripture.toLowerCase().slice(0, 6))) text += ` (${s.scripture})`;
    const p = document.createElement('p');
    p.appendChild(document.createTextNode(text));
    if (prefs.includeSource && s.source) { p.appendChild(document.createTextNode(' ')); p.appendChild(el('em', {}, `(${s.source})`)); }

    inserting = true;
    try {
      editor.focus({ preventScroll: true });
      const range = lastRange && editor.contains(lastRange.startContainer) ? lastRange : null;
      const block = blockOf(range);
      if (block && block.parentNode === editor) editor.insertBefore(p, block.nextSibling);
      else editor.appendChild(p);
      const after = document.createRange();
      after.setStartAfter(p); after.collapse(true);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(after);
      lastRange = after.cloneRange();
      // La app sincroniza y guarda (y luego sube a GitHub) al recibir este evento
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    } finally { inserting = false; }
  }

  // ---------------- inicio ----------------
  function init() {
    editor = document.getElementById('noteRichEditor');
    textarea = document.getElementById('noteTextarea');
    if (!editor || document.getElementById('wolDrawer')) return;
    buildUi();
    document.addEventListener('selectionchange', rememberRange);
    editor.addEventListener('input', () => {
      if (inserting) return;
      lastInputAt = Date.now();
      rememberRange();
      scheduleAuto();
    });
    // Si la app carga otra nota (contenido reemplazado sin escribir), olvidar el cursor anterior
    new MutationObserver(() => {
      if (inserting || Date.now() - lastInputAt < 1500) return;
      lastRange = null; lastFocusText = ''; clearTimeout(autoTimer);
    }).observe(editor, { childList: true });
  }

  function safeInit() { try { init(); } catch (e) { console.warn('[WOL] No se pudo iniciar el asistente:', e); } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', safeInit);
  else safeInit();
})();
