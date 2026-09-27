const fs = require('fs');
const path = require('path');
const { extractTextFromFile, cleanText } = require('./docParser');

// ---------------------------------------------------------------------------
// Rutas de datos
// DATA_DIR permite guardar la base de datos fuera del código (p. ej. en el
// volumen del NAS Synology: /volume1/docker/estudio-personal/data).
// ---------------------------------------------------------------------------
const BUNDLED_DATA_DIR = path.join(__dirname, '..', 'data');
const BUNDLED_APUNTES_DIR = path.join(__dirname, '..', 'apuntes');
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : BUNDLED_DATA_DIR;
const DB_PATH = path.join(DATA_DIR, 'database.json');
const APUNTES_DIR = process.env.APUNTES_DIR
  ? path.resolve(process.env.APUNTES_DIR)
  : (process.env.DATA_DIR ? path.join(DATA_DIR, 'apuntes') : BUNDLED_APUNTES_DIR);

// Primer arranque en el NAS: copiar la base de datos y los apuntes incluidos
// en el repositorio al volumen de datos (solo si todavía no existen allí).
(function migrateBundledData() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const bundledDb = path.join(BUNDLED_DATA_DIR, 'database.json');
    if (DATA_DIR !== BUNDLED_DATA_DIR && !fs.existsSync(DB_PATH) && fs.existsSync(bundledDb)) {
      fs.copyFileSync(bundledDb, DB_PATH);
      console.log('[DB] Base de datos inicial copiada a', DB_PATH);
    }
    if (APUNTES_DIR !== BUNDLED_APUNTES_DIR && fs.existsSync(BUNDLED_APUNTES_DIR)) {
      if (!fs.existsSync(APUNTES_DIR)) fs.mkdirSync(APUNTES_DIR, { recursive: true });
      if (fs.readdirSync(APUNTES_DIR).length === 0) {
        for (const f of fs.readdirSync(BUNDLED_APUNTES_DIR)) {
          const src = path.join(BUNDLED_APUNTES_DIR, f);
          if (fs.statSync(src).isFile()) fs.copyFileSync(src, path.join(APUNTES_DIR, f));
        }
      }
    }
  } catch (err) {
    console.error('[DB] Error preparando la carpeta de datos:', err.message);
  }
})();

const SPANISH_MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function parseDateComponents(dateStr) {
  if (!dateStr || typeof dateStr !== 'string' || !dateStr.includes('-')) return null;
  const parts = dateStr.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  return {
    year: isNaN(y) ? 2026 : y,
    month: (m >= 1 && m <= 12) ? SPANISH_MONTHS[m - 1] : '',
    day: isNaN(d) ? null : d
  };
}

const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

function getDefaultCategories() {
  return [
    { id: 'daily_text', name: 'Daily Text Comments', icon: '🌅', isSystem: true, subCategories: [] },
    {
      id: 'events',
      name: 'Events',
      icon: '🏛️',
      isSystem: true,
      subCategories: [
        { id: 'bethel_talks', name: 'Bethel Talks', icon: '🎤', isSystem: true },
        { id: 'annual_meeting', name: 'Annual Meeting', icon: '🌐', isSystem: true },
        { id: 'gilead_meeting', name: 'Gilead Meeting', icon: '🎓', isSystem: true },
        { id: 'others', name: 'Others', icon: '📂', isSystem: true }
      ]
    },
    { id: 'spiritual_notes', name: 'Spiritual Notes', icon: '💡', isSystem: true, subCategories: [] }
  ];
}

function getInitialDb() {
  return {
    config: {
      geminiApiKey: process.env.GEMINI_API_KEY || '',
      targetScore: 100,
      pointsPerQuestion: 5,
      availableYears: [2025, 2026, 2027, 2028]
    },
    categories: getDefaultCategories(),
    notes: [],
    topics: [],
    questions: [],
    history: []
  };
}

// ---------------------------------------------------------------------------
// Carga / guardado con caché en memoria, escritura atómica y registro de
// cambios para la sincronización sin conexión (cada nota lleva un número de
// secuencia `_seq`; las notas borradas dejan una "lápida" en db.deleted).
// ---------------------------------------------------------------------------
let dbCache = null;
let dbCacheMtime = 0;
let lastSavedNoteJson = new Map(); // id -> JSON de la nota (sin _seq) tal como se guardó

function normalizeDb(parsed) {
  if (!parsed.config) parsed.config = getInitialDb().config;
  if (!Array.isArray(parsed.config.availableYears)) {
    parsed.config.availableYears = [2025, 2026, 2027, 2028];
  }
  if (!Array.isArray(parsed.categories) || parsed.categories.length === 0) {
    parsed.categories = getDefaultCategories();
  }
  if (!Array.isArray(parsed.notes)) parsed.notes = [];
  if (!Array.isArray(parsed.topics)) parsed.topics = [];
  if (!Array.isArray(parsed.questions)) parsed.questions = [];
  if (!Array.isArray(parsed.history)) parsed.history = [];
  if (!Array.isArray(parsed.deleted)) parsed.deleted = [];
  if (!parsed.meta || typeof parsed.meta !== 'object') parsed.meta = {};
  if (typeof parsed.meta.seq !== 'number') parsed.meta.seq = 0;
  // Asignar secuencia a notas antiguas que aún no la tienen
  for (const n of parsed.notes) {
    if (typeof n._seq !== 'number') n._seq = ++parsed.meta.seq;
  }
  return parsed;
}

function noteFingerprint(n) {
  const { _seq, questionsCount, questions, ...rest } = n;
  return JSON.stringify(rest);
}

function rememberSavedNotes(db) {
  lastSavedNoteJson = new Map(db.notes.map(n => [n.id, noteFingerprint(n)]));
}

