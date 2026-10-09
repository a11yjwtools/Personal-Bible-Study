// ==========================================================================
// ESTUDIO PERSONAL — BIBLIA SIN CONEXIÓN
// --------------------------------------------------------------------------
// Importa la Traducción del Nuevo Mundo en formato EPUB (descargada por el
// usuario desde jw.org) y la guarda SOLO en este dispositivo (IndexedDB).
// No se sube a GitHub ni a ningún servidor.
//
// window.EPBible.lookup('Prov. 3:5, 6', 'es') →
//   { success, text, citation, lang, translation, passages: [...] }
// ==========================================================================
(function () {
  'use strict';

  const DB_NAME = 'estudio-personal-biblia';
  const STORE = 'bibles';

  // ------------------------------------------------------------------
  // Libros: nombres y abreviaturas (estilo jw.org) en español e inglés
  // ------------------------------------------------------------------
  const BOOKS = [
    [1, 'Génesis', 'Gén.', 'Genesis', 'Gen.'], [2, 'Éxodo', 'Éx.', 'Exodus', 'Ex.'],
    [3, 'Levítico', 'Lev.', 'Leviticus', 'Lev.'], [4, 'Números', 'Núm.', 'Numbers', 'Num.'],
    [5, 'Deuteronomio', 'Deut.', 'Deuteronomy', 'Deut.'], [6, 'Josué', 'Jos.', 'Joshua', 'Josh.'],
    [7, 'Jueces', 'Juec.', 'Judges', 'Judg.'], [8, 'Rut', 'Rut', 'Ruth', 'Ruth'],
    [9, '1 Samuel', '1 Sam.', '1 Samuel', '1 Sam.'], [10, '2 Samuel', '2 Sam.', '2 Samuel', '2 Sam.'],
    [11, '1 Reyes', '1 Rey.', '1 Kings', '1 Ki.'], [12, '2 Reyes', '2 Rey.', '2 Kings', '2 Ki.'],
    [13, '1 Crónicas', '1 Crón.', '1 Chronicles', '1 Chron.'], [14, '2 Crónicas', '2 Crón.', '2 Chronicles', '2 Chron.'],
    [15, 'Esdras', 'Esd.', 'Ezra', 'Ezra'], [16, 'Nehemías', 'Neh.', 'Nehemiah', 'Neh.'],
    [17, 'Ester', 'Est.', 'Esther', 'Esther'], [18, 'Job', 'Job', 'Job', 'Job'],
    [19, 'Salmos', 'Sal.', 'Psalms', 'Ps.'], [20, 'Proverbios', 'Prov.', 'Proverbs', 'Prov.'],
    [21, 'Eclesiastés', 'Ecl.', 'Ecclesiastes', 'Eccl.'], [22, 'El Cantar de los Cantares', 'Cant.', 'Song of Solomon', 'Song of Sol.'],
    [23, 'Isaías', 'Is.', 'Isaiah', 'Isa.'], [24, 'Jeremías', 'Jer.', 'Jeremiah', 'Jer.'],
    [25, 'Lamentaciones', 'Lam.', 'Lamentations', 'Lam.'], [26, 'Ezequiel', 'Ezeq.', 'Ezekiel', 'Ezek.'],
    [27, 'Daniel', 'Dan.', 'Daniel', 'Dan.'], [28, 'Oseas', 'Os.', 'Hosea', 'Hos.'],
    [29, 'Joel', 'Joel', 'Joel', 'Joel'], [30, 'Amós', 'Amós', 'Amos', 'Amos'],
    [31, 'Abdías', 'Abd.', 'Obadiah', 'Obad.'], [32, 'Jonás', 'Jon.', 'Jonah', 'Jonah'],
    [33, 'Miqueas', 'Miq.', 'Micah', 'Mic.'], [34, 'Nahúm', 'Nah.', 'Nahum', 'Nah.'],
    [35, 'Habacuc', 'Hab.', 'Habakkuk', 'Hab.'], [36, 'Sofonías', 'Sof.', 'Zephaniah', 'Zeph.'],
    [37, 'Ageo', 'Ageo', 'Haggai', 'Hag.'], [38, 'Zacarías', 'Zac.', 'Zechariah', 'Zech.'],
    [39, 'Malaquías', 'Mal.', 'Malachi', 'Mal.'], [40, 'Mateo', 'Mat.', 'Matthew', 'Matt.'],
    [41, 'Marcos', 'Mar.', 'Mark', 'Mark'], [42, 'Lucas', 'Luc.', 'Luke', 'Luke'],
    [43, 'Juan', 'Juan', 'John', 'John'], [44, 'Hechos', 'Hech.', 'Acts', 'Acts'],
    [45, 'Romanos', 'Rom.', 'Romans', 'Rom.'], [46, '1 Corintios', '1 Cor.', '1 Corinthians', '1 Cor.'],
    [47, '2 Corintios', '2 Cor.', '2 Corinthians', '2 Cor.'], [48, 'Gálatas', 'Gál.', 'Galatians', 'Gal.'],
    [49, 'Efesios', 'Efes.', 'Ephesians', 'Eph.'], [50, 'Filipenses', 'Filip.', 'Philippians', 'Phil.'],
    [51, 'Colosenses', 'Col.', 'Colossians', 'Col.'], [52, '1 Tesalonicenses', '1 Tes.', '1 Thessalonians', '1 Thess.'],
    [53, '2 Tesalonicenses', '2 Tes.', '2 Thessalonians', '2 Thess.'], [54, '1 Timoteo', '1 Tim.', '1 Timothy', '1 Tim.'],
    [55, '2 Timoteo', '2 Tim.', '2 Timothy', '2 Tim.'], [56, 'Tito', 'Tito', 'Titus', 'Titus'],
    [57, 'Filemón', 'Filem.', 'Philemon', 'Philem.'], [58, 'Hebreos', 'Heb.', 'Hebrews', 'Heb.'],
    [59, 'Santiago', 'Sant.', 'James', 'Jas.'], [60, '1 Pedro', '1 Ped.', '1 Peter', '1 Pet.'],
    [61, '2 Pedro', '2 Ped.', '2 Peter', '2 Pet.'], [62, '1 Juan', '1 Juan', '1 John', '1 John'],
    [63, '2 Juan', '2 Juan', '2 John', '2 John'], [64, '3 Juan', '3 Juan', '3 John', '3 John'],
    [65, 'Judas', 'Jud.', 'Jude', 'Jude'], [66, 'Apocalipsis', 'Apoc.', 'Revelation', 'Rev.']
  ];
  // Abreviaturas y variantes adicionales frecuentes
  const EXTRA = {
    es: {
      1: ['gn', 'ge'], 2: ['ex', 'exo'], 4: ['num', 'nm'], 5: ['dt'], 7: ['jue'], 19: ['salmo', 'sl', 'ps'], 20: ['pr'],
      21: ['ec', 'eclesiastes'], 22: ['cantares', 'cantar de los cantares', 'cnt'], 23: ['isa'], 26: ['ez', 'eze'],
      40: ['mt'], 41: ['mc', 'mr'], 42: ['lc'], 43: ['jn'], 44: ['hch', 'hechos'], 49: ['ef'], 50: ['fil', 'flp'],
      57: ['flm', 'filemon'], 59: ['stg', 'sant'], 65: ['judas'], 66: ['ap', 'apo', 'revelacion']
    },
    en: {
      1: ['gn', 'ge'], 2: ['exo', 'exod'], 3: ['lv'], 4: ['nm'], 5: ['dt'], 6: ['jos'], 7: ['jdg'], 8: ['rth'],
      11: ['1 kgs', '1 kings', '1 kin'], 12: ['2 kgs', '2 kings', '2 kin'], 13: ['1 chr', '1 ch'], 14: ['2 chr', '2 ch'],
      17: ['est', 'esth'], 19: ['psa', 'psalm', 'pss'], 20: ['pr', 'prv'], 21: ['ecc', 'eccles', 'qoh'],
      22: ['song', 'song of songs', 'sos', 'canticles'], 23: ['is'], 26: ['ezk', 'eze'], 28: ['ho'], 31: ['ob'],
      32: ['jon', 'jnh'], 33: ['mi'], 36: ['zep'], 37: ['hg'], 38: ['zec'], 40: ['mt', 'mat'], 41: ['mk', 'mrk', 'mar'],
      42: ['lk', 'luk'], 43: ['jn', 'jhn'], 44: ['ac'], 45: ['ro', 'rm'], 49: ['ephes'], 50: ['php', 'phi'],
      52: ['1 th'], 53: ['2 th'], 54: ['1 ti'], 55: ['2 ti'], 56: ['tit'], 57: ['phm', 'phlm'], 59: ['jam', 'jms', 'jm'],
      60: ['1 pe', '1 pt'], 61: ['2 pe', '2 pt'], 62: ['1 jn'], 63: ['2 jn'], 64: ['3 jn'], 65: ['jud', 'jd'], 66: ['re', 'revelations', 'apoc']
    }
  };
  const ONE_CHAPTER = new Set([31, 57, 63, 64, 65]); // Abdías, Filemón, 2 y 3 Juan, Judas

  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\./g, ' ').replace(/^([123])\s*/, '$1 ').replace(/\s+/g, ' ').trim();

  // índice: forma normalizada → [{ num, lang }]
  const INDEX = new Map();
  const FULL = []; // [{ key, num, lang }] para búsqueda por prefijo
  function addKey(key, num, lang) {
    const k = norm(key);
    if (!k) return;
    const list = INDEX.get(k) || [];
    if (!list.some(x => x.num === num && x.lang === lang)) list.push({ num, lang });
    INDEX.set(k, list);
  }
  BOOKS.forEach(([num, es, esAb, en, enAb]) => {
    addKey(es, num, 'es'); addKey(esAb, num, 'es');
    addKey(en, num, 'en'); addKey(enAb, num, 'en');
    FULL.push({ key: norm(es), num, lang: 'es' }, { key: norm(en), num, lang: 'en' });
  });
  ['es', 'en'].forEach(lang => Object.entries(EXTRA[lang]).forEach(([num, arr]) => arr.forEach(a => addKey(a, Number(num), lang))));

  function resolveBook(raw) {
    const k = norm(raw);
    if (!k) return [];
    let hits = INDEX.get(k) || [];
    if (!hits.length && k.replace(/ /g, '').length >= 3) {
      // Prefijo único de un nombre completo (p. ej. "Proverb", "Filipen")
      hits = FULL.filter(f => f.key.startsWith(k)).map(f => ({ num: f.num, lang: f.lang }));
    }
    return hits;
  }

  // ------------------------------------------------------------------
  // Interpretar referencias: "Prov. 3:5, 6", "Rom. 5:12; 6:23", "Judas 3",
  // "1 Cor. 13:4-8", "Gén. 1:1–2:3", "Mateo 24:14 y 28:19, 20"
  // ------------------------------------------------------------------
  function parseReferences(input, hintLang) {
    let text = String(input || '')
      .replace(/[–—‒]/g, '-')
      .replace(/[“”"«»()[\]]/g, ' ')
      .replace(/\s+y\s+/gi, '; ').replace(/\s+and\s+/gi, '; ')
      .replace(/\s+/g, ' ').trim();
    const segments = text.split(/\s*;\s*/).filter(Boolean);
    const out = [];
    let current = null; // { num, lang }
    for (const seg of segments) {
      const m = seg.match(/^((?:[1-3]\s*)?[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ.\s]*?)\.?\s*(\d+)(?:\s*[:.]\s*([\d\s,\-:]+))?\s*$/);
      let bookInfo = null;
      let rest = seg;
      if (m) {
        const hits = resolveBook(m[1]);
        if (hits.length) {
          const langs = new Set(hits.map(h => h.lang));
          let lang = hintLang && langs.has(hintLang) ? hintLang : (langs.size === 1 ? [...langs][0] : (hintLang || 'es'));
          const choice = hits.find(h => h.lang === lang) || hits[0];
          bookInfo = { num: choice.num, lang: langs.size === 1 ? [...langs][0] : lang, explicitLang: langs.size === 1 };
          rest = m[3] !== undefined ? `${m[2]}:${m[3]}` : m[2];
        }
      }
      if (bookInfo) current = bookInfo;
      if (!current) continue;
      const passages = parseChapterVerses(rest.trim(), current.num);
      passages.forEach(p => out.push({ ...p, book: current.num, lang: current.lang, explicitLang: current.explicitLang }));
    }
    return out;
  }

  // "3:5, 6" | "3:5-8" | "1:1-2:3" | "3" (libro de un capítulo o capítulo entero)
  function parseChapterVerses(s, bookNum) {
    const res = [];
    if (!/^\d/.test(s)) return res;
    if (!s.includes(':')) {
      const n = parseInt(s, 10);
      if (ONE_CHAPTER.has(bookNum)) res.push({ chapter: 1, verses: [[n, n]] });
      else res.push({ chapter: n, verses: null }); // capítulo completo
      return res;
    }
    const cross = s.match(/^(\d+):(\d+)\s*-\s*(\d+):(\d+)$/);
    if (cross) {
      const [c1, v1, c2, v2] = cross.slice(1).map(Number);
      for (let c = c1; c <= c2; c++) res.push({ chapter: c, verses: [[c === c1 ? v1 : 1, c === c2 ? v2 : 999]] });
      return res;
    }
    const [chStr, vStr] = s.split(':');
    const chapter = parseInt(chStr, 10);
    const ranges = [];
    vStr.split(',').map(x => x.trim()).filter(Boolean).forEach(part => {
      const r = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
      if (r) ranges.push([parseInt(r[1], 10), r[2] ? parseInt(r[2], 10) : parseInt(r[1], 10)]);
    });
    if (ranges.length) res.push({ chapter, verses: ranges });
    return res;
  }

  // ------------------------------------------------------------------
  // Almacenamiento (solo en este dispositivo)
  // ------------------------------------------------------------------
  let dbp = null;
  function db() {
    if (!dbp) {
      dbp = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbp;
  }
  async function idb(mode, fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(STORE, mode);
      const r = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(r && 'result' in r ? r.result : undefined);
      tx.onerror = () => reject(tx.error);
    });
  }
  const memory = {};
  async function getBible(lang) {
    if (memory[lang] !== undefined) return memory[lang];
    try { memory[lang] = (await idb('readonly', st => st.get(lang))) || null; } catch (e) { memory[lang] = null; }
    return memory[lang];
  }
  let installedCache = null;
  async function installed() {
    if (installedCache) return installedCache;
    const out = {};
    for (const lang of ['es', 'en']) {
      try {
        const meta = await idb('readonly', st => st.get(`${lang}:meta`));
        if (meta) out[lang] = meta;
      } catch (e) { /* sin datos */ }
    }
    installedCache = out;
    return out;
  }

  // ------------------------------------------------------------------
  // Lector de EPUB (ZIP) sin librerías externas
  // ------------------------------------------------------------------
  async function openZip(file) {
    const buf = new Uint8Array(await file.arrayBuffer());
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    let eocd = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('El archivo no es un EPUB válido.');
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const dec = new TextDecoder();
    const entries = new Map();
    for (let k = 0; k < count; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true);
      const csize = dv.getUint32(p + 20, true);
      const nLen = dv.getUint16(p + 28, true);
      const xLen = dv.getUint16(p + 30, true);
      const cLen = dv.getUint16(p + 32, true);
      const lho = dv.getUint32(p + 42, true);
      entries.set(dec.decode(buf.subarray(p + 46, p + 46 + nLen)), { method, csize, lho });
      p += 46 + nLen + xLen + cLen;
    }
    async function read(name) {
      const e = entries.get(name);
      if (!e) return null;
      const n = dv.getUint16(e.lho + 26, true);
      const x = dv.getUint16(e.lho + 28, true);
      const start = e.lho + 30 + n + x;
      const data = buf.subarray(start, start + e.csize);
      if (e.method === 0) return dec.decode(data);
      if (typeof DecompressionStream === 'undefined') throw new Error('Tu navegador es demasiado antiguo para importar la Biblia. Actualízalo e inténtalo de nuevo.');
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return dec.decode(await new Response(stream).arrayBuffer());
    }
    return { entries, read };
  }

  const decodeEntities = (() => {
    const el = typeof document !== 'undefined' ? document.createElement('textarea') : null;
    return (s) => {
      if (!/&/.test(s)) return s;
      if (el) { el.innerHTML = s; return el.value; }
      return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
    };
  })();

  function cleanVerse(chunk) {
    return decodeEntities(chunk
      .replace(/<a[^>]*epub:type="noteref"[^>]*>[\s\S]*?<\/a>/g, '')
      .replace(/<span class="w_ch">[\s\S]*?<\/span>/g, '')
      .replace(/<strong><sup>\d+<\/sup><\/strong>/g, '')
      .replace(/<sup>\d+<\/sup>/g, '')
      .replace(/<[^>]+>/g, ' '))
      .replace(/[·ʹ]/g, '') // marcas de pronunciación de los nombres propios
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;:!?”’»)])/g, '$1')
      .trim();
  }

  async function parseEpub(file, onProgress) {
    const zip = await openZip(file);
    const containerXml = await zip.read('META-INF/container.xml');
    const opfPath = ((containerXml || '').match(/full-path="([^"]+)"/) || [])[1] || 'OEBPS/content.opf';
    const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
    const opf = await zip.read(opfPath);
    if (!opf) throw new Error('No se encontró el índice del EPUB.');
    const manifest = {};
    for (const m of opf.matchAll(/<item\b([^>]*)\/?>/g)) {
      const id = (m[1].match(/\bid="([^"]+)"/) || [])[1];
      const href = (m[1].match(/\bhref="([^"]+)"/) || [])[1];
      if (id && href) manifest[id] = href;
    }
    const spine = Array.from(opf.matchAll(/<itemref[^>]*idref="([^"]+)"/g)).map(m => manifest[m[1]]).filter(Boolean);
    const title = decodeEntities(((opf.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/) || [])[1] || 'Biblia').trim());

    const verseRe = /<span id="chapter(\d+)_verse(\d+)"><\/span>/;
    const books = [];
    const byName = new Map();
    let lang = null;
    let verses = 0;
    for (let i = 0; i < spine.length; i++) {
      const s = await zip.read(base + decodeURIComponent(spine[i]));
      if (onProgress && i % 40 === 0) onProgress(i / spine.length);
      if (!s || !verseRe.test(s)) continue;
      const nameMatch = s.match(/class="w_navigation w_biblebookname"><a[^>]*>([^<]+)<\/a>/);
      if (!nameMatch) continue;
      if (!lang) {
        const l = (s.match(/xml:lang="([a-z]{2})/) || [])[1];
        lang = l === 'en' ? 'en' : 'es';
      }
      const name = decodeEntities(nameMatch[1]).trim();
      let book = byName.get(name);
      if (!book) { book = { name, chapters: [] }; byName.set(name, book); books.push(book); }
      const body = s.split('<aside')[0];
      const parts = body.split(/<span id="chapter(\d+)_verse(\d+)"><\/span>/);
      for (let j = 1; j < parts.length; j += 3) {
        const c = parseInt(parts[j], 10);
        const v = parseInt(parts[j + 1], 10);
        const t = cleanVerse(parts[j + 2]);
        const ch = book.chapters[c] || (book.chapters[c] = []);
        ch[v] = ch[v] ? `${ch[v]} ${t}`.trim() : t;
        verses++;
      }
    }
    if (onProgress) onProgress(1);
    if (books.length !== 66) throw new Error(`Este EPUB no parece la Biblia completa (se encontraron ${books.length} libros).`);
    return { lang, title, books, verses };
  }

  async function importEpub(file, onProgress) {
    const bible = await parseEpub(file, onProgress);
    const meta = { lang: bible.lang, title: bible.title, verses: bible.verses, importedAt: new Date().toISOString(), file: file.name };
    await idb('readwrite', st => { st.put({ lang: bible.lang, title: bible.title, books: bible.books }, bible.lang); st.put(meta, `${bible.lang}:meta`); });
    memory[bible.lang] = { lang: bible.lang, title: bible.title, books: bible.books };
    installedCache = null;
    return meta;
  }

  async function remove(lang) {
    await idb('readwrite', st => { st.delete(lang); st.delete(`${lang}:meta`); });
    memory[lang] = null;
    installedCache = null;
  }

  // ------------------------------------------------------------------
  // Búsqueda
  // ------------------------------------------------------------------
  function formatRanges(verses) {
    return verses.map(([a, b]) => (a === b ? `${a}` : (b - a === 1 ? `${a}, ${b}` : `${a}-${b}`))).join(', ');
  }

  async function lookup(ref, hintLang) {
    const inst = await installed();
    const available = Object.keys(inst);
    if (!available.length) return { success: false, notInstalled: true, error: 'No hay ninguna Biblia importada en este dispositivo.' };

    const passages = parseReferences(ref, hintLang);
    if (!passages.length) return { success: false, error: `No se reconoció ninguna cita bíblica en "${ref}".` };

    // Idioma: el de la cita (o la pista); si no está instalado, el otro
    let lang = passages[0].explicitLang ? passages[0].lang : (hintLang || passages[0].lang);
    if (!inst[lang]) lang = available[0];
    const bible = await getBible(lang);
    if (!bible) return { success: false, notInstalled: true, error: 'No se pudo leer la Biblia guardada.' };

    const textParts = [];
    const citeParts = [];
    let lastBook = null;
    let lastChapter = null;
    let totalVerses = 0;
    for (const p of passages) {
      const book = bible.books[p.book - 1];
      if (!book) continue;
      const chapter = book.chapters[p.chapter];
      if (!chapter) continue;
      const ranges = p.verses || [[1, chapter.length - 1]];
      const lines = [];
      for (const [a, b] of ranges) {
        for (let v = a; v <= Math.min(b, chapter.length - 1); v++) {
          const t = chapter[v];
          if (t && /[\p{L}\d]/u.test(t)) { lines.push({ v, t }); totalVerses++; } // omite versículos vacíos o "——"
        }
      }
      if (!lines.length) continue;
      const verseLabel = p.verses ? formatRanges(p.verses) : '';
      let cite;
      if (lastBook === p.book) cite = p.verses ? (ONE_CHAPTER.has(p.book) ? verseLabel : `${p.chapter}:${verseLabel}`) : `${p.chapter}`;
      else {
        // "Salmo 83:18" (un solo salmo) frente a "Salmos 83:18; 91:1"
        const oneChapter = new Set(passages.filter(x => x.book === p.book).map(x => x.chapter)).size === 1;
        const name = p.book === 19 && oneChapter ? (lang === 'en' ? 'Psalm' : 'Salmo') : book.name;
        cite = ONE_CHAPTER.has(p.book) ? `${name} ${verseLabel}` : `${name} ${p.chapter}${p.verses ? `:${verseLabel}` : ''}`;
      }
      citeParts.push({ cite, sameBook: lastBook === p.book });
      lastBook = p.book;
      lastChapter = p.chapter;
      textParts.push(lines);
    }
    void lastChapter;
    if (!totalVerses) return { success: false, error: `No se encontró "${ref}" en la Biblia guardada.` };

    const multi = totalVerses > 1;
    const text = textParts.map(lines => lines.map(l => (multi ? `${l.v} ${l.t}` : l.t)).join(' ')).join(' … ');
    const citation = citeParts.map((c, i) => (i === 0 ? c.cite : (c.sameBook ? `; ${c.cite}` : `; ${c.cite}`))).join('');
    return {
      success: true,
      text,
      citation,
      lang,
      translation: lang === 'en' ? 'New World Translation' : 'Traducción del Nuevo Mundo',
      source: 'biblia-local',
      passages: textParts
    };
  }

  const api = { lookup, importEpub, parseEpub, installed, remove, parseReferences };
  if (typeof window !== 'undefined') window.EPBible = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
