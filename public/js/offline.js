// ==========================================================================
// ESTUDIO PERSONAL — MOTOR LOCAL + SINCRONIZACIÓN CON GITHUB
// --------------------------------------------------------------------------
// La app funciona sin servidor (por ejemplo en GitHub Pages):
// • Todos tus apuntes, preguntas y ajustes se guardan en este dispositivo
//   (IndexedDB), así que se puede leer y escribir sin conexión.
// • Cada cambio se marca como pendiente y se sube a un repositorio PRIVADO
//   de GitHub (un archivo por nota) en cuanto hay Internet.
// • Si la misma nota cambió en dos dispositivos no se pierde nada: se guarda
//   la versión más reciente y la otra queda como copia "(conflicto)"; los
//   documentos mensuales se fusionan por días.
// • Las rutas /api/* que usa la interfaz se responden aquí mismo, incluida
//   la IA (Gemini desde el navegador o el motor local) y los juegos.
// ==========================================================================
(function () {
  'use strict';

  const LS_GITHUB = 'ep_github';
  const DB_NAME = 'estudio-personal';
  const DB_VERSION = 1;
  const SYNC_INTERVAL_MS = 45 * 1000;
  // (La dirección de la API solo se cambia para pruebas automáticas)
  const GH_API = (() => { try { return localStorage.getItem('ep_github_api') || 'https://api.github.com'; } catch (e) { return 'https://api.github.com'; } })();

  const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  const nativeFetch = window.fetch.bind(window);

  function defaultCategories() {
    return [
      { id: 'daily_text', name: 'Daily Text Comments', icon: '🌅', isSystem: true, subCategories: [] },
      {
        id: 'events', name: 'Events', icon: '🏛️', isSystem: true, subCategories: [
          { id: 'bethel_talks', name: 'Bethel Talks', icon: '🎤', isSystem: true },
          { id: 'annual_meeting', name: 'Annual Meeting', icon: '🌐', isSystem: true },
          { id: 'gilead_meeting', name: 'Gilead Meeting', icon: '🎓', isSystem: true },
          { id: 'others', name: 'Others', icon: '📂', isSystem: true }
        ]
      },
      { id: 'spiritual_notes', name: 'Spiritual Notes', icon: '💡', isSystem: true, subCategories: [] }
    ];
  }

  function defaultMeta() {
    const y = new Date().getFullYear();
    return {
      categories: defaultCategories(),
      years: [y - 1, y, y + 1, y + 2],
      settings: { targetScore: 100, pointsPerQuestion: 5 },
      history: []
    };
  }

  function normalizeMeta(m) {
    const d = defaultMeta();
    const out = { ...d, ...(m || {}) };
    if (!Array.isArray(out.categories) || !out.categories.length) out.categories = d.categories;
    if (!Array.isArray(out.years)) out.years = d.years;
    out.years = Array.from(new Set(out.years.map(Number).filter(Boolean))).sort((a, b) => a - b);
    out.settings = { ...d.settings, ...(out.settings || {}) };
    if (!Array.isArray(out.history)) out.history = [];
    return out;
  }

  // ------------------------------------------------------------------
  // Estado
  // ------------------------------------------------------------------
  const S = {
    notes: new Map(),
    questions: {},           // topicId -> [preguntas]
    meta: defaultMeta(),
    sync: freshSyncState(),
    status: 'idle',          // idle | syncing | synced | offline | auth | error | noserver
    statusDetail: '',
    lastSyncAt: null
  };

  function freshSyncState() {
    return {
      headSha: null,
      treeSha: null,
      fileShas: {},          // ruta -> sha del blob en la última sincronización
      pendingNotes: {},      // id -> revisión
      pendingDeletes: {},    // id -> true
      pendingQuestions: {},  // topicId -> revisión
      metaOps: [],
      rev: 0
    };
  }

  // ------------------------------------------------------------------
  // Utilidades
  // ------------------------------------------------------------------
  const nowIso = () => new Date().toISOString();
  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const rand = (n = 6) => Math.random().toString(36).slice(2, 2 + n);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const fingerprint = (n) => {
    if (!n) return '';
    const { _seq, questionsCount, questions, ...rest } = n;
    return JSON.stringify(rest);
  };

  function parseDateComponents(dateStr) {
    if (!dateStr || typeof dateStr !== 'string' || !dateStr.includes('-')) return null;
    const [y, m, d] = dateStr.split('-').map(x => parseInt(x, 10));
    return {
      year: isNaN(y) ? new Date().getFullYear() : y,
      month: (m >= 1 && m <= 12) ? MONTHS[m - 1] : '',
      day: isNaN(d) ? null : d
    };
  }

  function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Served-By': 'local' }
    });
  }

  function b64encodeUtf8(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  function b64decodeUtf8(b64) {
    const bin = atob(String(b64 || '').replace(/\s/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  async function mapLimit(items, limit, fn) {
    const results = new Array(items.length);
    let i = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        results[idx] = await fn(items[idx], idx);
      }
    });
    await Promise.all(workers);
    return results;
  }

  function engine() {
    if (!window.EPEngine) throw new Error('El motor de IA no se ha cargado.');
    return window.EPEngine;
  }

  // ------------------------------------------------------------------
  // Configuración de GitHub
  // ------------------------------------------------------------------
  function codeRepoFromLocation() {
    const m = location.hostname.match(/^([^.]+)\.github\.io$/i);
    if (!m) return null;
    const seg = location.pathname.split('/').filter(Boolean)[0];
    return { owner: m[1], repo: seg || `${m[1]}.github.io` };
  }

  function getGithubConfig() {
    try {
      const c = JSON.parse(localStorage.getItem(LS_GITHUB) || 'null');
      if (c && c.token && c.owner && c.repo) return c;
    } catch (e) { /* sin configuración */ }
    return null;
  }

  function setGithubConfig(cfg) {
    try {
      if (cfg) localStorage.setItem(LS_GITHUB, JSON.stringify(cfg));
      else localStorage.removeItem(LS_GITHUB);
    } catch (e) { /* ignorar */ }
  }

  function repoLabel() {
    const c = getGithubConfig();
    return c ? `${c.owner}/${c.repo}` : '';
  }

  // ------------------------------------------------------------------
  // IndexedDB
  // ------------------------------------------------------------------
  let idbPromise = null;
  function openIdb() {
    if (idbPromise) return idbPromise;
    idbPromise = new Promise((resolve) => {
      if (!('indexedDB' in window)) return resolve(null);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('notes')) db.createObjectStore('notes', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { console.warn('[Local] IndexedDB no disponible:', req.error); resolve(null); };
    });
    return idbPromise;
  }

  async function idbTx(store, mode, fn) {
    const db = await openIdb();
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const st = tx.objectStore(store);
      let result;
      try { result = fn(st); } catch (e) { reject(e); return; }
      tx.oncomplete = () => resolve(result && 'result' in result ? result.result : result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  const idb = {
    getAllNotes: () => idbTx('notes', 'readonly', st => st.getAll()),
    putNote: (n) => idbTx('notes', 'readwrite', st => { st.put(n); }),
    putNotes: (arr) => idbTx('notes', 'readwrite', st => { arr.forEach(n => st.put(n)); }),
    deleteNote: (id) => idbTx('notes', 'readwrite', st => { st.delete(id); }),
    get: (k) => idbTx('kv', 'readonly', st => st.get(k)),
    set: (k, v) => idbTx('kv', 'readwrite', st => { st.put(v, k); })
  };

  const persist = {
    note: (n) => idb.putNote(n).catch(e => console.warn('[Local] Error guardando nota:', e)),
    noteDelete: (id) => idb.deleteNote(id).catch(() => {}),
    meta: () => idb.set('meta', S.meta).catch(() => {}),
    questions: () => idb.set('questions', S.questions).catch(() => {}),
    sync: () => { idb.set('sync', { ...S.sync, lastSyncAt: S.lastSyncAt }).catch(() => {}); emitStatus(); }
  };

  // ------------------------------------------------------------------
  // Cambios pendientes
  // ------------------------------------------------------------------
  function pendingCount() {
    const y = S.sync;
    return Object.keys(y.pendingNotes).length + Object.keys(y.pendingDeletes).length +
      Object.keys(y.pendingQuestions).length + (y.metaOps.length ? 1 : 0);
  }

  function markNote(id) {
    S.sync.pendingNotes[id] = ++S.sync.rev;
    delete S.sync.pendingDeletes[id];
    persist.sync();
    scheduleSync();
  }

  function markDelete(id) {
    delete S.sync.pendingNotes[id];
    if (S.sync.fileShas[notePath(id)]) S.sync.pendingDeletes[id] = true;
    persist.sync();
    scheduleSync();
  }

  function markQuestions(topicId, delay) {
    S.sync.pendingQuestions[topicId] = ++S.sync.rev;
    persist.questions();
    persist.sync();
    scheduleSync(delay);
  }

  function pushMetaOp(op) {
    applyMetaOp(S.meta, op);
    S.sync.metaOps.push(op);
    persist.meta();
    persist.sync();
    scheduleSync(op.type === 'history' ? 20000 : undefined);
  }

  function applyMetaOp(meta, op) {
    const findCat = (id) => {
      for (const c of meta.categories) {
        if (c.id === id) return { cat: c, parent: null };
        for (const s of (c.subCategories || [])) if (s.id === id) return { cat: s, parent: c };
      }
      return null;
    };
    if (op.type === 'addCategory') {
      if (findCat(op.category.id)) return;
      if (op.parentId) {
        const parent = meta.categories.find(c => c.id === op.parentId);
        if (parent) parent.subCategories = [...(parent.subCategories || []), { ...op.category, isSystem: false, parentId: op.parentId }];
      } else {
        meta.categories.push({ ...op.category, isSystem: false, subCategories: [] });
      }
    } else if (op.type === 'deleteCategory') {
      meta.categories = meta.categories.filter(c => c.id !== op.id || c.isSystem);
      meta.categories.forEach(c => { c.subCategories = (c.subCategories || []).filter(s => s.id !== op.id || s.isSystem); });
    } else if (op.type === 'addYear') {
      const y = Number(op.year);
      if (y && !meta.years.includes(y)) { meta.years.push(y); meta.years.sort((a, b) => a - b); }
    } else if (op.type === 'settings') {
      meta.settings = { ...meta.settings, ...op.values };
    } else if (op.type === 'history') {
      meta.history = [op.entry, ...(meta.history || []).filter(h => h.id !== op.entry.id)].slice(0, 50);
    } else if (op.type === 'replaceMeta') {
      Object.assign(meta, normalizeMeta(op.meta));
    }
  }

  // ------------------------------------------------------------------
  // Notas (réplica de services/dbService.js)
  // ------------------------------------------------------------------
  const questionCount = (id) => (S.questions[id] || []).length;
  const withCounts = (n) => ({ ...n, questionsCount: questionCount(n.id) });

  function cleanNote(n) {
    const c = { ...n };
    ['_seq', 'questions', 'questionsCount', 'matchSnippet', 'matchedIn', '_local'].forEach(k => delete c[k]);
    return c;
  }

  function saveNote(note) {
    const stored = cleanNote(note);
    S.notes.set(stored.id, stored);
    persist.note(stored);
    markNote(stored.id);
    return stored;
  }

  function removeNote(id) {
    if (!S.notes.has(id)) return false;
    S.notes.delete(id);
    persist.noteDelete(id);
    if (S.questions[id]) {
      delete S.questions[id];
      markQuestions(id);
    }
    markDelete(id);
    return true;
  }

  function ensureYear(year) {
    const y = Number(year);
    if (!y || S.meta.years.includes(y)) return;
    pushMetaOp({ type: 'addYear', year: y });
  }

  function availableYears() {
    const set = new Set(S.meta.years);
    for (const n of S.notes.values()) if (n.year) set.add(Number(n.year));
    return Array.from(set).filter(Boolean).sort((a, b) => a - b);
  }

  const sortByDateDesc = (arr) => arr.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

  function getAllNotes(filter = {}) {
    let notes = Array.from(S.notes.values());
    if (filter.category) notes = notes.filter(n => n.category === filter.category);
    if (filter.subCategory) notes = notes.filter(n => n.subCategory === filter.subCategory);
    if (filter.year) notes = notes.filter(n => Number(n.year) === Number(filter.year));
    if (filter.month) notes = notes.filter(n => String(n.month).toLowerCase() === String(filter.month).toLowerCase());
    if (filter.search) {
      const q = String(filter.search).toLowerCase().trim();
      notes = notes.filter(n =>
        (n.title && n.title.toLowerCase().includes(q)) ||
        (n.content && n.content.toLowerCase().includes(q)) ||
        (n.tags && n.tags.some(t => String(t).toLowerCase().includes(q))) ||
        (n.date && n.date.includes(q)));
    }
    return sortByDateDesc(notes.map(withCounts));
  }

  function createNote(data = {}) {
    const now = nowIso();
    const dateStr = data.date || todayStr();
    const dp = parseDateComponents(dateStr);
    const year = data.year ? Number(data.year) : (dp ? dp.year : new Date().getFullYear());
    ensureYear(year);
    const category = data.category || 'spiritual_notes';
    return saveNote({
      id: `note_${Date.now()}_${rand(5)}`,
      category,
      subCategory: data.subCategory || '',
      year,
      month: data.month || (dp ? dp.month : ''),
      day: data.day ? Number(data.day) : (dp ? dp.day : null),
      title: String(data.title || 'Nueva Nota').trim(),
      date: dateStr,
      icon: data.icon || (category === 'daily_text' ? '🌅' : category === 'events' ? '🏛️' : '💡'),
      content: data.content || '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      createdAt: now,
      updatedAt: now
    });
  }

  function updateNote(id, data = {}) {
    const current = S.notes.get(id);
    if (!current) return null;
    const dateStr = data.date || current.date || todayStr();
    const dp = parseDateComponents(dateStr);
    const year = data.year !== undefined ? Number(data.year) : (dp ? dp.year : current.year);
    const month = data.month !== undefined ? data.month : (dp ? dp.month : current.month);
    const day = data.day !== undefined ? Number(data.day) : (dp ? dp.day : current.day);
    ensureYear(year);
    const category = data.category !== undefined ? data.category : current.category;
    const subCategory = category === 'daily_text' ? '' : (data.subCategory !== undefined ? data.subCategory : (current.subCategory || ''));

    let content = current.content;
    if (data.content !== undefined) {
      const emptying = typeof data.content === 'string' && data.content.trim().length === 0 &&
        current.content && current.content.trim().length > 40;
      if (!emptying) content = data.content;
    }

    const updated = cleanNote({
      ...current, ...data, category, subCategory, content, date: dateStr, year, month, day,
      id: current.id, createdAt: current.createdAt, updatedAt: nowIso()
    });
    if (fingerprint({ ...updated, updatedAt: '' }) === fingerprint({ ...current, updatedAt: '' })) {
      return withCounts(current); // nada cambió
    }
    return withCounts(saveNote(updated));
  }

  function findMonthDoc(numYear, mName) {
    const docId = `daily_text_${numYear}_${mName}`;
    if (S.notes.has(docId)) return S.notes.get(docId);
    for (const n of S.notes.values()) {
      if (n.category === 'daily_text' && Number(n.year) === numYear && n.month === mName && n.isMonthDoc) return n;
    }
    return null;
  }

  function getMonthDocument(year, month) {
    const numYear = parseInt(year, 10) || new Date().getFullYear();
    const mName = String(month || MONTHS[new Date().getMonth()]).trim();
    const existing = findMonthDoc(numYear, mName);
    if (existing) return withCounts(existing);

    const mIdx = MONTHS.indexOf(mName);
    const dateStr = `${numYear}-${String((mIdx >= 0 ? mIdx : 0) + 1).padStart(2, '0')}-01`;
    const legacy = Array.from(S.notes.values()).filter(n =>
      n.category === 'daily_text' && Number(n.year) === numYear && n.month === mName && !n.isMonthDoc);

    let content;
    let createdAt = nowIso();
    if (legacy.length > 0) {
      legacy.sort((a, b) => (Number(a.day) || 1) - (Number(b.day) || 1));
      content = `# 🌅 Daily Text Comments — ${mName} ${numYear}\n\n`;
      legacy.forEach(ln => {
        const dNum = ln.day || ((parseDateComponents(ln.date) || {}).day) || 1;
        content += `---\n## 📅 DÍA ${dNum} • ${ln.title || `Entrada del día ${dNum}`}\n\n${(ln.content || '').trim()}\n\n`;
      });
      content = content.trim() + '\n';
      createdAt = legacy[0].createdAt || createdAt;
      legacy.forEach(ln => removeNote(ln.id));
    } else {
      content = `# 🌅 Daily Text Comments — ${mName} ${numYear}\n\n*Cuaderno mensual de estudio. Pulsa "+ Añadir Día a ${mName}" para registrar tus apuntes matutinos.*\n`;
    }

    return withCounts(saveNote({
      id: `daily_text_${numYear}_${mName}`,
      category: 'daily_text', subCategory: '', isMonthDoc: true,
      year: numYear, month: mName, day: null,
      title: `Daily Text — ${mName} ${numYear}`,
      date: dateStr, icon: '🌅', content,
      tags: ['daily_text', String(numYear), mName],
      createdAt, updatedAt: nowIso()
    }));
  }

  function appendDayToMonth(year, month, dayData = {}) {
    const monthDoc = getMonthDocument(year, month);
    const dayNum = parseInt(dayData.day, 10) || 1;
    const dayTitle = String(dayData.title || `Entrada del día ${dayNum}`).trim();
    const scripture = String(dayData.scripture || '').trim();
    const weekday = dayData.weekday || 'Día';
    const customContent = String(dayData.content || '').trim();

    let block = `\n\n---\n## 📅 DÍA ${dayNum} • Fecha: ${weekday}, ${dayNum} de ${month} de ${year}\n# ✍️ Título: ${dayTitle}\n`;
    if (scripture) block += `> 📖 **Texto Bíblico:** "${scripture}"\n\n`;
    block += customContent ? customContent + '\n' : `### Puntos Clave del Estudio:\n- \n- \n\n💡 **Aplicación personal:**\n`;

    const current = S.notes.get(monthDoc.id);
    return withCounts(saveNote({
      ...current,
      content: (((current.content || '').trim()) + block).trim() + '\n',
      updatedAt: nowIso()
    }));
  }

  function getFolderDocuments(category, subCategory = '') {
    const notes = Array.from(S.notes.values());
    if (category === 'events') return notes.filter(n => n.category === 'events' && (!subCategory || n.subCategory === subCategory)).map(withCounts);
    if (category) return notes.filter(n => n.category === category).map(withCounts);
    return notes.map(withCounts);
  }

  function search(query) {
    const term = String(query || '').toLowerCase().trim();
    if (!term) return { query: '', totalMatches: 0, notes: [], topics: [], questions: [] };
    const notes = [];
    for (const n of S.notes.values()) {
      const titleMatch = n.title && n.title.toLowerCase().includes(term);
      const contentMatch = n.content && n.content.toLowerCase().includes(term);
      const tagMatch = n.tags && n.tags.some(t => String(t).toLowerCase().includes(term));
      const dateMatch = n.date && n.date.includes(term);
      if (!(titleMatch || contentMatch || tagMatch || dateMatch)) continue;
      let snippet;
      if (contentMatch) {
        const pos = n.content.toLowerCase().indexOf(term);
        const start = Math.max(0, pos - 50);
        const end = Math.min(n.content.length, pos + term.length + 50);
        snippet = (start > 0 ? '...' : '') + n.content.substring(start, end).replace(/\n/g, ' ') + (end < n.content.length ? '...' : '');
      } else {
        snippet = (n.content || '').substring(0, 100).replace(/\n/g, ' ') + '...';
      }
      snippet = snippet.replace(/[#>*_`]+/g, '').replace(/[📅✍️📖💡]/gu, '').replace(/\s{2,}/g, ' ').trim();
      notes.push({ ...withCounts(n), matchSnippet: snippet, matchedIn: titleMatch ? 'title' : contentMatch ? 'content' : tagMatch ? 'tag' : 'date' });
    }
    sortByDateDesc(notes);
    const questions = [];
    for (const list of Object.values(S.questions)) {
      for (const q of list) {
        if ((q.question && q.question.toLowerCase().includes(term)) || (q.explanation && q.explanation.toLowerCase().includes(term))) questions.push(q);
      }
    }
    return { query, totalMatches: notes.length + questions.length, notes, topics: [], questions: questions.slice(0, 50) };
  }

  function addCategory({ name, icon, parentId }) {
    if (!name || !String(name).trim()) throw new Error('El nombre de la categoría es obligatorio');
    if (parentId && !S.meta.categories.some(c => c.id === parentId)) throw new Error('Categoría padre no encontrada');
    const category = { id: `cat_${Date.now().toString(36)}_${rand(4)}`, name: String(name).trim(), icon: (icon && String(icon).trim()) || (parentId ? '📂' : '📁') };
    pushMetaOp({ type: 'addCategory', category, parentId: parentId || null });
    return { ...category, isSystem: false, ...(parentId ? { parentId } : { subCategories: [] }) };
  }

  function deleteCategory(id) {
    let found = null;
    for (const c of S.meta.categories) {
      if (c.id === id) found = c;
      for (const s of (c.subCategories || [])) if (s.id === id) found = s;
    }
    if (!found) return false;
    if (found.isSystem) throw new Error('No se pueden eliminar las categorías del sistema');
    pushMetaOp({ type: 'deleteCategory', id });
    return true;
  }

  // ------------------------------------------------------------------
  // Preguntas y juegos (réplica de dbService / server.js)
  // ------------------------------------------------------------------
  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function shuffleQuestionOptions(q) {
    const letters = ['A', 'B', 'C', 'D'];
    const correctText = q.options[q.correctAnswer] || q.options.A;
    const texts = shuffleArray([q.options.A, q.options.B, q.options.C, q.options.D]);
    const idx = texts.indexOf(correctText);
    return { ...q, options: { A: texts[0], B: texts[1], C: texts[2], D: texts[3] }, correctAnswer: idx >= 0 ? letters[idx] : 'A' };
  }

  function addQuestionsToTopic(topicId, newQuestions = []) {
    const note = S.notes.get(topicId);
    const list = S.questions[topicId] || (S.questions[topicId] = []);
    const saved = [];
    for (const q of newQuestions) {
      if (!q || !q.question || !q.options || !q.correctAnswer) continue;
      if (list.some(x => x.question.trim().toLowerCase() === q.question.trim().toLowerCase())) continue;
      const obj = shuffleQuestionOptions({
        id: `q_${Date.now()}_${rand(5)}`,
        topicId,
        topicTitle: note ? note.title : (q.topicTitle || ''),
        question: q.question.trim(),
        options: { A: String(q.options.A || '').trim(), B: String(q.options.B || '').trim(), C: String(q.options.C || '').trim(), D: String(q.options.D || '').trim() },
        correctAnswer: String(q.correctAnswer).toUpperCase().trim(),
        explanation: String(q.explanation || 'Respuesta basada en los apuntes del tema.').trim(),
        difficulty: q.difficulty || 'normal',
        stats: { timesAsked: 0, timesCorrect: 0 },
        createdAt: nowIso()
      });
      list.push(obj);
      saved.push(obj);
    }
    if (saved.length) markQuestions(topicId);
    return saved;
  }

  async function generateForNote(noteId, count) {
    const note = S.notes.get(noteId);
    if (!note) throw new Error('Nota no encontrada.');
    const text = (note.content || '').trim();
    if (text.length < 25) throw new Error('El contenido de la nota es demasiado breve para extraer preguntas. Escribe unos párrafos más.');
    const qs = await engine().ai.generateQuestionsFromText(text, note.title, count);
    return addQuestionsToTopic(noteId, qs);
  }

  function notesAsTopics() {
    return sortByDateDesc(Array.from(S.notes.values()).map(n => ({
      id: n.id, title: n.title, isNote: true, noteId: n.id,
      category: n.category, subCategory: n.subCategory || '', date: n.date,
      icon: n.icon || '📝', rawTextSnippet: (n.content || '').slice(0, 500),
      createdAt: n.createdAt, updatedAt: n.updatedAt, questionsCount: questionCount(n.id)
    })));
  }

  function findQuestion(qid) {
    for (const [tid, list] of Object.entries(S.questions)) {
      const q = list.find(x => x.id === qid);
      if (q) return { tid, q };
    }
    return null;
  }

  function maskKey(k) { return k && k.length > 8 ? `${k.slice(0, 4)}...${k.slice(-4)}` : ''; }

  // ------------------------------------------------------------------
  // Importar documentos (.txt, .md, .docx, .pdf) en el navegador
  // ------------------------------------------------------------------
  const scriptCache = {};
  function loadScript(src) {
    if (!scriptCache[src]) {
      scriptCache[src] = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src; s.async = true;
        s.onload = resolve;
        s.onerror = () => reject(new Error('No se pudo cargar el lector de documentos (¿sin conexión?).'));
        document.head.appendChild(s);
      });
    }
    return scriptCache[src];
  }

  async function extractText(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ext === 'txt' || ext === 'md') return file.text();
    if (ext === 'docx') {
      await loadScript('https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js');
      const r = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      return r.value || '';
    }
    if (ext === 'pdf') {
      await loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js');
      const pdfjs = window.pdfjsLib;
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
      const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      let text = '';
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const tc = await page.getTextContent();
        text += tc.items.map(it => it.str).join(' ') + '\n\n';
      }
      return text;
    }
    throw new Error('Formato no admitido. Usa .txt, .md, .docx o .pdf');
  }

  // ------------------------------------------------------------------
  // Router local de /api/*
  // ------------------------------------------------------------------
  async function route(method, url, body) {
    const p = url.pathname.replace(/^.*?\/api\//, '/api/').replace(/\/+$/, '');
    let data = {};
    if (typeof body === 'string' && body) { try { data = JSON.parse(body); } catch (e) { data = {}; } }
    const ok = (b, status = 200) => ({ status, body: { success: true, ...b } });
    const fail = (error, status = 400, extra = {}) => ({ status, body: { success: false, error, ...extra } });
    let m;

    // --- Notas ---
    if (p === '/api/notes' && method === 'GET') return ok({ notes: getAllNotes(Object.fromEntries(url.searchParams.entries())) });
    if (p === '/api/notes' && method === 'POST') return ok({ note: withCounts(createNote(data)), message: 'Nota creada con éxito.' }, 201);
    if ((m = p.match(/^\/api\/notes\/month\/([^/]+)\/([^/]+)\/day$/)) && method === 'POST') {
      return ok({ note: appendDayToMonth(decodeURIComponent(m[1]), decodeURIComponent(m[2]), data), message: 'Día añadido al documento mensual.' });
    }
    if ((m = p.match(/^\/api\/notes\/month\/([^/]+)\/([^/]+)$/)) && method === 'GET') {
      return ok({ note: getMonthDocument(decodeURIComponent(m[1]), decodeURIComponent(m[2])) });
    }
    if ((m = p.match(/^\/api\/notes\/folder\/([^/]+)$/)) && method === 'GET') {
      const docs = getFolderDocuments(decodeURIComponent(m[1]), url.searchParams.get('subCategory') || '');
      return ok({ notes: docs, count: docs.length });
    }
    if ((m = p.match(/^\/api\/notes\/([^/]+)\/generate-questions$/)) && method === 'POST') {
      const saved = await generateForNote(decodeURIComponent(m[1]), parseInt(data.count || 8, 10));
      return ok({ message: `Se han generado y vinculado ${saved.length} preguntas a esta nota.`, addedCount: saved.length, questions: saved });
    }
    if ((m = p.match(/^\/api\/notes\/([^/]+)\/ai-assist$/)) && method === 'POST') {
      const note = S.notes.get(decodeURIComponent(m[1]));
      const content = data.content || (note ? note.content : '');
      if (!content || !content.trim()) return fail('No hay texto que procesar.');
      const r = await engine().ai.improveNoteWithAI(content, data.action || 'improve', data.title || (note ? note.title : 'Apunte'), data.apiKey || '');
      return ok({ action: data.action || 'improve', original: content, ...r });
    }
    if ((m = p.match(/^\/api\/notes\/([^/]+)$/))) {
      const id = decodeURIComponent(m[1]);
      if (method === 'GET') {
        const n = S.notes.get(id);
        return n ? ok({ note: { ...withCounts(n), questions: S.questions[id] || [] } }) : fail('Nota no encontrada.', 404);
      }
      if (method === 'PUT') {
        const n = updateNote(id, data);
        return n ? ok({ note: n, message: 'Nota guardada con éxito.' }) : fail('Nota no encontrada.', 404);
      }
      if (method === 'DELETE') return removeNote(id) ? ok({ message: 'Nota eliminada correctamente.' }) : fail('Nota no encontrada.', 404);
    }

    // --- Años y categorías ---
    if (p === '/api/years' && method === 'GET') return ok({ years: availableYears() });
    if (p === '/api/years' && method === 'POST') {
      const y = parseInt(data.year, 10);
      if (!y) return fail('Debe especificar el año.');
      if (y >= 1900 && y <= 2100) ensureYear(y);
      return ok({ years: availableYears(), message: `Año ${y} configurado correctamente.` });
    }
    if (p === '/api/categories' && method === 'GET') return ok({ categories: clone(S.meta.categories) });
    if (p === '/api/categories' && method === 'POST') return ok({ category: addCategory(data) });
    if ((m = p.match(/^\/api\/categories\/([^/]+)$/)) && method === 'DELETE') {
      return deleteCategory(decodeURIComponent(m[1])) ? ok({ message: 'Categoría eliminada' }) : fail('Categoría no encontrada', 404);
    }

    // --- Búsqueda ---
    if (p === '/api/search' && method === 'GET') return ok(search(url.searchParams.get('q') || ''));

    // --- Temas y juegos ---
    if (p === '/api/topics' && method === 'GET') return ok({ topics: notesAsTopics() });
    if (p === '/api/topics/sync' && method === 'POST') {
      return ok({ message: 'Lista actualizada.', discoveredCount: 0, generatedCount: 0, topics: notesAsTopics() });
    }
    if ((m = p.match(/^\/api\/topics\/([^/]+)\/questions$/)) && method === 'GET') {
      return ok({ questions: S.questions[decodeURIComponent(m[1])] || [] });
    }
    if ((m = p.match(/^\/api\/topics\/([^/]+)\/generate$/)) && method === 'POST') {
      const saved = await generateForNote(decodeURIComponent(m[1]), parseInt(data.count || 8, 10));
      const note = S.notes.get(decodeURIComponent(m[1]));
      return ok({ message: `Se han añadido ${saved.length} nuevas preguntas al tema "${note ? note.title : ''}".`, addedCount: saved.length });
    }
    if ((m = p.match(/^\/api\/topics\/([^/]+)$/)) && method === 'DELETE') {
      return removeNote(decodeURIComponent(m[1])) ? ok({ message: 'Tema y sus preguntas eliminados correctamente.' }) : fail('No se encontró el tema.', 404);
    }
    if (p === '/api/game/start' && method === 'POST') {
      const ids = Array.isArray(data.topicIds) ? data.topicIds : [];
      if (!ids.length) return fail('Debes seleccionar al menos 1 tema para jugar.');
      if (ids.length > 5) return fail('El juego permite un máximo de 5 temas por partida.');
      for (const tid of ids) {
        if (!questionCount(tid)) {
          try { await generateForNote(tid, 8); } catch (e) { console.warn('[Juego] No se pudieron generar preguntas:', e.message); }
        }
      }
      const pool = shuffleArray(ids.flatMap(tid => S.questions[tid] || []).slice()).slice(0, 40).map(shuffleQuestionOptions);
      if (!pool.length) return fail('Los temas seleccionados aún no tienen preguntas disponibles. Genera preguntas primero.');
      return ok({ questions: pool, config: { targetScore: S.meta.settings.targetScore || 100, pointsPerQuestion: S.meta.settings.pointsPerQuestion || 5 } });
    }
    if (p === '/api/game/answer' && method === 'POST') {
      const found = data.questionId && findQuestion(data.questionId);
      if (found) {
        found.q.stats = found.q.stats || { timesAsked: 0, timesCorrect: 0 };
        found.q.stats.timesAsked += 1;
        if (data.isCorrect) found.q.stats.timesCorrect += 1;
        markQuestions(found.tid, 30000);
      }
      return ok({});
    }
    if (p === '/api/game/finish' && method === 'POST') {
      pushMetaOp({
        type: 'history',
        entry: {
          id: `game_${Date.now()}`, date: nowIso(),
          score: data.score || 0, targetScore: data.targetScore || 100, won: !!data.won,
          selectedTopics: data.selectedTopics || [], totalQuestions: data.totalQuestions || 0, correctAnswers: data.correctAnswers || 0
        }
      });
      return ok({ message: 'Partida guardada en el historial.' });
    }
    if (p === '/api/game/rosco' && method === 'POST') {
      const ids = Array.isArray(data.topicIds) ? data.topicIds : [];
      let notes = ids.map(id => S.notes.get(id)).filter(Boolean);
      if (!notes.length || !notes.some(n => (n.content || '').trim())) notes = Array.from(S.notes.values());
      const text = notes.map(n => n.content || '').join('\n\n');
      const rosco = await engine().ai.generateRoscoQuestions(text, notes.map(n => n.title));
      return ok({ rosco, timeLimitSeconds: 300 });
    }

    // --- Ajustes e IA ---
    if (p === '/api/config' && method === 'GET') {
      const k = engine().getGeminiKey();
      return ok({ hasApiKey: k.length > 10, maskedKey: maskKey(k), targetScore: S.meta.settings.targetScore || 100, pointsPerQuestion: S.meta.settings.pointsPerQuestion || 5 });
    }
    if (p === '/api/config' && method === 'POST') {
      if (typeof data.geminiApiKey === 'string' && data.geminiApiKey.trim()) engine().setGeminiKey(data.geminiApiKey.trim());
      const values = {};
      if (data.targetScore) values.targetScore = parseInt(data.targetScore, 10);
      if (data.pointsPerQuestion) values.pointsPerQuestion = parseInt(data.pointsPerQuestion, 10);
      if (Object.keys(values).length) pushMetaOp({ type: 'settings', values });
      const k = engine().getGeminiKey();
      return ok({ message: 'Configuración actualizada con éxito.', hasApiKey: k.length > 10, targetScore: S.meta.settings.targetScore, pointsPerQuestion: S.meta.settings.pointsPerQuestion });
    }
    if (p === '/api/config/ai-status') {
      const k = engine().getGeminiKey();
      return ok({ hasGeminiKey: k.length > 10, maskedKey: maskKey(k) });
    }
    if (p === '/api/config/gemini-key' && method === 'POST') {
      const k = String(data.apiKey || '').trim();
      if (k.length < 10) return fail('Clave de API inválida.');
      engine().setGeminiKey(k);
      return ok({ message: 'Clave de Gemini guardada en este dispositivo.' });
    }

    // --- Textos bíblicos ---
    if (p === '/api/scripture' && method === 'GET') {
      const ref = url.searchParams.get('ref');
      if (!ref) return fail('Falta el parámetro ref (cita bíblica).');
      let result = null;
      try { result = await engine().scripture.getScriptureText(ref, url.searchParams.get('lang') || undefined); } catch (e) { result = { success: false, error: e.message }; }
      if (result && result.success) return { status: 200, body: result };
      const parsed = engine().scripture.parseScriptureRef(ref);
      const link = parsed ? `https://wol.jw.org/es/wol/b/r4/lp-s/nwt/${parsed.bookNum}/${parsed.chapter}#study=discover&v=${parsed.bookNum}:${parsed.chapter}:${parsed.startVerse}` : 'https://wol.jw.org/es/wol/h/r4/lp-s';
      const hasKey = engine().getGeminiKey().length > 10;
      return fail(hasKey
        ? `No se pudo obtener el texto de ${parsed ? parsed.citation : ref}. Ábrelo en jw.org y pégalo: ${link}`
        : `Para insertar el texto automáticamente añade tu clave gratuita de Gemini en Ajustes. Mientras tanto puedes abrirlo en jw.org: ${link}`, 404, { link, citation: parsed ? parsed.citation : ref });
    }

    // --- Subir documento ---
    if (p === '/api/upload' && method === 'POST') {
      const file = body && typeof body.get === 'function' ? body.get('document') : null;
      if (!file) return fail('No se ha proporcionado ningún archivo.');
      const raw = await extractText(file);
      const text = engine().ai ? String(raw).replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim() : raw;
      if (!text || text.length < 20) return fail('El archivo parece estar vacío o no contiene texto legible.');
      const title = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
      const note = createNote({ title, category: 'spiritual_notes', icon: '📄', content: `# ${title}\n\n${text}`, tags: ['importado'] });
      const qs = await engine().ai.generateQuestionsFromText(text, title, parseInt((body.get('count') || 10), 10));
      const saved = addQuestionsToTopic(note.id, qs);
      return ok({ message: `Tema "${title}" creado con ${saved.length} preguntas guardadas.`, topic: notesAsTopics().find(t => t.id === note.id), questionsCount: saved.length });
    }

    // --- Copia de seguridad / estado ---
    if (p === '/api/backup/download') return { status: 200, body: buildExport() };
    if (p === '/api/health') return ok({ app: 'estudio-personal', mode: 'github', repo: repoLabel() });

    return fail('Ruta no disponible en modo sin servidor.', 404);
  }

  // ------------------------------------------------------------------
  // GitHub
  // ------------------------------------------------------------------
  class HttpError extends Error {
    constructor(status, message) { super(message); this.status = status; }
  }

  async function gh(path, { method = 'GET', body, accept, timeout = 25000, token } = {}) {
    const cfg = getGithubConfig();
    const tok = token || (cfg && cfg.token);
    if (!tok) throw Object.assign(new Error('Sin token de GitHub'), { code: 'noserver' });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      return await nativeFetch(GH_API + path, {
        method,
        headers: {
          Authorization: `Bearer ${tok}`,
          Accept: accept || 'application/vnd.github+json',
          ...(body ? { 'Content-Type': 'application/json' } : {})
        },
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store',
        signal: ctrl.signal
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async function ghJson(path, opts) {
    const res = await gh(path, opts);
    if (!res.ok) {
      let msg = `GitHub respondió ${res.status}`;
      try { const j = await res.json(); if (j.message) msg += `: ${j.message}`; } catch (e) { /* sin cuerpo */ }
      throw new HttpError(res.status, msg);
    }
    return res.status === 204 ? null : res.json();
  }

  const safeName = (id) => String(id).replace(/[^A-Za-z0-9._-]/g, '_');
  const notePath = (id) => `notes/${safeName(id)}.json`;
  const questionsPath = (tid) => `questions/${safeName(tid)}.json`;
  const isDataPath = (p) => p === 'meta.json' || /^notes\/[^/]+\.json$/.test(p) || /^questions\/[^/]+\.json$/.test(p);

  function repoBase() {
    const c = getGithubConfig();
    return `/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}`;
  }

  async function readTree(treeSha) {
    const t = await ghJson(`${repoBase()}/git/trees/${treeSha}?recursive=1`);
    const out = {};
    (t.tree || []).forEach(e => { if (e.type === 'blob' && isDataPath(e.path)) out[e.path] = e.sha; });
    return out;
  }

  const REPO_README = `# Apuntes de Estudio Personal

Este repositorio privado guarda tus apuntes. La app los sincroniza automáticamente:

- \`notes/\` — una nota por archivo (JSON)
- \`questions/\` — preguntas de repaso de cada nota
- \`meta.json\` — carpetas, años, ajustes e historial de partidas

Cada sincronización es un commit, así que tienes el historial completo de cambios
y puedes recuperar cualquier versión anterior desde GitHub.
`;

  async function initRepo() {
    const c = getGithubConfig();
    const res = await gh(`${repoBase()}/contents/README.md`, {
      method: 'PUT',
      body: { message: 'Inicializar apuntes de Estudio Personal', content: b64encodeUtf8(REPO_README), branch: c.branch }
    });
    if (!res.ok && res.status !== 422) throw new HttpError(res.status, `No se pudo inicializar el repositorio (${res.status}).`);
  }

  function mergeMonthContents(remoteContent, localContent) {
    const split = (c) => {
      const parts = String(c || '').split(/\n(?=---\s*\n+## )/);
      return { head: parts[0], blocks: parts.slice(1).map(b => b.trim()) };
    };
    const r = split(remoteContent);
    const l = split(localContent);
    const seen = new Set(r.blocks);
    const extra = l.blocks.filter(b => !seen.has(b));
    if (!extra.length) return remoteContent;
    return [r.head.trim(), ...r.blocks, ...extra].join('\n\n') + '\n';
  }

  function conflictCopy(note, label) {
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
    return cleanNote({
      ...note,
      id: `${note.id}__conflict_${stamp}_${rand(4)}`,
      isMonthDoc: false,
      title: `${note.title} (${label})`,
      tags: Array.from(new Set([...(note.tags || []), 'conflicto'])),
      updatedAt: nowIso()
    });
  }

  let conflictsThisSync = 0;

  function applyRemoteNote(R, changed) {
    if (!R || !R.id) return;
    const id = R.id;
    const y = S.sync;
    const L = S.notes.get(id);
    if (y.pendingDeletes[id]) {
      // Se editó en otro dispositivo después de borrarla aquí: conservarla
      delete y.pendingDeletes[id];
      S.notes.set(id, R); persist.note(R); changed.push(id);
      return;
    }
    if (!y.pendingNotes[id] || !L) {
      if (!L || fingerprint(L) !== fingerprint(R)) changed.push(id);
      S.notes.set(id, R); persist.note(R);
      return;
    }
    if (L.content === R.content) return; // mismo texto: se sube la versión local tal cual
    conflictsThisSync++;
    if (L.isMonthDoc && R.isMonthDoc) {
      const merged = { ...L, content: mergeMonthContents(R.content, L.content), updatedAt: nowIso() };
      S.notes.set(id, merged); persist.note(merged); changed.push(id);
      return;
    }
    if (new Date(R.updatedAt) > new Date(L.updatedAt)) {
      const copy = conflictCopy(L, 'copia de este dispositivo');
      S.notes.set(id, R); persist.note(R);
      delete y.pendingNotes[id];
      saveNote(copy);
      changed.push(id, copy.id);
    } else {
      const copy = conflictCopy(R, 'versión de otro dispositivo');
      saveNote(copy);
      changed.push(copy.id);
    }
  }

  function applyRemoteQuestions(file) {
    if (!file || !file.topicId) return;
    const tid = file.topicId;
    const remote = Array.isArray(file.questions) ? file.questions : [];
    if (!S.sync.pendingQuestions[tid]) {
      S.questions[tid] = remote;
      return;
    }
    const byId = new Map((S.questions[tid] || []).map(q => [q.id, q]));
    for (const rq of remote) {
      const lq = byId.get(rq.id);
      if (!lq) { byId.set(rq.id, rq); continue; }
      const ls = lq.stats || {}, rs = rq.stats || {};
      lq.stats = { timesAsked: Math.max(ls.timesAsked || 0, rs.timesAsked || 0), timesCorrect: Math.max(ls.timesCorrect || 0, rs.timesCorrect || 0) };
    }
    S.questions[tid] = Array.from(byId.values());
  }

  function snapshotPending() {
    const y = S.sync;
    return {
      notes: { ...y.pendingNotes },
      deletes: Object.keys(y.pendingDeletes),
      questions: { ...y.pendingQuestions },
      metaOps: y.metaOps.length
    };
  }

  function clearSnapshot(snap) {
    const y = S.sync;
    Object.entries(snap.notes).forEach(([id, rev]) => { if (y.pendingNotes[id] === rev) delete y.pendingNotes[id]; });
    snap.deletes.forEach(id => { delete y.pendingDeletes[id]; });
    Object.entries(snap.questions).forEach(([tid, rev]) => { if (y.pendingQuestions[tid] === rev) delete y.pendingQuestions[tid]; });
    y.metaOps.splice(0, snap.metaOps);
  }

  async function syncOnce() {
    const cfg = getGithubConfig();
    const base = repoBase();
    const y = S.sync;

    // 1) Último commit del repositorio
    let refRes = await gh(`${base}/git/ref/heads/${encodeURIComponent(cfg.branch)}`);
    if (refRes.status === 404 || refRes.status === 409) {
      await initRepo();
      refRes = await gh(`${base}/git/ref/heads/${encodeURIComponent(cfg.branch)}`);
    }
    if (refRes.status === 401) throw new HttpError(401, 'Token no válido o caducado.');
    if (!refRes.ok) throw new HttpError(refRes.status, `GitHub respondió ${refRes.status}`);
    const headSha = (await refRes.json()).object.sha;

    let treeSha = y.treeSha;
    let remote = y.fileShas;
    if (headSha !== y.headSha || !treeSha) {
      const commit = await ghJson(`${base}/git/commits/${headSha}`);
      treeSha = commit.tree.sha;
      remote = await readTree(treeSha);
    }

    // 2) Traer lo que cambió en otros dispositivos
    const changedPaths = Object.keys(remote).filter(p => remote[p] !== y.fileShas[p]);
    const removedPaths = Object.keys(y.fileShas).filter(p => !(p in remote));
    const changedNotes = [];
    const deletedNotes = [];
    let metaChanged = false;
    let countsChanged = false;

    const blobs = await mapLimit(changedPaths, 6, async (p) => {
      const blob = await ghJson(`${base}/git/blobs/${remote[p]}`);
      try { return [p, JSON.parse(b64decodeUtf8(blob.content))]; } catch (e) { return [p, null]; }
    });

    for (const [p, content] of blobs) {
      if (!content) continue;
      if (p.startsWith('notes/')) applyRemoteNote(content, changedNotes);
      else if (p.startsWith('questions/')) { applyRemoteQuestions(content); countsChanged = true; }
      else if (p === 'meta.json') {
        const newMeta = normalizeMeta(content);
        y.metaOps.forEach(op => applyMetaOp(newMeta, op));
        metaChanged = JSON.stringify(newMeta) !== JSON.stringify(S.meta);
        S.meta = newMeta;
      }
    }

    for (const p of removedPaths) {
      if (p.startsWith('notes/')) {
        const note = Array.from(S.notes.values()).find(n => notePath(n.id) === p);
        if (note && !y.pendingNotes[note.id]) {
          S.notes.delete(note.id); persist.noteDelete(note.id); deletedNotes.push(note.id);
        }
      } else if (p.startsWith('questions/')) {
        const tid = Object.keys(S.questions).find(t => questionsPath(t) === p);
        if (tid && !y.pendingQuestions[tid]) { delete S.questions[tid]; countsChanged = true; }
      }
    }

    y.fileShas = remote;
    y.headSha = headSha;
    y.treeSha = treeSha;
    persist.meta();
    persist.questions();
    persist.sync();

    if (changedNotes.length || deletedNotes.length || metaChanged || countsChanged) {
      window.dispatchEvent(new CustomEvent('ep:remote-changes', {
        detail: { changed: changedNotes, deleted: deletedNotes, categoriesChanged: metaChanged, countsChanged }
      }));
    }

    // 3) Subir lo pendiente en un único commit
    const snap = snapshotPending();
    const entries = [];
    Object.keys(snap.notes).forEach(id => {
      const n = S.notes.get(id);
      if (n) entries.push({ path: notePath(id), mode: '100644', type: 'blob', content: JSON.stringify(cleanNote(n), null, 2) + '\n' });
    });
    snap.deletes.forEach(id => {
      if (remote[notePath(id)]) entries.push({ path: notePath(id), mode: '100644', type: 'blob', sha: null });
    });
    Object.keys(snap.questions).forEach(tid => {
      const list = S.questions[tid] || [];
      if (list.length) {
        entries.push({ path: questionsPath(tid), mode: '100644', type: 'blob', content: JSON.stringify({ topicId: tid, questions: list }, null, 2) + '\n' });
      } else if (remote[questionsPath(tid)]) {
        entries.push({ path: questionsPath(tid), mode: '100644', type: 'blob', sha: null });
      }
    });
    if (snap.metaOps > 0 || !remote['meta.json']) {
      entries.push({ path: 'meta.json', mode: '100644', type: 'blob', content: JSON.stringify(S.meta, null, 2) + '\n' });
    }

    if (!entries.length) {
      clearSnapshot(snap);
      persist.sync();
      return { done: true };
    }

    const nNotes = Object.keys(snap.notes).length + snap.deletes.length;
    const message = nNotes
      ? `Apuntes: ${nNotes} ${nNotes === 1 ? 'cambio' : 'cambios'} desde ${deviceName()}`
      : `Ajustes y preguntas desde ${deviceName()}`;
    const newTree = await ghJson(`${base}/git/trees`, { method: 'POST', body: { base_tree: treeSha, tree: entries } });
    const commit = await ghJson(`${base}/git/commits`, { method: 'POST', body: { message, tree: newTree.sha, parents: [headSha] } });
    const upd = await gh(`${base}/git/refs/heads/${encodeURIComponent(cfg.branch)}`, { method: 'PATCH', body: { sha: commit.sha, force: false } });
    if (upd.status === 422 || upd.status === 409) return { retry: true }; // otro dispositivo subió algo justo ahora
    if (!upd.ok) throw new HttpError(upd.status, `No se pudo guardar en GitHub (${upd.status}).`);

    clearSnapshot(snap);
    y.fileShas = await readTree(newTree.sha);
    y.headSha = commit.sha;
    y.treeSha = newTree.sha;
    persist.sync();
    return { done: pendingCount() === 0 };
  }

  function deviceName() {
    const ua = navigator.userAgent;
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/iPad/.test(ua)) return 'iPad';
    if (/Android/.test(ua)) return 'Android';
    if (/Mac/.test(ua)) return 'Mac';
    if (/Windows/.test(ua)) return 'Windows';
    return 'navegador';
  }

  let syncTimer = null;
  let syncRunning = false;
  let syncAgain = false;

  function scheduleSync(delay = 2000) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => { syncNow(); }, delay);
  }

  async function syncNow({ force = false } = {}) {
    if (!getGithubConfig()) { setStatus('noserver'); return; }
    if (syncRunning) { syncAgain = true; return; }
    if (S.status === 'auth' && !force) return;
    syncRunning = true;
    conflictsThisSync = 0;
    setStatus('syncing');
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        const r = await syncOnce();
        if (r.done) break;
      }
      S.lastSyncAt = nowIso();
      persist.sync();
      setStatus(pendingCount() ? 'syncing' : 'synced');
      if (conflictsThisSync) {
        notify(`Se ${conflictsThisSync === 1 ? 'resolvió 1 conflicto' : `resolvieron ${conflictsThisSync} conflictos`}: la otra versión se guardó como copia "(conflicto)".`, 'warning');
      }
      if (pendingCount()) scheduleSync(1500);
    } catch (err) {
      if (err && err.code === 'noserver') setStatus('noserver');
      else if (err && err.status === 401) setStatus('auth', 'El token de GitHub no es válido o ha caducado.');
      else if (err && (err.status === 403 || err.status === 404)) setStatus('error', err.status === 404
        ? 'No se encuentra el repositorio o el token no tiene acceso a él.'
        : 'GitHub rechazó la operación (permisos del token o límite de uso).');
      else if (err && (err.name === 'AbortError' || err.name === 'TypeError')) setStatus('offline');
      else { console.warn('[Sync]', err); setStatus('error', err.message); }
    } finally {
      syncRunning = false;
      if (syncAgain) { syncAgain = false; scheduleSync(500); }
    }
  }

  // ------------------------------------------------------------------
  // Importar / exportar
  // ------------------------------------------------------------------
  function buildExport() {
    const questions = Object.values(S.questions).flat();
    return {
      format: 'estudio-personal',
      version: 2,
      exportedAt: nowIso(),
      config: { availableYears: availableYears(), targetScore: S.meta.settings.targetScore, pointsPerQuestion: S.meta.settings.pointsPerQuestion },
      categories: S.meta.categories,
      notes: Array.from(S.notes.values()),
      questions,
      history: S.meta.history
    };
  }

  const KNOWN_TOPIC_TITLES = {
    'books of the bible': 'note_apuntes_books_bible',
    'jacob': 'note_apuntes_jacob',
    'kings of juda and israel 1': 'note_apuntes_kings_2',
    'kings of juda and israel': 'note_apuntes_kings_1'
  };

  /** Importa una base de datos del formato antiguo (data/database.json) o una copia exportada. */
  function importDatabase(db, { overwrite = false } = {}) {
    if (!db || !Array.isArray(db.notes)) throw new Error('El archivo no parece una copia de Estudio Personal.');
    let added = 0;
    for (const raw of db.notes) {
      if (!raw || !raw.id) continue;
      const n = cleanNote(raw);
      const cur = S.notes.get(n.id);
      if (!cur || overwrite) {
        saveNote(n);
        added++;
      } else if (cur.content === n.content) {
        continue;
      } else if (cur.isMonthDoc && n.isMonthDoc) {
        // Documento mensual en ambos lados: unir los días de los dos
        saveNote({ ...cur, content: mergeMonthContents(n.content, cur.content), updatedAt: nowIso() });
        added++;
      } else if (new Date(n.updatedAt || 0) > new Date(cur.updatedAt || 0)) {
        saveNote(conflictCopy(cur, 'antes de importar'));
        saveNote(n);
        added++;
      } else {
        saveNote(conflictCopy(n, 'importada'));
        added++;
      }
    }
    // Preguntas: las de temas-archivo antiguos se enlazan con su nota
    const topicToNote = {};
    (db.topics || []).forEach(t => { if (t.noteId) topicToNote[t.id] = t.noteId; });
    const notesList = Array.from(S.notes.values());
    const resolveTopic = (q) => {
      if (S.notes.has(q.topicId)) return q.topicId;
      if (topicToNote[q.topicId] && S.notes.has(topicToNote[q.topicId])) return topicToNote[q.topicId];
      const key = norm(q.topicTitle);
      if (KNOWN_TOPIC_TITLES[key] && S.notes.has(KNOWN_TOPIC_TITLES[key])) return KNOWN_TOPIC_TITLES[key];
      const match = notesList.find(n => norm(n.title).startsWith(key) || key.startsWith(norm(n.title)));
      return match ? match.id : null;
    };
    const touched = new Set();
    for (const q of (db.questions || [])) {
      const tid = resolveTopic(q);
      if (!tid) continue;
      const list = S.questions[tid] || (S.questions[tid] = []);
      if (list.some(x => x.id === q.id || x.question === q.question)) continue;
      list.push({ ...q, topicId: tid, topicTitle: (S.notes.get(tid) || {}).title || q.topicTitle });
      touched.add(tid);
    }
    touched.forEach(tid => markQuestions(tid));

    const meta = normalizeMeta({
      ...S.meta,
      categories: Array.isArray(db.categories) && db.categories.length ? db.categories : S.meta.categories,
      years: Array.from(new Set([...(S.meta.years || []), ...(((db.config || {}).availableYears) || [])])),
      settings: {
        ...S.meta.settings,
        ...(db.config && db.config.targetScore ? { targetScore: db.config.targetScore } : {}),
        ...(db.config && db.config.pointsPerQuestion ? { pointsPerQuestion: db.config.pointsPerQuestion } : {})
      },
      history: [...(S.meta.history || []), ...((db.history || []).filter(h => !(S.meta.history || []).some(x => x.id === h.id)))].slice(0, 50)
    });
    pushMetaOp({ type: 'replaceMeta', meta });
    window.dispatchEvent(new CustomEvent('ep:remote-changes', { detail: { changed: [], deleted: [], categoriesChanged: true, countsChanged: true, imported: true } }));
    return { notes: added, questions: touched.size };
  }

  async function importFile(file) {
    const text = await file.text();
    let db;
    try { db = JSON.parse(text.replace(/^﻿/, '')); } catch (e) { throw new Error('El archivo no es un JSON válido.'); }
    const r = importDatabase(db);
    syncNow();
    return r;
  }

  /** Primera conexión: si el repositorio de apuntes está vacío, traer data/database.json del repositorio de la app. */
  async function importFromCodeRepo() {
    const code = codeRepoFromLocation();
    if (!code) return null;
    const res = await gh(`/repos/${code.owner}/${code.repo}/contents/data/database.json`, { accept: 'application/vnd.github.raw+json', timeout: 60000 });
    if (!res.ok) return null;
    const db = JSON.parse((await res.text()).replace(/^﻿/, ''));
    return importDatabase(db);
  }

  // ------------------------------------------------------------------
  // Conexión con GitHub (pantalla de configuración)
  // ------------------------------------------------------------------
  async function connect({ token, repoFull }) {
    token = String(token || '').trim();
    const [owner, repo] = String(repoFull || '').trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').split('/');
    if (!token) throw new Error('Pega tu token de GitHub.');
    if (!owner || !repo) throw new Error('Escribe el repositorio como usuario/nombre (ej.: juan/estudio-notas).');

    let res;
    try {
      res = await gh(`/repos/${owner}/${repo}`, { token, timeout: 15000 });
    } catch (e) {
      throw new Error('No hay conexión con GitHub. Inténtalo cuando tengas Internet.');
    }
    if (res.status === 401) throw new Error('El token no es válido. Cópialo de nuevo desde GitHub.');
    if (res.status === 404) {
      // Intentar crear el repositorio privado (funciona con tokens "classic" con permiso repo)
      const user = await gh('/user', { token }).then(r => r.ok ? r.json() : null).catch(() => null);
      if (user && user.login && user.login.toLowerCase() === owner.toLowerCase()) {
        const created = await gh('/user/repos', { token, method: 'POST', body: { name: repo, private: true, description: 'Apuntes de Estudio Personal (privado)', auto_init: false } });
        if (!created.ok) {
          throw new Error(`No existe el repositorio ${owner}/${repo} y el token no puede crearlo. Créalo en github.com/new (privado) y vuelve a intentarlo.`);
        }
        res = await gh(`/repos/${owner}/${repo}`, { token });
      } else {
        throw new Error(`No se encuentra ${owner}/${repo} o el token no tiene acceso a él.`);
      }
    }
    if (!res.ok) throw new Error(`GitHub respondió ${res.status}.`);
    const info = await res.json();
    if (info.permissions && info.permissions.push === false) throw new Error('El token no tiene permiso de escritura en ese repositorio (Contents: Read and write).');
    if (!info.private) notify('Aviso: ese repositorio es público. Tus apuntes serían visibles para cualquiera; mejor hazlo privado en GitHub (Settings → Danger zone).', 'warning', 9000);

    const prev = getGithubConfig();
    const sameRepo = prev && prev.owner.toLowerCase() === owner.toLowerCase() && prev.repo.toLowerCase() === repo.toLowerCase();
    setGithubConfig({ token, owner: info.owner.login, repo: info.name, branch: info.default_branch || 'main' });
    if (!sameRepo) {
      // Repositorio nuevo para este dispositivo: todo lo local se considera pendiente de subir
      const keep = S.sync;
      S.sync = freshSyncState();
      S.notes.forEach((n, id) => { S.sync.pendingNotes[id] = ++S.sync.rev; });
      Object.keys(S.questions).forEach(tid => { S.sync.pendingQuestions[tid] = ++S.sync.rev; });
      if (S.notes.size) S.sync.metaOps.push({ type: 'replaceMeta', meta: clone(S.meta) });
      void keep;
      persist.sync();
    }
    setStatus('syncing');
    await syncNow({ force: true });

    // ¿Repositorio vacío? Importar los apuntes existentes de la app
    const hasRemoteNotes = Object.keys(S.sync.fileShas).some(p => p.startsWith('notes/'));
    if (!hasRemoteNotes && S.notes.size === 0) {
      try {
        const r = await importFromCodeRepo();
        if (r && r.notes) {
          notify(`Importados ${r.notes} apuntes. Subiéndolos a tu repositorio privado…`, 'success', 6000);
          await syncNow({ force: true });
        }
      } catch (e) { console.warn('[Importar]', e); }
      if (S.notes.size === 0) {
        setTimeout(() => notify('Conectado. Para cargar tus apuntes existentes ve a Ajustes → Importar copia y elige tu archivo .json.', 'info', 9000), 800);
      }
    }
    return info;
  }

  function disconnect() {
    setGithubConfig(null);
    S.sync = { ...freshSyncState(), pendingNotes: {}, rev: S.sync.rev };
    // Lo local queda pendiente por si se vuelve a conectar
    S.notes.forEach((n, id) => { S.sync.pendingNotes[id] = ++S.sync.rev; });
    persist.sync();
    setStatus('noserver');
  }

  let setupResolver = null;

  function buildSetupOverlay() {
    let el = document.getElementById('loginOverlay');
    if (el) return el;
    const code = codeRepoFromLocation();
    const docsUrl = code ? `https://github.com/${code.owner}/${code.repo}/blob/main/docs/GITHUB-SETUP.md` : 'docs/GITHUB-SETUP.md';
    el = document.createElement('div');
    el.id = 'loginOverlay';
    el.className = 'login-overlay';
    el.innerHTML = `
      <form class="login-card" id="setupForm" autocomplete="off">
        <div class="login-brand">
          <img src="icons/icon.svg" alt="" width="44" height="44">
          <div>
            <div class="login-title">Estudio Personal</div>
            <div class="login-subtitle">Guarda tus apuntes en tu GitHub privado y úsalos en todos tus dispositivos</div>
          </div>
        </div>
        <label class="field">
          <span class="field-label">Token de GitHub</span>
          <input type="password" id="setupToken" class="form-input" placeholder="github_pat_… o ghp_…" required spellcheck="false">
          <span class="field-help">Se guarda solo en este dispositivo. <a href="${docsUrl}" target="_blank" rel="noopener">¿Cómo lo consigo?</a></span>
        </label>
        <label class="field">
          <span class="field-label">Repositorio privado para los apuntes</span>
          <input type="text" id="setupRepo" class="form-input" placeholder="tu-usuario/estudio-notas" required spellcheck="false">
        </label>
        <div class="login-error" id="setupError" role="alert"></div>
        <button type="submit" class="btn-primary btn-full" id="setupSubmit">Conectar</button>
        <button type="button" class="btn-ghost btn-full" id="setupSkip">Usar solo en este dispositivo</button>
        <p class="login-foot">Tus apuntes también se guardan en este dispositivo, así que puedes escribir sin conexión. Se suben a GitHub en cuanto haya Internet.</p>
      </form>`;
    document.body.appendChild(el);

    const form = el.querySelector('#setupForm');
    const err = el.querySelector('#setupError');
    const btn = el.querySelector('#setupSubmit');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.textContent = '';
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Conectando…';
      try {
        await connect({ token: el.querySelector('#setupToken').value, repoFull: el.querySelector('#setupRepo').value });
        hideSetup();
      } catch (ex) {
        err.textContent = ex.message || 'No se pudo conectar.';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Conectar';
      }
    });
    el.querySelector('#setupSkip').addEventListener('click', () => {
      try { localStorage.setItem('ep_setup_skipped', '1'); } catch (e) { /* ignorar */ }
      hideSetup();
    });
    return el;
  }

  function showSetup() {
    const el = buildSetupOverlay();
    const cfg = getGithubConfig();
    const code = codeRepoFromLocation();
    el.querySelector('#setupRepo').value = cfg ? `${cfg.owner}/${cfg.repo}` : (code ? `${code.owner}/estudio-notas` : '');
    el.querySelector('#setupToken').value = cfg ? cfg.token : '';
    el.querySelector('#setupError').textContent = S.status === 'auth' ? 'El token guardado ya no funciona. Pega uno nuevo.' : '';
    el.classList.add('active');
    setTimeout(() => el.querySelector(cfg ? '#setupToken' : '#setupToken').focus(), 50);
    return new Promise(resolve => { setupResolver = resolve; });
  }

  function hideSetup() {
    const el = document.getElementById('loginOverlay');
    if (el) el.classList.remove('active');
    if (setupResolver) { setupResolver(); setupResolver = null; }
  }

  // ------------------------------------------------------------------
  // Estado visible
  // ------------------------------------------------------------------
  const STATUS_TEXT = {
    idle: 'Preparando…',
    syncing: 'Sincronizando…',
    synced: 'Sincronizado',
    offline: 'Sin conexión',
    auth: 'Revisa el token',
    error: 'Error al sincronizar',
    noserver: 'Solo en este dispositivo'
  };

  function setStatus(status, detail = '') {
    S.status = status;
    S.statusDetail = detail;
    emitStatus();
  }

  function relativeTime(iso) {
    if (!iso) return 'nunca';
    const diff = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 10) return 'ahora mismo';
    if (diff < 60) return `hace ${diff} s`;
    if (diff < 3600) return `hace ${Math.round(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.round(diff / 3600)} h`;
    return new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function statusInfo() {
    const pending = pendingCount();
    let label = STATUS_TEXT[S.status] || S.status;
    if (S.status !== 'synced' && S.status !== 'syncing' && pending) label += ` · ${pending} pendiente${pending === 1 ? '' : 's'}`;
    return {
      status: S.status, label, pending,
      lastSyncAt: S.lastSyncAt, lastSyncText: relativeTime(S.lastSyncAt),
      repo: repoLabel(), detail: S.statusDetail, notesCount: S.notes.size
    };
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function emitStatus() {
    const info = statusInfo();
    const pill = document.getElementById('syncStatusPill');
    if (pill) {
      pill.dataset.state = info.status;
      const label = pill.querySelector('.sync-label');
      if (label) label.textContent = info.label;
      pill.title = `${info.label}\nÚltima sincronización: ${info.lastSyncText}${info.repo ? `\nGitHub: ${info.repo}` : ''}`;
    }
    const panel = document.getElementById('syncSettingsStatus');
    if (panel) {
      panel.innerHTML = `
        <div><strong>${escapeHtml(info.label)}</strong></div>
        <div>${info.repo ? `Repositorio: <a href="https://github.com/${escapeHtml(info.repo)}" target="_blank" rel="noopener">${escapeHtml(info.repo)}</a>` : 'Sin conectar a GitHub'}</div>
        <div>Última sincronización: ${info.lastSyncText}</div>
        <div>${info.notesCount} apuntes en este dispositivo · ${info.pending} cambio${info.pending === 1 ? '' : 's'} pendiente${info.pending === 1 ? '' : 's'}</div>
        ${info.detail ? `<div class="sync-error-detail">${escapeHtml(info.detail)}</div>` : ''}`;
    }
    window.dispatchEvent(new CustomEvent('ep:sync-status', { detail: info }));
  }

  function notify(message, type = 'info', ms) {
    if (typeof window.showAppToast === 'function') window.showAppToast(message, type, ms);
  }

  // ------------------------------------------------------------------
  // Interceptor de fetch: /api/* se responde localmente
  // ------------------------------------------------------------------
  window.fetch = async function (input, init = {}) {
    let urlStr;
    let method;
    let body;
    if (input instanceof Request) {
      urlStr = input.url;
      method = (input.method || 'GET').toUpperCase();
      if (method !== 'GET' && method !== 'HEAD') body = await input.clone().text();
    } else {
      urlStr = String(input);
      method = String((init && init.method) || 'GET').toUpperCase();
      body = init && init.body;
    }
    const url = new URL(urlStr, location.href);
    if (url.origin !== location.origin || !/\/api\//.test(url.pathname)) return nativeFetch(input, init);

    await ready;
    try {
      const r = await route(method, url, body);
      return jsonResponse(r.body, r.status || 200);
    } catch (err) {
      console.warn('[Local API]', err);
      return jsonResponse({ success: false, error: err.message || 'Error inesperado' }, 500);
    }
  };

  // ------------------------------------------------------------------
  // Arranque
  // ------------------------------------------------------------------
  async function loadLocal() {
    const [notes, meta, questions, sync] = await Promise.all([
      idb.getAllNotes().catch(() => null),
      idb.get('meta').catch(() => null),
      idb.get('questions').catch(() => null),
      idb.get('sync').catch(() => null)
    ]);
    (notes || []).forEach(n => S.notes.set(n.id, n));
    if (meta && (meta.categories || meta.years)) S.meta = normalizeMeta(meta);
    if (questions && typeof questions === 'object') S.questions = questions;
    if (sync && sync.fileShas) {
      S.sync = { ...freshSyncState(), ...sync };
      S.lastSyncAt = sync.lastSyncAt || null;
    }
  }

  const ready = (async () => {
    try { await loadLocal(); } catch (e) { console.warn('[Local] No se pudo leer la copia local:', e); }
    let skipped = false;
    try { skipped = localStorage.getItem('ep_setup_skipped') === '1'; } catch (e) { /* ignorar */ }
    if (!getGithubConfig()) {
      setStatus('noserver');
      if (!skipped) await showSetup();
    } else if (S.notes.size === 0 && !S.sync.headSha) {
      // Dispositivo nuevo ya configurado: descargar todo antes de mostrar la app
      await syncNow({ force: true });
    } else {
      setTimeout(() => syncNow(), 300);
    }
    emitStatus();
  })();

  setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, SYNC_INTERVAL_MS);
  window.addEventListener('online', () => syncNow());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncNow();
  });
  setInterval(emitStatus, 20000);
  document.addEventListener('DOMContentLoaded', emitStatus);

  window.EP = {
    ready,
    syncNow: () => syncNow({ force: true }),
    status: statusInfo,
    showSetup,
    showLogin: showSetup,
    disconnect,
    repo: repoLabel,
    exportLocal() {
      const data = buildExport();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      a.download = `estudio_personal_${todayStr()}.json`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    },
    importFile,
    _importDatabase: importDatabase
  };
})();