function readLatestBackup() {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) return null;
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => ({ f, t: fs.statSync(path.join(BACKUPS_DIR, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    for (const { f } of files) {
      try {
        return JSON.parse(fs.readFileSync(path.join(BACKUPS_DIR, f), 'utf8').replace(/^﻿/, ''));
      } catch (e) { /* probar la siguiente */ }
    }
  } catch (e) { /* sin copias */ }
  return null;
}

function loadDb() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const mtime = fs.statSync(DB_PATH).mtimeMs;
      if (dbCache && mtime === dbCacheMtime) return dbCache;
      const data = fs.readFileSync(DB_PATH, 'utf8').replace(/^﻿/, '');
      const parsed = normalizeDb(JSON.parse(data));
      dbCache = parsed;
      dbCacheMtime = mtime;
      rememberSavedNotes(parsed);
      return parsed;
    }
  } catch (err) {
    // Nunca sobrescribir una base de datos dañada: apartarla y recuperar la última copia.
    console.error('[DB] Error leyendo database.json:', err.message);
    try {
      const corrupt = DB_PATH + '.corrupt-' + Date.now();
      fs.copyFileSync(DB_PATH, corrupt);
      console.error('[DB] Copia del archivo dañado guardada en', corrupt);
    } catch (e) { /* ignorar */ }
    const recovered = readLatestBackup();
    if (recovered) {
      console.warn('[DB] Restaurada la última copia de seguridad.');
      const db = normalizeDb(recovered);
      saveDb(db);
      return db;
    }
  }
  const init = normalizeDb(getInitialDb());
  saveDb(init);
  return init;
}

function writeFileAtomic(filePath, contents) {
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, contents, 'utf8');
  fs.renameSync(tmp, filePath);
}

function pruneBackups(prefix, keep) {
  const files = fs.readdirSync(BACKUPS_DIR)
    .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
    .sort()
    .reverse();
  files.slice(keep).forEach(f => {
    try { fs.unlinkSync(path.join(BACKUPS_DIR, f)); } catch (e) { /* ignorar */ }
  });
}

function createLocalBackup(json) {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const hourStr = String(now.getHours()).padStart(2, '0');
    // Copia horaria (últimas 48) + copia diaria (últimos 90 días)
    const hourly = path.join(BACKUPS_DIR, `backup_${dateStr}_${hourStr}h.json`);
    const daily = path.join(BACKUPS_DIR, `daily_${dateStr}.json`);
    if (!fs.existsSync(hourly)) {
      fs.writeFileSync(hourly, json, 'utf8');
      pruneBackups('backup_', 48);
    }
    if (!fs.existsSync(daily)) {
      fs.writeFileSync(daily, json, 'utf8');
      pruneBackups('daily_', 90);
    }
  } catch (err) {
    console.error('[DB Backup] Error creando copia de seguridad local:', err.message);
  }
}

function trackNoteChanges(db) {
  if (!Array.isArray(db.deleted)) db.deleted = [];
  if (!db.meta) db.meta = { seq: 0 };
  if (typeof db.meta.seq !== 'number') db.meta.seq = 0;
  const currentIds = new Set();
  for (const n of db.notes) {
    currentIds.add(n.id);
    const fp = noteFingerprint(n);
    if (lastSavedNoteJson.get(n.id) !== fp || typeof n._seq !== 'number') {
      n._seq = ++db.meta.seq;
    }
  }
  const nowIso = new Date().toISOString();
  for (const id of lastSavedNoteJson.keys()) {
    if (!currentIds.has(id)) {
      db.deleted = db.deleted.filter(d => d.id !== id);
      db.deleted.push({ id, _seq: ++db.meta.seq, deletedAt: nowIso });
    }
  }
  // Si una nota se recrea, quitar su lápida
  db.deleted = db.deleted.filter(d => !currentIds.has(d.id));
  // Mantener las lápidas de los últimos 180 días
  const cutoff = Date.now() - 180 * 24 * 3600 * 1000;
  db.deleted = db.deleted.filter(d => new Date(d.deletedAt).getTime() > cutoff);
}

function saveDb(db) {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    normalizeDb(db);
    trackNoteChanges(db);
    const json = JSON.stringify(db, null, 2);
    writeFileAtomic(DB_PATH, json);
    dbCache = db;
    dbCacheMtime = fs.statSync(DB_PATH).mtimeMs;
    rememberSavedNotes(db);
    createLocalBackup(json);
  } catch (err) {
    console.error('[DB] Error guardando database.json:', err.message);
    throw err;
  }
}

function getAllTopics() {
  const db = loadDb();
  return db.topics.map(t => {
    const questionsCount = db.questions.filter(q => q.topicId === t.id).length;
    return {
      ...t,
      questionsCount
    };
  });
}

function getTopicById(topicId) {
  const db = loadDb();
  return db.topics.find(t => t.id === topicId);
}

function shuffleQuestionOptions(q) {
  const letters = ['A', 'B', 'C', 'D'];
  const correctText = q.options[q.correctAnswer] || q.options.A;
  const texts = [q.options.A, q.options.B, q.options.C, q.options.D];

  for (let i = texts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [texts[i], texts[j]] = [texts[j], texts[i]];
  }

  const newOptions = {
    A: texts[0],
    B: texts[1],
    C: texts[2],
    D: texts[3]
  };

  const newCorrectIndex = texts.indexOf(correctText);
  const newCorrectLetter = newCorrectIndex >= 0 ? letters[newCorrectIndex] : 'A';

  return {
    ...q,
    options: newOptions,
    correctAnswer: newCorrectLetter
  };
}

function getQuestionsByTopicIds(topicIds = [], limit = 30) {
  const db = loadDb();
  let candidateQuestions = db.questions;
  
  if (topicIds && topicIds.length > 0) {
    candidateQuestions = candidateQuestions.filter(q => topicIds.includes(q.topicId));
  }
  
  // Barajar aleatoriamente las preguntas (Fisher-Yates)
  const shuffled = [...candidateQuestions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  // Barajar también las opciones de cada pregunta para que la respuesta correcta nunca esté en una posición fija
  return shuffled.slice(0, limit).map(q => shuffleQuestionOptions(q));
}

function addQuestionsToTopic(topicId, newQuestions = []) {
  const db = loadDb();
  const topic = db.topics.find(t => t.id === topicId);
  if (!topic) throw new Error('Tema no encontrado');
  
  const saved = [];
  for (const q of newQuestions) {
    // Validar estructura de pregunta
    if (!q.question || !q.options || !q.correctAnswer) continue;
    
    // Evitar duplicados exactos en el mismo tema
    const existing = db.questions.find(
      x => x.topicId === topicId && x.question.trim().toLowerCase() === q.question.trim().toLowerCase()
    );
    if (existing) continue;
    
    const questionObj = {
      id: 'q_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      topicId: topic.id,
      topicTitle: topic.title,
      question: q.question.trim(),
      options: {
        A: (q.options.A || '').trim(),
        B: (q.options.B || '').trim(),
        C: (q.options.C || '').trim(),
        D: (q.options.D || '').trim()
      },
      correctAnswer: q.correctAnswer.toUpperCase().trim(),
      explanation: (q.explanation || 'Respuesta basada en los apuntes del tema.').trim(),
      difficulty: q.difficulty || 'normal',
      stats: {
        timesAsked: 0,
        timesCorrect: 0
      },
      createdAt: new Date().toISOString()
    };
    
    const randomizedObj = shuffleQuestionOptions(questionObj);
    
    db.questions.push(randomizedObj);
    saved.push(randomizedObj);
  }
  
  topic.updatedAt = new Date().toISOString();
  saveDb(db);
  return saved;
}

function updateQuestionStat(questionId, isCorrect) {
  const db = loadDb();
  const q = db.questions.find(item => item.id === questionId);
  if (q) {
    if (!q.stats) q.stats = { timesAsked: 0, timesCorrect: 0 };
    q.stats.timesAsked += 1;
    if (isCorrect) q.stats.timesCorrect += 1;
    saveDb(db);
  }
}

function recordGame(gameSummary) {
  const db = loadDb();
  db.history.unshift({
    id: 'game_' + Date.now(),
    date: new Date().toISOString(),
    score: gameSummary.score || 0,
    targetScore: gameSummary.targetScore || 100,
    won: gameSummary.won || false,
    selectedTopics: gameSummary.selectedTopics || [],
    totalQuestions: gameSummary.totalQuestions || 0,
    correctAnswers: gameSummary.correctAnswers || 0
  });
  // Mantener últimos 50 juegos
  if (db.history.length > 50) db.history = db.history.slice(0, 50);
  saveDb(db);
}

function getConfig() {
  const db = loadDb();
  return db.config;
}

function updateConfig(newConfig) {
  const db = loadDb();
  db.config = {
    ...db.config,
    ...newConfig
  };
  saveDb(db);
  return db.config;
}

async function syncApuntesFolder() {
  if (!fs.existsSync(APUNTES_DIR)) {
    fs.mkdirSync(APUNTES_DIR, { recursive: true });
    return [];
  }
  
  const files = fs.readdirSync(APUNTES_DIR);
  const supportedExtensions = ['.txt', '.md', '.docx', '.pdf'];
  const db = loadDb();
  const discoveredTopics = [];
  
  for (const file of files) {
    if (file.startsWith('~$') || file.startsWith('.')) continue;
    const ext = path.extname(file).toLowerCase();
    if (!supportedExtensions.includes(ext)) continue;
    
    const filePath = path.join(APUNTES_DIR, file);
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) continue;
    
    // Si es un archivo .txt acompañante de un .pdf con el mismo nombre base, omitirlo
    if (ext === '.txt') {
      const companionPdf = file.replace(/\.txt$/i, '.pdf');
      if (files.includes(companionPdf)) {
        continue;
      }
    }

    // El título se toma del nombre del archivo sin extensión
    const title = path.basename(file, ext).replace(/[_-]+/g, ' ').trim();
    
    const fileKnownMap = {
      'books of the bible.docx': 'note_apuntes_books_bible',
      'jacob.txt': 'note_apuntes_jacob',
      'kings of juda and israel.txt': 'note_apuntes_kings_1',
      'kings of juda and israel 1.txt': 'note_apuntes_kings_2',
      'kings of juda and israel.pdf': 'note_apuntes_kings_1',
      'kings of juda and israel 1.pdf': 'note_apuntes_kings_2'
    };
    const knownNoteId = fileKnownMap[file.toLowerCase()];

    const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const tNorm = norm(title);
    const fNorm = norm(file);

    let topic = db.topics.find(t => {
      if (knownNoteId && (t.id === knownNoteId || t.noteId === knownNoteId)) return true;
      const ntNorm = norm(t.title);
      const nfNorm = norm(t.fileName);
      const nidNorm = norm(t.id || t.noteId);
      return (
        (nfNorm && (nfNorm === fNorm || nfNorm.includes(fNorm) || fNorm.includes(nfNorm))) ||
        ntNorm === tNorm ||
        ntNorm.includes(tNorm) ||
        tNorm.includes(ntNorm) ||
        nidNorm.includes(tNorm) ||
        nidNorm.includes(fNorm)
      );
    });

    if (!topic) {
      // Extraer muestra de texto para el resumen
      let sampleText = '';
      try {
        const fullText = await extractTextFromFile(filePath);
        sampleText = cleanText(fullText).slice(0, 500);
      } catch (err) {
        console.warn(`[Sync] No se pudo leer muestra de ${file}:`, err.message);
      }
      
      topic = {
        id: 'topic_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        title,
        fileName: file,
        fileExt: ext,
        fileSize: stat.size,
        rawTextSnippet: sampleText,
        createdAt: stat.birthtime.toISOString(),
        updatedAt: stat.mtime.toISOString()
      };
      db.topics.push(topic);
      discoveredTopics.push(topic);
    }

    // Sincronizar también en db.notes para que aparezca en el cuaderno
    const existingNote = db.notes.find(n => {
      if (knownNoteId && n.id === knownNoteId) return true;
      const ntNorm = norm(n.title);
      const nidNorm = norm(n.id);
      return (
        n.id === topic.id ||
        ntNorm === tNorm ||
        ntNorm.includes(tNorm) ||
        tNorm.includes(ntNorm) ||
        nidNorm.includes(tNorm) ||
        nidNorm.includes(fNorm)
      );
    });
    if (!existingNote) {
      let fullContent = '';
      try {
        const rawExtracted = await extractTextFromFile(filePath);
        fullContent = `# ${title}\n\n` + cleanText(rawExtracted);
      } catch (e) {
        fullContent = topic.rawTextSnippet ? `# ${title}\n\n` + topic.rawTextSnippet : `# ${title}\n\n(Archivo importado: ${file})`;
      }

      const noteFromTopic = {
        id: topic.id,
        category: 'spiritual_notes',
        subCategory: '',
        year: 2026,
        month: '',
        day: null,
        title,
        date: stat.mtime.toISOString().split('T')[0],
        icon: '📜',
        content: fullContent,
        tags: [ext.replace('.', ''), 'apuntes', 'estudio personal'],
        createdAt: stat.birthtime.toISOString(),
        updatedAt: stat.mtime.toISOString()
      };
      db.notes.push(noteFromTopic);
    }
  }
  
  saveDb(db);
  return discoveredTopics;
}

function seedInitialNotesIfEmpty(db) {
  // Solo en una base de datos totalmente nueva (nunca después de borrar notas)
  if (db.notes && db.notes.length > 0) return;
  if ((db.meta && db.meta.seq > 0) || (db.deleted && db.deleted.length > 0)) return;

  const now = new Date().toISOString();
  const sampleNotes = [
    {
      id: 'note_daily_2026_09_17',
      category: 'daily_text',
      year: 2026,
      month: 'Septiembre',
      day: 17,
      subCategory: '',
      title: 'Texto Diario: El valor incalculable de la fe sincera',
      date: '2026-09-17',
      icon: '🌅',
      content: `# Texto Diario — 17 de Septiembre de 2026\n\n> "La fe es la certeza de lo que se espera, la demostración de realidades que no se ven." — Hebreos 11:1\n\n### Puntos Clave del Comentario Matutino:\n- La fe verdadera no es una simple emoción pasajera, sino una convicción basada en pruebas sólidas.\n- Los patriarcas como Abrahán y Jacob confiaron plenamente en las promesas de Dios a pesar de no ver su cumplimiento inmediato.\n- En momentos de incertidumbre, orar y meditar en la fidelidad demostrada por Jehová fortalece nuestro corazón.\n\n💡 **Aplicación personal:** Dedicar hoy 10 minutos a repasar cómo Jehová ha respondido mis oraciones recientes.`,
      tags: ['fe', 'oración', 'hebreos'],
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'note_event_bethel_01',
      category: 'events',
      subCategory: 'bethel_talks',
      year: 2026,
      month: '',
      day: null,
      title: 'Bethel Talk: Cómo mantener la devoción en un mundo cambiante',
      date: '2026-09-10',
      icon: '🎤',
      content: `# Discurso Matutino de Betel\n\n**Discursante:** Miembro del Comité de Sucursal\n**Tema principal:** Fidelidad en las pequeñas responsabilidades cotidianas (Lucas 16:10).\n\n### Ideas destacadas:\n1. La rutina espiritual diaria (lectura bíblica, consideración del texto diario y oración constante) es el ancla que protege nuestra espiritualidad.\n2. La humildad frente a las correcciones o cambios de circunstancias nos acerca más a nuestros hermanos.\n3. Mantener el ojo sencillo y enfocarse en el ministerio y en las promesas del Reino.`,
      tags: ['bethel', 'fidelidad', 'humildad'],
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'note_spiritual_01',
      category: 'spiritual_notes',
      subCategory: '',
      year: 2026,
      month: '',
      day: null,
      title: 'Perlas Espirituales: La paciencia de Jacob en Harán',
      date: '2026-09-05',
      icon: '💡',
      content: `# Estudio Personal: La perseverancia de Jacob\n\n- **Lectura:** Génesis 29 al 31.\n- A pesar de los engaños continuos de su tío Labán, quien le cambió el salario diez veces, Jacob nunca tomó represalias con maldad.\n- Puso su confianza en que Dios haría justicia a su debido tiempo.\n- **Lección práctica:** Cuando alguien en el trabajo o en la vida diaria nos trate injustamente, imitar la paciencia de Jacob y dejar los asuntos en manos de Dios.`,
      tags: ['jacob', 'paciencia', 'estudio personal'],
      createdAt: now,
      updatedAt: now
    }
  ];

  db.notes = sampleNotes;

  // Sincronizar estas notas en topics
  sampleNotes.forEach(note => {
    const topicObj = {
      id: note.id,
      title: note.title,
      isNote: true,
      noteId: note.id,
      category: note.category,
      subCategory: note.subCategory || '',
      date: note.date,
      icon: note.icon || '📝',
      rawTextSnippet: (note.content || '').slice(0, 500),
      createdAt: note.createdAt,
      updatedAt: note.updatedAt
    };
    const idx = db.topics.findIndex(t => t.id === note.id);
    if (idx >= 0) db.topics[idx] = topicObj;
    else db.topics.push(topicObj);
  });

  saveDb(db);
}

function getAllNotes(filter = {}) {
  const db = loadDb();
  seedInitialNotesIfEmpty(db);

  let notes = db.notes || [];

  if (filter.category) {
    notes = notes.filter(n => n.category === filter.category);
  }
  if (filter.subCategory) {
    notes = notes.filter(n => n.subCategory === filter.subCategory);
  }
  if (filter.year) {
    notes = notes.filter(n => Number(n.year) === Number(filter.year));
  }
  if (filter.month) {
    notes = notes.filter(n => String(n.month).toLowerCase() === String(filter.month).toLowerCase());
  }
  if (filter.search) {
    const q = filter.search.toLowerCase().trim();
    notes = notes.filter(n => 
      (n.title && n.title.toLowerCase().includes(q)) ||
      (n.content && n.content.toLowerCase().includes(q)) ||
      (n.tags && n.tags.some(tag => tag.toLowerCase().includes(q))) ||
      (n.date && n.date.includes(q))
    );
  }

  // Añadir contador de preguntas disponibles para cada nota
  return notes.map(n => {
    const questionsCount = (db.questions || []).filter(q => q.topicId === n.id).length;
    return {
      ...n,
      questionsCount
    };
  }).sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
}

function getNoteById(id) {
  const db = loadDb();
  const note = (db.notes || []).find(n => n.id === id);
  if (!note) return null;
  const questions = (db.questions || []).filter(q => q.topicId === id);
  return {
    ...note,
    questions,
    questionsCount: questions.length
  };
}

function createNote(data) {
  const db = loadDb();
  if (!Array.isArray(db.notes)) db.notes = [];

  const now = new Date().toISOString();
  // Los dispositivos sin conexión generan su propio id para que la nota
  // conserve la misma identidad al subirse al NAS.
  const clientId = typeof data.id === 'string' && /^[\w-]{6,120}$/.test(data.id) ? data.id : null;
  const id = (clientId && !db.notes.some(n => n.id === clientId))
    ? clientId
    : 'note_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

  const dateStr = data.date || new Date().toISOString().split('T')[0];
  const dateParsed = parseDateComponents(dateStr);

  const year = data.year ? Number(data.year) : (dateParsed ? dateParsed.year : 2026);
  const month = data.month || (dateParsed ? dateParsed.month : '');
  const day = data.day ? Number(data.day) : (dateParsed ? dateParsed.day : null);

  if (year && Array.isArray(db.config.availableYears) && !db.config.availableYears.includes(year)) {
    db.config.availableYears.push(year);
    db.config.availableYears.sort((a, b) => a - b);
  }

  const newNote = {
    id,
    category: data.category || 'spiritual_notes', // 'daily_text', 'events', 'spiritual_notes'
    subCategory: data.subCategory || '',
    year: (data.category === 'daily_text' || year) ? year : null,
    month,
    day,
    title: (data.title || 'Nueva Nota').trim(),
    date: dateStr,
    icon: data.icon || (data.category === 'daily_text' ? '🌅' : data.category === 'events' ? '🏛️' : '💡'),
    content: data.content || '',
    tags: Array.isArray(data.tags) ? data.tags : [],
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now
  };

  db.notes.unshift(newNote);

  // Sincronizar en topics para poder jugarla
  const topicObj = {
    id: newNote.id,
    title: newNote.title,
    isNote: true,
    noteId: newNote.id,
    category: newNote.category,
    subCategory: newNote.subCategory || '',
    date: newNote.date,
    icon: newNote.icon,
    rawTextSnippet: newNote.content.slice(0, 500),
    createdAt: now,
    updatedAt: now
  };
  db.topics.unshift(topicObj);

  saveDb(db);
  return newNote;
}

function updateNote(id, data) {
  const db = loadDb();
  const index = (db.notes || []).findIndex(n => n.id === id);
  if (index === -1) return null;

  const current = db.notes[index];
  const now = new Date().toISOString();

  const dateStr = data.date || current.date || new Date().toISOString().split('T')[0];
  const dateParsed = parseDateComponents(dateStr);

  const year = data.year !== undefined ? Number(data.year) : (dateParsed ? dateParsed.year : current.year);
  const month = data.month !== undefined ? data.month : (dateParsed ? dateParsed.month : current.month);
  const day = data.day !== undefined ? Number(data.day) : (dateParsed ? dateParsed.day : current.day);

  if (year && Array.isArray(db.config.availableYears) && !db.config.availableYears.includes(year)) {
    db.config.availableYears.push(year);
    db.config.availableYears.sort((a, b) => a - b);
  }

  const category = data.category !== undefined ? data.category : current.category;
  const subCategory = category === 'daily_text'
    ? ''
    : (data.subCategory !== undefined ? data.subCategory : (current.subCategory || ''));

  let content = current.content;
  if (data.content !== undefined) {
    if (typeof data.content === 'string' && data.content.trim().length === 0 && current.content && current.content.trim().length > 40) {
      console.warn(`[DB] Intento de sobreescribir contenido existente de '${current.title}' con texto vacío bloqueado por seguridad.`);
    } else {
      content = data.content;
    }
  }

  const updatedNote = {
    ...current,
    ...data,
    category,
    subCategory,
    content,
    date: dateStr,
    year,
    month,
    day,
    id: current.id, // proteger ID
    createdAt: current.createdAt,
    updatedAt: now
  };

  db.notes[index] = updatedNote;

  // Actualizar también en topics
  const topicIndex = (db.topics || []).findIndex(t => t.id === id || t.noteId === id);
  if (topicIndex >= 0) {
    db.topics[topicIndex] = {
      ...db.topics[topicIndex],
      title: updatedNote.title,
      category: updatedNote.category,
      subCategory: updatedNote.subCategory || '',
      date: updatedNote.date,
      icon: updatedNote.icon,
      rawTextSnippet: (updatedNote.content || '').slice(0, 500),
      updatedAt: now
    };
  }

  saveDb(db);
  return updatedNote;
}

function getMonthDocument(year, month) {
  const numYear = parseInt(year, 10) || 2026;
  const mName = (month || 'Septiembre').trim();
  const docId = `daily_text_${numYear}_${mName}`;

  const db = loadDb();
  if (!Array.isArray(db.notes)) db.notes = [];

  // Buscar si ya existe el documento mensual
  let monthDoc = db.notes.find(n => 
    n.id === docId || 
    (n.category === 'daily_text' && Number(n.year) === numYear && n.month === mName && n.isMonthDoc)
  );

  if (monthDoc) {
    return monthDoc;
  }

  // Comprobar si existen notas diarias sueltas previas para consolidar
  const legacyNotes = db.notes.filter(n => 
    n.category === 'daily_text' && 
    Number(n.year) === numYear && 
    n.month === mName && 
    !n.isMonthDoc
  );

  const mIdx = SPANISH_MONTHS.indexOf(mName);
  const mNum = mIdx >= 0 ? mIdx + 1 : 9;
  const dateStr = `${numYear}-${String(mNum).padStart(2, '0')}-01`;

  if (legacyNotes.length > 0) {
    // Ordenar cronológicamente por día ascendente
    legacyNotes.sort((a, b) => (Number(a.day) || 1) - (Number(b.day) || 1));

    let content = `# 🌅 Daily Text Comments — ${mName} ${numYear}\n\n`;
    legacyNotes.forEach(ln => {
      const dNum = ln.day || (parseDateComponents(ln.date) ? parseDateComponents(ln.date).day : 1);
      const dTitle = ln.title || `Entrada del día ${dNum}`;
      content += `---\n## 📅 DÍA ${dNum} • ${dTitle}\n\n${(ln.content || '').trim()}\n\n`;
    });

    monthDoc = {
      id: docId,
      category: 'daily_text',
      subCategory: '',
      isMonthDoc: true,
      year: numYear,
      month: mName,
      day: null,
      title: `Daily Text — ${mName} ${numYear}`,
      date: dateStr,
      icon: '🌅',
      content: content.trim() + '\n',
      tags: ['daily_text', String(numYear), mName],
      createdAt: legacyNotes[0].createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Reemplazar las notas individuales por el documento mensual consolidado
    db.notes = db.notes.filter(n => 
      !(n.category === 'daily_text' && Number(n.year) === numYear && n.month === mName && !n.isMonthDoc)
    );
    db.notes.unshift(monthDoc);

    // Actualizar topics
    db.topics = (db.topics || []).filter(t => t.id !== docId && !legacyNotes.some(ln => ln.id === t.id));
    db.topics.unshift({
      id: monthDoc.id,
      title: monthDoc.title,
      isNote: true,
      noteId: monthDoc.id,
      category: 'daily_text',
      subCategory: '',
      date: monthDoc.date,
      icon: '🌅',
      rawTextSnippet: monthDoc.content.slice(0, 500),
      createdAt: monthDoc.createdAt,
      updatedAt: monthDoc.updatedAt
    });

    saveDb(db);
    return monthDoc;
  }

  // Si no hay notas previas, crear un documento mensual nuevo y listo
  monthDoc = {
    id: docId,
    category: 'daily_text',
    subCategory: '',
    isMonthDoc: true,
    year: numYear,
    month: mName,
    day: null,
    title: `Daily Text — ${mName} ${numYear}`,
    date: dateStr,
    icon: '🌅',
    content: `# 🌅 Daily Text Comments — ${mName} ${numYear}\n\n*Cuaderno mensual de estudio. Pulsa "+ Añadir Día a ${mName}" para registrar tus apuntes matutinos.*\n`,
    tags: ['daily_text', String(numYear), mName],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.notes.unshift(monthDoc);
  db.topics = db.topics || [];
  db.topics.unshift({
    id: monthDoc.id,
    title: monthDoc.title,
    isNote: true,
    noteId: monthDoc.id,
    category: 'daily_text',
    subCategory: '',
    date: monthDoc.date,
    icon: '🌅',
    rawTextSnippet: monthDoc.content.slice(0, 500),
    createdAt: monthDoc.createdAt,
    updatedAt: monthDoc.updatedAt
  });

  saveDb(db);
  return monthDoc;
}

function appendDayToMonth(year, month, dayData = {}) {
  const monthDoc = getMonthDocument(year, month);
  const db = loadDb();
  const index = (db.notes || []).findIndex(n => n.id === monthDoc.id);

  const dayNum = parseInt(dayData.day, 10) || 1;
  const dayTitle = (dayData.title || `Entrada del día ${dayNum}`).trim();
  const scripture = (dayData.scripture || '').trim();
  const weekday = dayData.weekday || 'Día';
  const customContent = (dayData.content || '').trim();

  // Al principio de la entrada: Fecha marcada y Título destacado
  let dayBlock = `\n\n---\n## 📅 DÍA ${dayNum} • Fecha: ${weekday}, ${dayNum} de ${month} de ${year}\n# ✍️ Título: ${dayTitle}\n`;
  if (scripture) {
    dayBlock += `> 📖 **Texto Bíblico:** "${scripture}"\n\n`;
  }
  if (customContent) {
    dayBlock += customContent + '\n';
  } else {
    dayBlock += `### Puntos Clave del Estudio:\n- \n- \n\n💡 **Aplicación personal:**\n`;
  }

  const now = new Date().toISOString();
  const updatedContent = ((monthDoc.content || '').trim() + dayBlock).trim() + '\n';

  const updatedDoc = {
    ...monthDoc,
    content: updatedContent,
    updatedAt: now
  };

  if (index >= 0) {
    db.notes[index] = updatedDoc;
  } else {
    db.notes.unshift(updatedDoc);
  }

  // Sincronizar topic
  const topicIdx = (db.topics || []).findIndex(t => t.id === monthDoc.id || t.noteId === monthDoc.id);
  if (topicIdx >= 0) {
    db.topics[topicIdx].rawTextSnippet = updatedDoc.content.slice(0, 500);
    db.topics[topicIdx].updatedAt = now;
  }

  saveDb(db);
  return updatedDoc;
}

function getFolderDocuments(category, subCategory = '') {
  const db = loadDb();
  const notes = db.notes || [];

  if (category === 'events') {
    if (subCategory) {
      return notes.filter(n => n.category === 'events' && n.subCategory === subCategory);
    }
    return notes.filter(n => n.category === 'events');
  }

  if (category === 'spiritual_notes') {
    return notes.filter(n => n.category === 'spiritual_notes');
  }

  if (category === 'daily_text') {
    return notes.filter(n => n.category === 'daily_text');
  }

  return notes;
}

function getAvailableYears() {
  const db = loadDb();
  const years = new Set(db.config.availableYears || [2025, 2026, 2027, 2028]);
  (db.notes || []).forEach(n => {
    if (n.year) years.add(Number(n.year));
  });
  return Array.from(years).sort((a, b) => a - b);
}

function addAvailableYear(year) {
  const numYear = parseInt(year, 10);
  if (isNaN(numYear) || numYear < 1900 || numYear > 2100) return getAvailableYears();
  const db = loadDb();
  if (!Array.isArray(db.config.availableYears)) db.config.availableYears = [2025, 2026, 2027, 2028];
  if (!db.config.availableYears.includes(numYear)) {
    db.config.availableYears.push(numYear);
    db.config.availableYears.sort((a, b) => a - b);
    saveDb(db);
  }
  return db.config.availableYears;
}

function deleteTopic(topicId) {
  const db = loadDb();
  const topicIndex = db.topics.findIndex(t => t.id === topicId);
  if (topicIndex === -1) return false;

  const topic = db.topics[topicIndex];

  // Eliminar preguntas asociadas
  db.questions = db.questions.filter(q => q.topicId !== topicId);

  // Eliminar archivo de apuntes si existe
  if (topic.fileName) {
    const filePath = path.join(APUNTES_DIR, topic.fileName);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.warn('No se pudo borrar archivo físico:', e.message);
      }
    }
  }

  // Eliminar nota correspondiente si fue creada como nota
  if (topic.isNote || topic.noteId) {
    const nId = topic.noteId || topic.id;
    db.notes = (db.notes || []).filter(n => n.id !== nId);
  }

  db.topics.splice(topicIndex, 1);
  saveDb(db);
  return true;
}

function deleteNote(id) {
  const db = loadDb();
  const noteIndex = (db.notes || []).findIndex(n => n.id === id);
  if (noteIndex === -1) return false;

  db.notes.splice(noteIndex, 1);

  // Eliminar de topics y de preguntas asociadas
  db.topics = (db.topics || []).filter(t => t.id !== id && t.noteId !== id);
  db.questions = (db.questions || []).filter(q => q.topicId !== id);

  saveDb(db);
  return true;
}

function searchDatabase(query) {
  if (!query || typeof query !== 'string') {
    return { query: '', totalMatches: 0, notes: [], topics: [], questions: [] };
  }

  const db = loadDb();
  const term = query.toLowerCase().trim();
  if (term.length === 0) {
    return { query: '', totalMatches: 0, notes: [], topics: [], questions: [] };
  }

  const matchedNotes = [];
  for (const n of (db.notes || [])) {
    const titleMatch = n.title && n.title.toLowerCase().includes(term);
    const contentMatch = n.content && n.content.toLowerCase().includes(term);
    const tagMatch = n.tags && n.tags.some(t => t.toLowerCase().includes(term));
    const dateMatch = n.date && n.date.includes(term);

    if (titleMatch || contentMatch || tagMatch || dateMatch) {
      let snippet = '';
      if (contentMatch) {
        const lower = n.content.toLowerCase();
        const pos = lower.indexOf(term);
        const start = Math.max(0, pos - 50);
        const end = Math.min(n.content.length, pos + term.length + 50);
        snippet = (start > 0 ? '...' : '') + n.content.substring(start, end).replace(/\n/g, ' ') + (end < n.content.length ? '...' : '');
      } else {
        snippet = (n.content || '').substring(0, 100).replace(/\n/g, ' ') + '...';
      }

      matchedNotes.push({
        ...n,
        matchSnippet: snippet,
        matchedIn: titleMatch ? 'title' : contentMatch ? 'content' : tagMatch ? 'tag' : 'date'
      });
    }
  }

  const matchedTopics = [];
  for (const t of (db.topics || [])) {
    if (t.isNote) continue; // ya incluido en notes
    const titleMatch = t.title && t.title.toLowerCase().includes(term);
    const snippetMatch = t.rawTextSnippet && t.rawTextSnippet.toLowerCase().includes(term);
    if (titleMatch || snippetMatch) {
      matchedTopics.push(t);
    }
  }

  const matchedQuestions = [];
  for (const q of (db.questions || [])) {
    const qMatch = q.question && q.question.toLowerCase().includes(term);
    const expMatch = q.explanation && q.explanation.toLowerCase().includes(term);
    if (qMatch || expMatch) {
      matchedQuestions.push(q);
    }
  }

  return {
    query,
    totalMatches: matchedNotes.length + matchedTopics.length + matchedQuestions.length,
    notes: matchedNotes,
    topics: matchedTopics,
    questions: matchedQuestions
  };
}

function getAllCategories() {
  const db = loadDb();
  if (!Array.isArray(db.categories) || db.categories.length === 0) {
    db.categories = getDefaultCategories();
    saveDb(db);
  }
  return db.categories;
}

function addCategory({ name, icon, parentId }) {
  if (!name || !name.trim()) throw new Error('El nombre de la categoría es obligatorio');
  const db = loadDb();
  if (!Array.isArray(db.categories) || db.categories.length === 0) {
    db.categories = getDefaultCategories();
  }

  const cleanName = name.trim();
  const cleanIcon = (icon && icon.trim()) ? icon.trim() : (parentId ? '📂' : '📁');
  const catId = 'cat_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 4);

  if (parentId) {
    const parent = db.categories.find(c => c.id === parentId);
    if (!parent) throw new Error('Categoría padre no encontrada');
    if (!Array.isArray(parent.subCategories)) parent.subCategories = [];
    const newSub = {
      id: catId,
      name: cleanName,
      icon: cleanIcon,
      isSystem: false,
      parentId: parentId
    };
    parent.subCategories.push(newSub);
    saveDb(db);
    return newSub;
  } else {
    const newCat = {
      id: catId,
      name: cleanName,
      icon: cleanIcon,
      isSystem: false,
      subCategories: []
    };
    db.categories.push(newCat);
    saveDb(db);
    return newCat;
  }
}

function deleteCategory(categoryId) {
  const db = loadDb();
  if (!Array.isArray(db.categories)) return false;

  const catIndex = db.categories.findIndex(c => c.id === categoryId);
  if (catIndex !== -1) {
    if (db.categories[catIndex].isSystem) {
      throw new Error('No se pueden eliminar las categorías del sistema');
    }
    db.categories.splice(catIndex, 1);
    saveDb(db);
    return true;
  }

  for (const cat of db.categories) {
    if (Array.isArray(cat.subCategories)) {
      const subIdx = cat.subCategories.findIndex(s => s.id === categoryId);
      if (subIdx !== -1) {
        if (cat.subCategories[subIdx].isSystem) {
          throw new Error('No se pueden eliminar las subcategorías del sistema');
        }
        cat.subCategories.splice(subIdx, 1);
        saveDb(db);
        return true;
      }
    }
  }
  return false;
}


// ===========================================================================
// SINCRONIZACIÓN SIN CONEXIÓN
// ===========================================================================

function topicFromNote(note) {
  return {
    id: note.id,
    title: note.title,
    isNote: true,
    noteId: note.id,
    category: note.category,
    subCategory: note.subCategory || '',
    date: note.date,
    icon: note.icon || '📝',
    rawTextSnippet: (note.content || '').slice(0, 500),
    createdAt: note.createdAt,
    updatedAt: note.updatedAt
  };
}

function sanitizeIncomingNote(n) {
  const clean = { ...n };
  delete clean._seq;
  delete clean.questions;
  delete clean.questionsCount;
  delete clean._local;
  delete clean.matchSnippet;
  delete clean.matchedIn;
  if (typeof clean.title !== 'string') clean.title = 'Nota';
  if (typeof clean.content !== 'string') clean.content = '';
  if (!Array.isArray(clean.tags)) clean.tags = [];
  if (!clean.createdAt) clean.createdAt = new Date().toISOString();
  if (!clean.updatedAt) clean.updatedAt = new Date().toISOString();
  return clean;
}

function putNote(db, note) {
  const idx = db.notes.findIndex(n => n.id === note.id);
  if (idx >= 0) db.notes[idx] = note; else db.notes.unshift(note);
  const tIdx = db.topics.findIndex(t => t.id === note.id || t.noteId === note.id);
  const topic = topicFromNote(note);
  if (tIdx >= 0) db.topics[tIdx] = { ...db.topics[tIdx], ...topic };
  else db.topics.unshift(topic);
  const y = Number(note.year);
  if (y && Array.isArray(db.config.availableYears) && !db.config.availableYears.includes(y)) {
    db.config.availableYears.push(y);
    db.config.availableYears.sort((a, b) => a - b);
  }
}

// Divide un documento mensual en cabecera + bloques de día ("---\n## 📅 DÍA ...")
function splitMonthBlocks(content) {
  const parts = String(content || '').split(/\n(?=---\s*\n+## )/);
  return { head: parts[0], blocks: parts.slice(1).map(b => b.trim()) };
}

function mergeMonthContents(serverContent, clientContent) {
  const s = splitMonthBlocks(serverContent);
  const c = splitMonthBlocks(clientContent);
  const seen = new Set(s.blocks);
  const extra = c.blocks.filter(b => !seen.has(b));
  if (extra.length === 0) return serverContent;
  return [s.head.trim(), ...s.blocks, ...extra].join('\n\n') + '\n';
}

function makeConflictCopy(note, label) {
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  return {
    ...note,
    id: `${note.id}__conflict_${stamp}_${Math.random().toString(36).slice(2, 6)}`,
    isMonthDoc: false,
    title: `${note.title} (${label})`,
    tags: Array.from(new Set([...(note.tags || []), 'conflicto'])),
    updatedAt: new Date().toISOString()
  };
}

function findCategory(db, id) {
  for (const c of db.categories) {
    if (c.id === id) return c;
    for (const s of (c.subCategories || [])) if (s.id === id) return s;
  }
  return null;
}

/**
 * Aplica las operaciones que un dispositivo acumuló sin conexión.
 * Nunca se pierde información: si la misma nota cambió en el NAS y en el
 * dispositivo, se conserva la versión más reciente y la otra se guarda como
 * copia "(conflicto)". Los documentos mensuales se fusionan por días.
 */
function applySyncOps(ops = []) {
  const db = loadDb();
  const results = [];

  for (const op of ops) {
    const r = { opId: op.opId, type: op.type, status: 'ok' };
    try {
      if (op.type === 'upsertNote' && op.note && op.note.id) {
        const incoming = sanitizeIncomingNote(op.note);
        const existing = db.notes.find(n => n.id === incoming.id);
        const baseSeq = typeof op.baseSeq === 'number' ? op.baseSeq : null;
        // baseSeq nulo = el dispositivo nunca vio la versión del NAS (nota creada sin conexión
        // con el mismo id, p. ej. un documento mensual): se trata como cambio concurrente.
        const changedOnServer = existing && (baseSeq === null || existing._seq > baseSeq);

        if (!existing) {
          putNote(db, incoming);
        } else if (!changedOnServer || existing.content === incoming.content) {
          putNote(db, { ...existing, ...incoming, createdAt: existing.createdAt });
        } else if (existing.isMonthDoc && incoming.isMonthDoc) {
          const merged = mergeMonthContents(existing.content, incoming.content);
          putNote(db, { ...existing, content: merged, updatedAt: new Date().toISOString() });
          r.status = 'merged';
        } else {
          const incomingNewer = new Date(incoming.updatedAt) >= new Date(existing.updatedAt);
          const winner = incomingNewer ? { ...existing, ...incoming, createdAt: existing.createdAt } : existing;
          const loser = incomingNewer ? existing : incoming;
          putNote(db, winner);
          const copy = makeConflictCopy(loser, incomingNewer ? 'versión anterior del NAS' : 'copia sin conexión');
          putNote(db, copy);
          r.status = 'conflict';
          r.conflictCopyId = copy.id;
        }
        r.id = incoming.id;
      } else if (op.type === 'deleteNote' && op.id) {
        const existing = db.notes.find(n => n.id === op.id);
        const baseSeq = typeof op.baseSeq === 'number' ? op.baseSeq : null;
        if (!existing) {
          r.status = 'skipped';
        } else if (baseSeq !== null && existing._seq > baseSeq) {
          // La nota se editó en otro dispositivo después: no borrarla.
          r.status = 'kept';
        } else {
          db.notes = db.notes.filter(n => n.id !== op.id);
          db.topics = db.topics.filter(t => t.id !== op.id && t.noteId !== op.id);
          db.questions = db.questions.filter(q => q.topicId !== op.id);
        }
        r.id = op.id;
      } else if (op.type === 'addCategory' && op.category && op.category.name) {
        const cat = op.category;
        if (!findCategory(db, cat.id)) {
          const base = {
            id: cat.id || ('cat_' + Date.now().toString(36)),
            name: String(cat.name).trim(),
            icon: cat.icon || (op.parentId ? '📂' : '📁'),
            isSystem: false
          };
          if (op.parentId) {
            const parent = db.categories.find(c => c.id === op.parentId);
            if (parent) {
              if (!Array.isArray(parent.subCategories)) parent.subCategories = [];
              parent.subCategories.push({ ...base, parentId: op.parentId });
            } else r.status = 'skipped';
          } else {
            db.categories.push({ ...base, subCategories: [] });
          }
        } else r.status = 'skipped';
      } else if (op.type === 'deleteCategory' && op.id) {
        const idx = db.categories.findIndex(c => c.id === op.id && !c.isSystem);
        if (idx >= 0) db.categories.splice(idx, 1);
        else {
          for (const c of db.categories) {
            const sIdx = (c.subCategories || []).findIndex(s => s.id === op.id && !s.isSystem);
            if (sIdx >= 0) c.subCategories.splice(sIdx, 1);
          }
        }
      } else if (op.type === 'addYear' && op.year) {
        const y = parseInt(op.year, 10);
        if (y >= 1900 && y <= 2100 && !db.config.availableYears.includes(y)) {
          db.config.availableYears.push(y);
          db.config.availableYears.sort((a, b) => a - b);
        }
      } else {
        r.status = 'invalid';
      }
    } catch (err) {
      r.status = 'error';
      r.error = err.message;
    }
    results.push(r);
  }

  saveDb(db);
  // Devolver la secuencia con la que quedó guardada cada nota subida
  for (const r of results) {
    if (r.type === 'upsertNote' && r.id) {
      const n = db.notes.find(x => x.id === r.id);
      if (n) r.noteSeq = n._seq;
    }
  }
  return results;
}

/** Devuelve todo lo que cambió después de la secuencia `since`. */
function getChangesSince(since = 0) {
  const db = loadDb();
  const s = Number(since) || 0;
  const questionCounts = {};
  for (const q of db.questions) questionCounts[q.topicId] = (questionCounts[q.topicId] || 0) + 1;
  return {
    seq: db.meta.seq,
    full: s === 0,
    notes: db.notes.filter(n => (n._seq || 0) > s),
    deleted: s === 0 ? [] : db.deleted.filter(d => d._seq > s).map(d => d.id),
    categories: db.categories,
    years: getAvailableYears(),
    questionCounts
  };
}

module.exports = {
  applySyncOps,
  getChangesSince,
  DATA_DIR,
  loadDb,
  saveDb,
  getAllTopics,
  getTopicById,
  getQuestionsByTopicIds,
  addQuestionsToTopic,
  updateQuestionStat,
  recordGame,
  getConfig,
  updateConfig,
  syncApuntesFolder,
  deleteTopic,
  getAllNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
  getMonthDocument,
  appendDayToMonth,
  getFolderDocuments,
  searchDatabase,
  getAvailableYears,
  addAvailableYear,
  getAllCategories,
  addCategory,
  deleteCategory,
  DB_PATH,
  BACKUPS_DIR,
  APUNTES_DIR
};

